// "Recommend a deck from my bulk": the site works out what's legal and owned,
// a free Gemini model picks the 40 cards and explains the plan, and the result
// is checked against the deck rules (and repaired) before it's shown.

import { buildDeckIndex, cardKey, displayName } from "./deck";
import { belongsInPool, checkDeck, isChampionUnit, isSignature, LIMITS } from "./deckRules";
import { getMetaDecks, type MetaDeck } from "./metaDecks";
import { getBulk, getCardsAndSets, listBinders } from "./repo";
import { isRegularPrinting } from "./setCollection";
import { championNames, legendChampion } from "./wants";
import type { DeckEntry, RiftCard } from "./types";

export type Style = "any" | "aggro" | "midrange" | "control";

export type LegendOption = {
  legendId: string;
  name: string;
  domains: string[];
  owned: boolean; // the legend card itself is in your bulk
  champions: number; // champion units for this legend you own
  championsInGame: number; // all champion units that fit it (you can use one you don't own)
  poolCopies: number; // main-deck copies you could play (max 3 per name)
  battlefields: number;
  viable: boolean; // your bulk has enough cards for a 40-card deck
  imageCardId: string; // the printing to show
};

export type Recommendation = {
  deckName: string;
  archetype: string;
  plan: string;
  tips: string[];
  entries: DeckEntry[];
  missing: string[]; // cards the deck uses that aren't in the bulk (runes, battlefields)
  problems: string[];
  legal: boolean;
  swaps: { out: string; in: string; reason: string }[];
  basedOn: string | null; // "Vegas' Top Decks · player (Top 8)" when built from a meta list
};

export type MetaOption = {
  id: string;
  event: string;
  date: string;
  url: string;
  player: string;
  placement: string;
  section: "top8" | "best";
  legendId: string;
  legendName: string;
  legendOwned: boolean;
  champion: string | null;
  have: number; // copies of the list you own (legend, champion, main deck, battlefields)
  total: number;
  missing: { name: string; qty: number }[];
};

// Tried in order. The newest Flash model sometimes queues for minutes on the free
// tier, so a quick, reliable one goes first and lighter ones are the fallback.
const MODELS = [...new Set([process.env.GEMINI_MODEL, "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-latest"].filter(Boolean))] as string[];
const API = "https://generativelanguage.googleapis.com/v1beta/models";

// ---------- what you own ----------

// Cards you can play: everything in the bulk AND in your binders, but only
// regular printings - alternate arts, overnumbered, signature and showcase
// copies are collection pieces and never leave the binder.
async function loadOwned() {
  const [{ cards }, bulk, binders] = await Promise.all([getCardsAndSets(), getBulk(), listBinders()]);
  const copies = new Map<string, number>(); // card id -> copies
  for (const [id, e] of Object.entries(bulk)) copies.set(id, (copies.get(id) ?? 0) + (e.normal ?? 0) + (e.foil ?? 0));
  for (const b of binders) for (const [id, q] of Object.entries(b.contents ?? {})) copies.set(id, (copies.get(id) ?? 0) + q);

  const owned = new Map<string, number>(); // card name key -> copies
  const printing = new Map<string, RiftCard>(); // key -> the printing you have most of
  const best = new Map<string, number>();
  for (const c of cards) {
    const q = copies.get(c.id) ?? 0;
    if (q <= 0 || !isRegularPrinting(c)) continue;
    const k = cardKey(c);
    owned.set(k, (owned.get(k) ?? 0) + q);
    if (q > (best.get(k) ?? 0)) {
      best.set(k, q);
      printing.set(k, c);
    }
  }
  return { cards, owned, printing, index: buildDeckIndex(cards) };
}

type Owned = Awaited<ReturnType<typeof loadOwned>>;

const champCache = new WeakMap<RiftCard[], Set<string>>();
// "Kennen, Heart of the Tempest" - the champion tag, not a faction tag like "Yordle".
function legendLabel(legend: RiftCard, o: Owned) {
  let champs = champCache.get(o.cards);
  if (!champs) champCache.set(o.cards, (champs = championNames(o.cards)));
  const champ = legendChampion(legend, champs);
  return champ ? `${champ}, ${displayName(legend)}` : displayName(legend);
}

