// Community decks from Piltover Archive, as a fallback for legends that have no
// list in Riot's Top Decks articles. We only read the public deck list page
// (/decks, /decks?page= - both allowed in its robots.txt) and the public page of
// each deck, a few at a time, and keep the result in the database for a day so
// the site doesn't hit them on every request.

import { getAppData, setAppData } from "./appData";
import { buildDeckIndex, parseDeck } from "./deck";
import type { MetaDeck } from "./metaDecks";
import type { RiftCard } from "./types";

const SITE = "https://piltoverarchive.com";
const HEADERS = { "user-agent": "Mozilla/5.0 (RBBinder; personal collection app)" };
const PAGES = 3; // 24 decks per page, ranked by Piltover Archive
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CONCURRENCY = 4;

export type CommunityCache = { fetchedAt: string; decks: MetaDeck[] };

async function getText(url: string) {
  const res = await fetch(url, { headers: HEADERS, cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  // The data sits in escaped JSON inside the page: unescape the quotes once.
  return (await res.text()).replace(/\\"/g, '"');
}

type Listed = { id: string; name: string; author: string; likes: number; legend: string };

function listDecks(html: string): Listed[] {
  const out: Listed[] = [];
  const re = /"id":"([0-9a-f-]{36})","name":"([^"]*)","description":.*?"authorName":"([^"]*)".*?"likes":(\d+).*?"legend":\{"id":"[^"]*","name":"([^"]*)"/g;
  for (const m of html.matchAll(re)) out.push({ id: m[1], name: m[2], author: m[3], likes: Number(m[4]), legend: m[5] });
  return out;
}

// The text of one array of `{ quantity, card: { name } }` rows, e.g. "maindeck".
function rows(html: string, key: string): { qty: number; name: string }[] {
  const start = html.indexOf(`"${key}":[{"deckId"`);
  if (start < 0) return [];
  let i = html.indexOf("[", start);
  const from = i;
  let depth = 0;
  let inStr = false;
  for (; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "[") depth++;
    else if (c === "]" && --depth === 0) break;
  }
  const chunk = html.slice(from, i + 1);
  return [...chunk.matchAll(/"quantity":(\d+),"card":\{"id":"[^"]*","name":"([^"]*)"/g)].map((m) => ({ qty: Number(m[1]), name: m[2] }));
}

async function readDeck(d: Listed, index: ReturnType<typeof buildDeckIndex>): Promise<MetaDeck | null> {
  const url = `${SITE}/decks/view/${d.id}`;
  const html = await getText(url);
  const block = (heading: string, list: { qty: number; name: string }[]) =>
    list.length ? [`${heading}:`, ...list.map((r) => `${r.qty} ${r.name}`)] : [];
  const text = [
    ...block("Legend", [{ qty: 1, name: d.legend }]),
    ...block("Champion", rows(html, "champions")),
    ...block("MainDeck", rows(html, "maindeck")),
    ...block("Battlefields", rows(html, "battlefields")),
    ...block("Runes", rows(html, "runes")),
    ...block("Sideboard", rows(html, "sideboard")),
  ].join("\n");
  const { entries, unknown } = parseDeck(text, index);
  if (entries.filter((e) => e.zone === "main").reduce((n, e) => n + e.qty, 0) < 30) return null;
  return {
    id: `pa:${d.id}`,
    event: "Piltover Archive",
    date: "",
    url,
    player: d.author,
    placement: `Community · ${d.likes} like${d.likes === 1 ? "" : "s"} · ${d.name}`,
    section: "community",
    entries,
    unknown,
  };
}

export async function refreshCommunityDecks(cards: RiftCard[]): Promise<CommunityCache> {
  const index = buildDeckIndex(cards);
  const pages = await Promise.all(
    Array.from({ length: PAGES }, (_, i) => getText(`${SITE}/decks${i ? `?page=${i + 1}` : ""}`).catch(() => ""))
  );
  const seen = new Set<string>();
  const listed = pages.flatMap(listDecks).filter((d) => !seen.has(d.id) && seen.add(d.id));

  const decks: MetaDeck[] = [];
  for (let i = 0; i < listed.length; i += CONCURRENCY) {
    const done = await Promise.all(listed.slice(i, i + CONCURRENCY).map((d) => readDeck(d, index).catch(() => null)));
    for (const d of done) if (d) decks.push(d);
  }
  const cache: CommunityCache = { fetchedAt: new Date().toISOString(), decks };
  await setAppData("communityDecks", cache).catch(() => {
    // no app_data table yet - still return the fresh result
  });
  return cache;
}

export async function getCommunityDecks(cards: RiftCard[], refresh = false): Promise<CommunityCache> {
  const saved = await getAppData<CommunityCache>("communityDecks");
  if (!refresh && saved && Date.now() - new Date(saved.value.fetchedAt).getTime() < MAX_AGE_MS) return saved.value;
  try {
    return await refreshCommunityDecks(cards);
  } catch (err) {
    if (saved) return saved.value;
    throw err;
  }
}
