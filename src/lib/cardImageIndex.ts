// Recognises cards from the camera by comparing a tiny RGB thumbnail of the
// card art against precomputed thumbnails of the whole catalog
// (public/card-thumbs.json, built by scripts/build-card-thumbs.mjs).

// Must match the inner crop used when the catalog thumbnails were built.
export const THUMB_MARGIN_X = 0.08;
export const THUMB_MARGIN_Y = 0.06;

export type ImageMatch = { id: string; score: number; second: number };

export type ThumbIndex = {
  w: number;
  h: number;
  ids: string[];
  vecs: Float32Array;
  size: number;
  // `groupOf` maps a card id to its name, so other prints of the same card
  // (near-identical art) don't count as the runner-up.
  match: (rgba: Uint8ClampedArray, groupOf: (id: string) => string) => ImageMatch | null;
};

// Per-channel zero-mean / unit-variance, so brightness, contrast and white
// balance differences between the camera and the catalog art mostly cancel.
function normalize(rgb: Float32Array, size: number, out: Float32Array, offset: number) {
  const px = size / 3;
  for (let ch = 0; ch < 3; ch++) {
    let sum = 0;
    for (let i = 0; i < px; i++) sum += rgb[i * 3 + ch];
    const mean = sum / px;
    let varSum = 0;
    for (let i = 0; i < px; i++) varSum += (rgb[i * 3 + ch] - mean) ** 2;
    const std = Math.sqrt(varSum / px) || 1;
    for (let i = 0; i < px; i++) out[offset + i * 3 + ch] = (rgb[i * 3 + ch] - mean) / (std * Math.sqrt(size));
  }
}

let cached: Promise<ThumbIndex> | null = null;

export function loadThumbIndex(): Promise<ThumbIndex> {
  if (cached) return cached;
  cached = fetch("/card-thumbs.json")
    .then((r) => {
      if (!r.ok) throw new Error("Could not load the card index");
      return r.json();
    })
    .then((json: { w: number; h: number; ids: string[]; data: string }) => {
      const bin = atob(json.data);
      const size = json.w * json.h * 3;
      const raw = new Float32Array(json.ids.length * size);
      for (let i = 0; i < raw.length; i++) raw[i] = bin.charCodeAt(i);
      const vecs = new Float32Array(raw.length);
      const tmp = new Float32Array(size);
      for (let e = 0; e < json.ids.length; e++) {
        tmp.set(raw.subarray(e * size, (e + 1) * size));
        normalize(tmp, size, vecs, e * size);
      }

      const q = new Float32Array(size);
      const rgb = new Float32Array(size);
      const index: ThumbIndex = {
        w: json.w,
        h: json.h,
        ids: json.ids,
        vecs,
        size,
        match(rgba, groupOf) {
          for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
            rgb[j] = rgba[i];
            rgb[j + 1] = rgba[i + 1];
            rgb[j + 2] = rgba[i + 2];
          }
          normalize(rgb, size, q, 0);
          const dots = new Float32Array(json.ids.length);
          let bi = 0;
          for (let e = 0; e < json.ids.length; e++) {
            let dot = 0;
            const base = e * size;
            for (let k = 0; k < size; k++) dot += q[k] * vecs[base + k];
            dots[e] = dot;
            if (dot > dots[bi]) bi = e;
          }
          const group = groupOf(json.ids[bi]);
          let second = -2;
          for (let e = 0; e < json.ids.length; e++) {
            if (dots[e] > second && groupOf(json.ids[e]) !== group) second = dots[e];
          }
          return { id: json.ids[bi], score: dots[bi], second };
        },
      };
      return index;
    });
  cached.catch(() => {
    cached = null;
  });
  return cached;
}