function poolFor(legend: RiftCard, o: Owned) {
  const { owned, printing } = o;
  const champions: RiftCard[] = [];
  const main: { card: RiftCard; copies: number }[] = [];
  const battlefields: RiftCard[] = [];
  for (const [k, q] of owned) {
    const card = printing.get(k)!;
    if (belongsInPool(card, "champion", legend) && isChampionUnit(card)) champions.push(card);
    if (belongsInPool(card, "main", legend)) main.push({ card, copies: Math.min(LIMITS.copies, q) });
    if (belongsInPool(card, "battlefield", legend)) battlefields.push(card);
  }
  // No champion for this legend in the bulk? Offer all of them - the deck then
  // just needs that one card.
  const ownsChampion = champions.length > 0;
  if (!ownsChampion) {
    for (const list of o.index.byKey.values()) {
      const c = list[0];
      if (isChampionUnit(c) && belongsInPool(c, "champion", legend)) champions.push(c);
    }
  }
  return { champions, ownsChampion, main, battlefields };
}

export async function legendOptions(): Promise<LegendOption[]> {
  return legendOptionsFrom(await loadOwned());
}

// Every legend in the game (you only need the one legend card), ranked by how
// much of a deck your bulk can build around it.
function legendOptionsFrom(o: Owned): LegendOption[] {
  const index = o.index;
  const legends = [...index.byKey.entries()]
    .filter(([, list]) => list[0].types.includes("legend"))
    .map(([k, list]) => o.printing.get(k) ?? list[0]);
  return legends
    .map((legend) => {
      const p = poolFor(legend, o);
      const poolCopies = p.main.reduce((n, m) => n + m.copies, 0);
      return {
        legendId: legend.id,
        name: legendLabel(legend, o),
        domains: legend.domains.map((d) => d.label),
        owned: (o.owned.get(cardKey(legend)) ?? 0) > 0,
        champions: p.ownsChampion ? p.champions.length : 0,
        championsInGame: p.champions.length,
        imageCardId: legend.id,
        poolCopies,
        battlefields: p.battlefields.length,
        viable: p.champions.length > 0 && poolCopies >= LIMITS.main - 1,
      };
    })
    .sort((a, b) => Number(b.viable) - Number(a.viable) || b.poolCopies - a.poolCopies);
}

// ---------- the model ----------

function describe(c: RiftCard, copies?: number) {
  const kind = [
    ...(c.superTypes ?? []).filter((s) => s === "champion" || s === "signature"),
    ...c.types,
  ].join(" ");
  const stats = [
    c.energy !== null ? `cost ${c.energy}` : null,
    c.power ? `power ${c.power}` : null,
    c.might !== null ? `might ${c.might}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const text = c.abilityText.replace(/\s+/g, " ").slice(0, 260);
  return `- ${displayName(c)} [${kind}; ${c.domains.map((d) => d.label).join("/") || "no domain"}${stats ? `; ${stats}` : ""}]${
    copies !== undefined ? ` x${copies}` : ""
  } :: ${text}`;
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    deckName: { type: "STRING" },
    archetype: { type: "STRING" },
    plan: { type: "STRING" },
    champion: { type: "STRING" },
    main: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { name: { type: "STRING" }, qty: { type: "INTEGER" } }, required: ["name", "qty"] },
    },
    battlefields: { type: "ARRAY", items: { type: "STRING" } },
    tips: { type: "ARRAY", items: { type: "STRING" } },
    swaps: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { out: { type: "STRING" }, in: { type: "STRING" }, reason: { type: "STRING" } },
        required: ["out", "in", "reason"],
      },
    },
  },
  required: ["deckName", "archetype", "plan", "champion", "main", "battlefields", "tips"],
};

type ModelDeck = {
  deckName: string;
  archetype: string;
  plan: string;
  champion: string;
  main: { name: string; qty: number }[];
  battlefields: string[];
  tips: string[];
  swaps?: { out: string; in: string; reason: string }[];
};

async function callModel(model: string, prompt: string, key: string, timeoutMs: number): Promise<ModelDeck> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}/${model}:generateContent`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.7, thinkingConfig: { thinkingLevel: "low" } },
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(res.status === 429 ? "The free Gemini quota is used up for now - try again in a minute." : (data?.error?.message ?? `Gemini error ${res.status}`));
      (err as Error & { retry?: boolean }).retry = res.status === 429 || res.status >= 500 || res.status === 404;
      throw err;
    }
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    return JSON.parse(text) as ModelDeck;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      const e = new Error("Gemini took too long - try again.");
      (e as Error & { retry?: boolean }).retry = true;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function askGemini(prompt: string): Promise<ModelDeck> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY isn't set - add it in Vercel (Settings → Environment Variables) and redeploy.");
  const deadline = Date.now() + 52_000; // stay inside the route's 60 s
  let last: unknown;
  for (const model of MODELS) {
    const left = deadline - Date.now();
    if (left < 8_000) break;
    const started = Date.now();
    try {
      const out = await callModel(model, prompt, key, Math.min(left, 25_000));
      console.log(`[deck advisor] ${model} answered in ${Date.now() - started} ms`);
      return out;
    } catch (err) {
      console.log(`[deck advisor] ${model} failed after ${Date.now() - started} ms: ${(err as Error).message}`);
      last = err;
      if (!(err as { retry?: boolean }).retry) throw err;
    }
  }
  throw last instanceof Error ? last : new Error("Gemini didn't answer - try again.");
}

