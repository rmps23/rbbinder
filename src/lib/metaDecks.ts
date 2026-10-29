// Meta decks from Riot's own "Top Decks" articles on playriftbound.com: after
// each official event Riot publishes the Top 8 and the best list of every
// legend, as plain text. We read those (the site allows it in robots.txt),
// parse each list with the same importer the deck builder uses, and keep the
// result in the database so the site doesn't re-read Riot on every request.

import { getAppData, setAppData } from "./appData";
import { buildDeckIndex, parseDeck } from "./deck";
import type { DeckEntry, RiftCard } from "./types";

const SITE = "https://playriftbound.com";
const HEADERS = { "user-agent": "Mozilla/5.0 (RBBinder; personal collection app)" };
const MAX_EVENTS = 5; // the most recent events are enough for "the meta"
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export type MetaDeck = {
  id: string;
  event: string; // e.g. "Utrecht's Top Decks"
  date: string; // ISO publish date of the article
  url: string;
  player: string;
  placement: string; // "Top 8" or "Best Renata Glasc list (#1/14)"
  section: "top8" | "best";
  entries: DeckEntry[];
  unknown: string[];
};

export type MetaCache = { fetchedAt: string; events: { title: string; date: string; url: string }[]; decks: MetaDeck[] };

function unescape(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function toText(html: string) {
  return unescape(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|h\d|td|tr|li)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

async function getText(url: string) {
  const res = await fetch(url, { headers: HEADERS, cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

async function listArticles() {
  const xml = await getText(`${SITE}/en-us/sitemap_loc.xml`);
  return [...xml.matchAll(/<loc>([^<]*top-decks[^<]*)<\/loc>/g)].map((m) => m[1]);
}

// One article -> its event title, date and every decklist in it.
async function readArticle(url: string, cards: RiftCard[]) {
  const html = await getText(url);
  const json = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!json) return null;
  const data = JSON.parse(json);
  const page = data?.props?.pageProps?.page ?? {};
  const title: string = page.title ?? "Top Decks";
  const date: string = page.displayedPublishDate ?? page.publishDate ?? "";

  // The article body is rich text (HTML) somewhere inside the page blades.
  const bodies: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (v.includes("<h3>") && /Main Deck/i.test(v)) bodies.push(v);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(page);
  const body = bodies.join("\n");
  if (!body) return { title, date, decks: [] as MetaDeck[] };

  const index = buildDeckIndex(cards);
  const decks: MetaDeck[] = [];
  let section: "top8" | "best" = "best";
  // Walk headings in order: <h1> switches section, each <h3> starts a deck.
  const parts = body.split(/(?=<h1>|<h3>)/);
  for (const part of parts) {
    const h1 = part.match(/^<h1>([\s\S]*?)<\/h1>/);
    if (h1) {
      section = /top\s*8/i.test(h1[1]) ? "top8" : "best";
      continue;
    }
    const h3 = part.match(/^<h3>([\s\S]*?)<\/h3>/);
    if (!h3 || !/Main Deck/i.test(part)) continue;
    const text = toText(part.slice(h3[0].length));
    // Info lines ("Legend Rank: #1/14", "Placement: 2nd") come before the list.
    const listStart = text.search(/^Legend\s*:?\s*$/im);
    const info = (listStart > 0 ? text.slice(0, listStart) : "")
      .split("\n")
      .filter((l) => /:/.test(l))
      .join(" · ");
    const list = (listStart >= 0 ? text.slice(listStart) : text)
      .split("\n")
      // "Battlefields: 1 Ornn's Forge" -> heading and card on their own lines
      .flatMap((l) => {
        const m = l.match(/^(Legend|Champion|Main Deck|Battlefields|Rune Pool|Runes|Sideboard)\s*:\s*(.+)$/i);
        return m ? [`${m[1]}:`, m[2]] : [l];
      })
      // stray trailing colons and section titles that aren't cards
      .map((l) => (/^\d+\s/.test(l) ? l.replace(/:\s*$/, "") : l))
      .filter((l) => !/^top\s*8/i.test(l))
      .join("\n");
    const { entries, unknown } = parseDeck(list, index);
    if (entries.filter((e) => e.zone === "main").reduce((n, e) => n + e.qty, 0) < 30) continue;
    const player = toText(h3[1]);
    decks.push({
      id: `${url.split("/").filter(Boolean).pop()}#${decks.length}`,
      event: title,
      date,
      url,
      player,
      placement: section === "top8" ? `Top 8${info ? ` · ${info}` : ""}` : info || "Best of its legend",
      section,
      entries,
      unknown,
    });
  }
  return { title, date, decks };
}

export async function refreshMetaDecks(cards: RiftCard[]): Promise<MetaCache> {
  const urls = await listArticles();
  const read = (await Promise.all(urls.map((u) => readArticle(u, cards).catch(() => null)))).filter(
    (a): a is NonNullable<typeof a> => !!a && a.decks.length > 0
  );
  read.sort((a, b) => b.date.localeCompare(a.date));
  const recent = read.slice(0, MAX_EVENTS);
  const cache: MetaCache = {
    fetchedAt: new Date().toISOString(),
    events: recent.map((a) => ({ title: a.title, date: a.date, url: a.decks[0].url })),
    decks: recent.flatMap((a) => a.decks),
  };
  await setAppData("metaDecks", cache).catch(() => {
    // no app_data table yet - still return the fresh result
  });
  return cache;
}

export async function getMetaDecks(cards: RiftCard[], refresh = false): Promise<MetaCache> {
  const saved = await getAppData<MetaCache>("metaDecks");
  if (!refresh && saved && Date.now() - new Date(saved.value.fetchedAt).getTime() < MAX_AGE_MS) return saved.value;
  try {
    return await refreshMetaDecks(cards);
  } catch (err) {
    if (saved) return saved.value; // Riot unreachable: last known meta is better than nothing
    throw err;
  }
}
