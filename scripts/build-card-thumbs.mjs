// Builds public/card-thumbs.json: a tiny RGB thumbnail of every card in the
// catalog, used by the camera scanner to recognise cards by their artwork.
// Run: node scripts/build-card-thumbs.mjs   (needs .data/local-db.json)
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const W = 24;
const H = 33;
const db = JSON.parse(readFileSync(new URL("../.data/local-db.json", import.meta.url), "utf8"));
const cards = db.cards.map((c) => c.payload).filter((c) => c.image?.url);

// Compare only the inner part of each card (borders are where a hand-held
// frame is least aligned).
const MX = 0.08;
const MY = 0.06;

async function thumb(buf, rotate) {
  let img = sharp(buf).removeAlpha();
  if (rotate) img = img.rotate(rotate);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const left = Math.round(info.width * MX);
  const top = Math.round(info.height * MY);
  const width = info.width - 2 * left;
  const height = info.height - 2 * top;
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } })
    .extract({ left, top, width, height })
    .resize(W, H, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer();
}

const entries = [];
let next = 0;
async function worker() {
  while (next < cards.length) {
    const c = cards[next++];
    try {
      const res = await fetch(`${c.image.url}&w=240&fm=png`);
      if (!res.ok) throw new Error(String(res.status));
      const buf = Buffer.from(await res.arrayBuffer());
      const landscape = c.image.width > c.image.height;
      // Landscape cards (battlefields) could be held either way up.
      for (const rot of landscape ? [90, -90] : [0]) {
        entries.push({ id: c.id, data: await thumb(buf, rot) });
      }
    } catch (err) {
      console.error(`skip ${c.publicCode}: ${err.message}`);
    }
    if (next % 100 === 0) console.log(`${next}/${cards.length}`);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

const all = Buffer.concat(entries.map((e) => e.data));
writeFileSync(
  new URL("../public/card-thumbs.json", import.meta.url),
  JSON.stringify({ w: W, h: H, ids: entries.map((e) => e.id), data: all.toString("base64") })
);
console.log(`wrote ${entries.length} thumbnails (${Math.round(all.length / 1024)} KB raw)`);