function prompt(legend: RiftCard, pool: ReturnType<typeof poolFor>, style: Style, note: string) {
  const styleLine =
    style === "any" ? "Pick whichever strategy these cards support best." : `The player wants a ${style} deck if the cards allow it.`;
  return `You are an expert Riftbound TCG (League of Legends card game) deck builder.
Build the strongest deck possible for a casual Constructed "Nexus Night" store event, using ONLY the cards listed below (the player's collection; "xN" = copies available).

Deck rules:
- Legend: ${displayName(legend)} (domains: ${legend.domains.map((d) => d.label).join(", ")}). Already chosen.
- Chosen champion: exactly 1, picked from the CHAMPIONS list.
- Main deck: exactly ${LIMITS.main - 1} cards (plus the champion = ${LIMITS.main}), units / spells / gear from the POOL list.
- At most 3 copies of a card name across champion + main deck, and never more than the copies available.
- At most 3 signature cards in total.
- 3 battlefields with different names from the BATTLEFIELDS list (if fewer are listed, use what is there).
- Use exact card names as written below (the part before the "[").
${styleLine}
${note ? `Player's note: ${note.slice(0, 300)}` : ""}

Aim for a sensible energy curve, enough units to contest battlefields, and cards that work together (shared tags, keywords, the legend's ability). Prefer 2-3 copies of key cards over many singletons.

LEGEND:
${describe(legend)}

CHAMPIONS:
${pool.ownsChampion ? "" : "(The player owns none of these yet - pick the one that fits the deck best; they'll get that card.)\n"}${pool.champions.map((c) => describe(c)).join("\n")}

POOL:
${pool.main.map((m) => describe(m.card, m.copies)).join("\n")}

BATTLEFIELDS:
${pool.battlefields.map((c) => describe(c)).join("\n") || "(none owned)"}

Answer as JSON: deckName, archetype (2-4 words), plan (3-5 sentences: how the deck wins, early/late game), champion (name), main (name + qty), battlefields (names), tips (3-5 short play tips).`;
}

// ---------- turn the model's answer into a legal deck ----------

function assemble(legend: RiftCard, model: ModelDeck, o: Owned, pool: ReturnType<typeof poolFor>) {
  const index = buildDeckIndex(o.cards);
  const lookup = (name: string) => {
    const k = index.lookup.get(
      name
        .replace(/[‘’`]/g, "'")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
    );
    return k;
  };
  const poolByKey = new Map(pool.main.map((m) => [cardKey(m.card), m]));

  // Champion: the model's pick if valid, else the one you own most of.
  const champKey = lookup(model.champion);
  const champion =
    pool.champions.find((c) => cardKey(c) === champKey) ??
    [...pool.champions].sort((a, b) => (o.owned.get(cardKey(b)) ?? 0) - (o.owned.get(cardKey(a)) ?? 0))[0];

  const used = new Map<string, number>();
  if (champion) used.set(cardKey(champion), 1);
  const room = (k: string) => {
    const m = poolByKey.get(k);
    if (!m) return 0;
    return Math.max(0, Math.min(LIMITS.copies, o.owned.get(k) ?? 0) - (used.get(k) ?? 0));
  };
  const target = LIMITS.main - (champion ? 1 : 0);
  let total = 0;
  let signatures = 0;
  const add = (k: string, want: number) => {
    const card = poolByKey.get(k)?.card;
    if (!card) return;
    let n = Math.min(want, room(k), target - total);
    if (isSignature(card)) n = Math.min(n, LIMITS.signatures - signatures);
    if (n <= 0) return;
    used.set(k, (used.get(k) ?? 0) + n);
    total += n;
    if (isSignature(card)) signatures += n;
  };

  for (const line of model.main ?? []) {
    const k = lookup(line.name);
    if (k) add(k, Math.max(1, Math.round(line.qty || 1)));
  }
  // Short? Top up with the cheapest-curve cards you still have (units first).
  if (total < target) {
    const rest = pool.main
      .filter((m) => room(cardKey(m.card)) > 0)
      .sort(
        (a, b) =>
          Number(b.card.types.includes("unit")) - Number(a.card.types.includes("unit")) ||
          Math.abs((a.card.energy ?? 3) - 3) - Math.abs((b.card.energy ?? 3) - 3)
      );
    for (const m of rest) {
      if (total >= target) break;
      add(cardKey(m.card), 2);
    }
    for (const m of rest) {
      if (total >= target) break;
      add(cardKey(m.card), 3);
    }
  }

  const entries: DeckEntry[] = [{ cardId: legend.id, zone: "legend", qty: 1 }];
  if (champion) entries.push({ cardId: champion.id, zone: "champion", qty: 1 });
  for (const [k, q] of used) {
    const mainQty = q - (champion && cardKey(champion) === k ? 1 : 0);
    const card = poolByKey.get(k)?.card;
    if (card && mainQty > 0) entries.push({ cardId: card.id, zone: "main", qty: mainQty });
  }

  const missing: string[] = [];

  // Battlefields: the model's picks you own, then other owned legal ones, then any legal ones.
  const bf = new Set<string>();
  for (const name of model.battlefields ?? []) {
    const k = lookup(name);
    const card = pool.battlefields.find((c) => cardKey(c) === k);
    if (card && bf.size < 3) bf.add(card.id);
  }
  for (const c of pool.battlefields) if (bf.size < 3) bf.add(c.id);
  if (bf.size < 3) {
    const seen = new Set([...bf].map((id) => cardKey(o.cards.find((c) => c.id === id)!)));
    for (const k of index.byKey.keys()) {
      const c = index.byKey.get(k)![0];
      if (bf.size >= 3) break;
      if (!seen.has(k) && belongsInPool(c, "battlefield", legend)) {
        bf.add(c.id);
        seen.add(k);
        missing.push(displayName(c));
      }
    }
  }
  for (const id of bf) entries.push({ cardId: id, zone: "battlefield", qty: 1 });

  // Runes: 12, split between the legend's domains by how much the deck leans on each.
  const doms = legend.domains.map((d) => d.id).filter((d) => d !== "colorless");
  const weight = new Map(doms.map((d) => [d, 0]));
  for (const e of entries) {
    if (e.zone !== "main" && e.zone !== "champion") continue;
    const c = o.cards.find((x) => x.id === e.cardId);
    for (const d of c?.domains ?? []) if (weight.has(d.id)) weight.set(d.id, weight.get(d.id)! + e.qty);
  }
  const sum = [...weight.values()].reduce((a, b) => a + b, 0) || doms.length;
  let left = LIMITS.runes;
  doms.forEach((d, i) => {
    const n = i === doms.length - 1 ? left : Math.max(3, Math.min(9, Math.round((LIMITS.runes * (weight.get(d) || 1)) / sum)));
    left -= n;
    const label = legend.domains.find((x) => x.id === d)!.label;
    const k = index.lookup.get(`${label} rune`.toLowerCase());
    const rune = k ? (o.printing.get(k) ?? index.byKey.get(k)![0]) : undefined;
    if (!rune || n <= 0) return;
    entries.push({ cardId: rune.id, zone: "rune", qty: n });
    if ((o.owned.get(cardKey(rune)) ?? 0) < n) missing.push(`${n - (o.owned.get(cardKey(rune)) ?? 0)}× ${displayName(rune)}`);
  });

  return { entries, missing };
}

// ---------- meta decks ----------

const PLAYED: DeckEntry["zone"][] = ["legend", "champion", "main", "battlefield"];

function coverage(meta: MetaDeck, o: Owned, cardById: Map<string, RiftCard>) {
  const need = new Map<string, { card: RiftCard; qty: number }>();
  for (const e of meta.entries) {
    const card = cardById.get(e.cardId);
    if (!card || !PLAYED.includes(e.zone)) continue;
    const k = cardKey(card);
    const cur = need.get(k);
    if (cur) cur.qty += e.qty;
    else need.set(k, { card, qty: e.qty });
  }
  let have = 0;
  let total = 0;
  const missing: { name: string; qty: number }[] = [];
  for (const [k, { card, qty }] of need) {
    const got = Math.min(qty, o.owned.get(k) ?? 0);
    have += got;
    total += qty;
    if (got < qty) missing.push({ name: displayName(card), qty: qty - got });
  }
  return { have, total, missing };
}

export async function metaOptions(refresh = false) {
  const o = await loadOwned();
  const cache = await getMetaDecks(o.cards, refresh);
  const cardById = new Map(o.cards.map((c) => [c.id, c]));
  const decks: MetaOption[] = cache.decks.flatMap((d) => {
    const legendEntry = d.entries.find((e) => e.zone === "legend");
    const legend = legendEntry && cardById.get(legendEntry.cardId);
    if (!legend) return [];
    const champ = d.entries.find((e) => e.zone === "champion");
    const champCard = champ && cardById.get(champ.cardId);
    const cov = coverage(d, o, cardById);
    return [
      {
        id: d.id,
        event: d.event,
        date: d.date,
        url: d.url,
        player: d.player,
        placement: d.placement,
        section: d.section,
        legendId: (o.printing.get(cardKey(legend)) ?? legend).id,
        legendName: legendLabel(legend, o),
        legendOwned: (o.owned.get(cardKey(legend)) ?? 0) > 0,
        champion: champCard ? displayName(champCard) : null,
        ...cov,
      },
    ];
  });
  decks.sort((a, b) => b.have / b.total - a.have / a.total || b.date.localeCompare(a.date));
  return { fetchedAt: cache.fetchedAt, events: cache.events, decks };
}

function metaPrompt(legend: RiftCard, meta: MetaDeck, o: Owned, pool: ReturnType<typeof poolFor>, note: string) {
  const cardById = new Map(o.cards.map((c) => [c.id, c]));
  const line = (e: DeckEntry) => {
    const c = cardById.get(e.cardId);
    if (!c) return null;
    const own = o.owned.get(cardKey(c)) ?? 0;
    return `${e.qty} ${displayName(c)} (player owns ${own})`;
  };
  const zone = (z: DeckEntry["zone"]) => meta.entries.filter((e) => e.zone === z).map(line).filter(Boolean).join("\n");
  return `You are an expert Riftbound TCG (League of Legends card game) deck builder.
The player wants to play a proven META deck at a casual Constructed "Nexus Night" store event, but can only use cards they own.

This is the target list: ${meta.player}'s deck from Riot's official "${meta.event}" (${meta.placement}).
Legend: ${displayName(legend)}
Champion:
${zone("champion")}
MainDeck:
${zone("main")}
Battlefields:
${zone("battlefield")}

Your job: rebuild this list as closely as possible using ONLY the POOL below (the player's cards, "xN" = copies available).
- Keep every meta card the player owns, up to the copies they own.
- For each missing copy, pick the best replacement from POOL that plays the same role (similar cost, same card type, same game plan). Never use cards that aren't in the POOL.
- Champion: the meta champion if it is in CHAMPIONS, otherwise the best one from CHAMPIONS.
- Main deck exactly ${LIMITS.main - 1} cards (+ champion = ${LIMITS.main}), max 3 copies per name (champion included), max 3 signature cards.
- 3 battlefields with different names, from BATTLEFIELDS (prefer the meta ones you own).
- List every replacement in "swaps" (out = meta card, in = your card, reason = one short sentence).
${note ? `Player's note: ${note.slice(0, 300)}` : ""}

LEGEND:
${describe(legend)}

CHAMPIONS:
${pool.ownsChampion ? "" : "(The player owns none of these yet - pick the meta one if listed; they'll get that card.)\n"}${pool.champions.map((c) => describe(c)).join("\n")}

POOL:
${pool.main.map((m) => describe(m.card, m.copies)).join("\n")}

BATTLEFIELDS:
${pool.battlefields.map((c) => describe(c)).join("\n") || "(none owned)"}

Answer as JSON: deckName (e.g. "${displayName(legend)} - ${meta.event.replace(/’s Top Decks|'s Top Decks|’ Top Decks/, "")} build"), archetype (2-4 words), plan (3-5 sentences: how the meta deck wins and what your replacements change), champion, main (name + qty), battlefields, tips (3-5 short play tips), swaps.`;
}

export async function recommendDeck(opts: { legendId?: string; metaId?: string; style?: Style; note?: string }): Promise<Recommendation> {
  const o = await loadOwned();
  let meta: MetaDeck | undefined;
  if (opts.metaId) {
    meta = (await getMetaDecks(o.cards)).decks.find((d) => d.id === opts.metaId);
    if (!meta) throw new Error("That meta deck isn't in the list any more - refresh the meta decks.");
    const legendEntry = meta.entries.find((e) => e.zone === "legend");
    const metaLegend = legendEntry && o.cards.find((c) => c.id === legendEntry.cardId);
    if (metaLegend) opts = { ...opts, legendId: (o.printing.get(cardKey(metaLegend)) ?? metaLegend).id };
  }
  const options = legendOptionsFrom(o);
  const pickId = opts.legendId ?? options.find((x) => x.viable)?.legendId ?? options[0]?.legendId;
  const legend = o.cards.find((c) => c.id === pickId);
  if (!legend) throw new Error("Couldn't find that legend.");
  const pool = poolFor(legend, o);
  if (!pool.champions.length) throw new Error(`There's no champion unit for ${displayName(legend)} in the card list - try "Sync cards".`);

  const model = await askGemini(
    meta ? metaPrompt(legend, meta, o, pool, opts.note ?? "") : prompt(legend, pool, opts.style ?? "any", opts.note ?? "")
  );
  const { entries, missing } = assemble(legend, model, o, pool);
  if (!(o.owned.get(cardKey(legend)) ?? 0)) missing.unshift(`${displayName(legend)} (legend)`);
  const champ = entries.find((e) => e.zone === "champion");
  const champCard = champ && o.cards.find((c) => c.id === champ.cardId);
  if (champCard && !(o.owned.get(cardKey(champCard)) ?? 0)) missing.unshift(`${displayName(champCard)} (champion)`);
  const cardById = new Map(o.cards.map((c) => [c.id, c]));
  const check = checkDeck({ entries, cardById });
  return {
    deckName: model.deckName?.slice(0, 60) || `${displayName(legend)} deck`,
    archetype: model.archetype ?? "",
    plan: model.plan ?? "",
    tips: (model.tips ?? []).slice(0, 6),
    entries,
    missing,
    problems: check.checks.filter((c) => !c.ok).map((c) => `${c.label} (${c.detail})`).concat(check.problems),
    legal: check.legal,
    swaps: (model.swaps ?? []).filter((s) => s.out.trim().toLowerCase() !== s.in.trim().toLowerCase()).slice(0, 20),
    basedOn: meta ? `${meta.event} · ${meta.player} (${meta.placement})` : null,
  };
}

// For tests/debugging only.
export const _internals = { loadOwned, poolFor, prompt, metaPrompt, assemble, legendOptionsFrom, askGemini, coverage };
