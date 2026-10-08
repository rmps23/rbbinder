"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { matchScan, targetPosition, type ScanMatch } from "@/lib/cardScan";
import type { BinderSlots, RiftCard } from "@/lib/types";

type Worker = {
  recognize: (img: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  setParameters: (p: Record<string, string>) => Promise<unknown>;
  terminate: () => Promise<unknown>;
};

const SAME_CARD_COOLDOWN_MS = 4000;
const CARD_RATIO = 744 / 1039;

export function ScanCardModal({
  cards,
  slots,
  perPage,
  onAdd,
  onClose,
}: {
  cards: RiftCard[];
  slots: BinderSlots;
  perPage: number;
  onAdd: (card: RiftCard, position: number) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<ScanMatch | null>(null);
  const lastAddedRef = useRef<{ id: string; at: number } | null>(null);
  const onAddRef = useRef(onAdd);
  onAddRef.current = onAdd;
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const [status, setStatus] = useState("Starting camera...");
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<ScanMatch | null>(null);
  // Kept after the drawer closes so its content doesn't vanish mid-slide.
  const [shown, setShown] = useState<ScanMatch | null>(null);
  const [pick, setPick] = useState(0);
  const [autoAdd, setAutoAdd] = useState(false);
  const autoAddRef = useRef(autoAdd);
  autoAddRef.current = autoAdd;
  const [addedCount, setAddedCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const commit = useCallback((card: RiftCard) => {
    const { position } = targetPosition(card, slotsRef.current);
    onAddRef.current(card, position);
    lastAddedRef.current = { id: card.id, at: Date.now() };
    pendingRef.current = null;
    setMatch(null);
    setPick(0);
    setAddedCount((n) => n + 1);
    setToast(`Added ${card.name}`);
    window.setTimeout(() => setToast(null), 1600);
  }, []);

  function dismiss(card: RiftCard) {
    pendingRef.current = null;
    lastAddedRef.current = { id: card.id, at: Date.now() };
    setMatch(null);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    // Maps the on-screen guide frame back onto the camera frame (the video
    // is shown object-cover, so part of it is cropped off-screen).
    function guideRect(video: HTMLVideoElement, container: HTMLElement) {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const gh = Math.min(ch * 0.78, (cw * 0.92) / CARD_RATIO);
      const gw = gh * CARD_RATIO;
      const gx = (cw - gw) / 2;
      const gy = (ch - gh) / 2;
      const scale = Math.max(cw / video.videoWidth, ch / video.videoHeight);
      const ox = (video.videoWidth * scale - cw) / 2;
      const oy = (video.videoHeight * scale - ch) / 2;
      return { x: (gx + ox) / scale, y: (gy + oy) / scale, w: gw / scale, h: gh / scale };
    }

    function grab(video: HTMLVideoElement, r: { x: number; y: number; w: number; h: number }, outWidth: number) {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, outWidth / r.w);
      canvas.width = Math.max(1, Math.round(r.w * scale));
      canvas.height = Math.max(1, Math.round(r.h * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.filter = "grayscale(1) contrast(1.5)";
      ctx.drawImage(video, r.x, r.y, r.w, r.h, 0, 0, canvas.width, canvas.height);
      return canvas;
    }

    async function scanOnce(attempt: number) {
      const video = videoRef.current;
      const container = containerRef.current;
      const worker = workerRef.current;
      if (!video || !container || !worker || !video.videoWidth) return;

      const g = guideRect(video, container);
      // Fast pass: just the bottom strip, where the collector number is.
      // Every other miss also tries the whole card so the name can match.
      const strip = { x: g.x, y: g.y + g.h * 0.78, w: g.w, h: g.h * 0.22 };
      const regions = attempt % 2 === 1 ? [strip, g] : [strip];

      for (const region of regions) {
        const canvas = grab(video, region, region === g ? 640 : 520);
        if (!canvas) continue;
        const { data } = await worker.recognize(canvas);
        if (cancelled || pendingRef.current) return;
        const found = matchScan(data.text, cards);
        if (!found) continue;

        const best = found.candidates[0];
        const last = lastAddedRef.current;
        if (last && last.id === best.id && Date.now() - last.at < SAME_CARD_COOLDOWN_MS) return;

        if (autoAddRef.current && found.via === "code") {
          commit(best);
        } else {
          pendingRef.current = found;
          setMatch(found);
          setShown(found);
          setPick(0);
        }
        return;
      }
    }

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("This browser can't access the camera (it needs HTTPS or localhost).");
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        setStatus("Loading text recognition (first time only)...");
        const { createWorker } = await import("tesseract.js");
        const worker = (await createWorker("eng")) as unknown as Worker;
        await worker.setParameters({ tessedit_pageseg_mode: "11" });
        if (cancelled) {
          worker.terminate();
          return;
        }
        workerRef.current = worker;
        setStatus("Fit the card in the frame");

        // Back-to-back scanning: start the next read as soon as the last one ends.
        let attempt = 0;
        while (!cancelled) {
          if (!pendingRef.current) {
            try {
              await scanOnce(attempt++);
            } catch {
              // a bad frame shouldn't kill the loop
            }
          }
          await new Promise((r) => setTimeout(r, 60));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not start the camera.");
      }
    }

    start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [cards, commit]);

  const chosen = shown?.candidates[pick] ?? null;
  const target = chosen ? targetPosition(chosen, slots) : null;
  const open = match !== null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 overflow-hidden bg-black">
      {error ? (
        <p className="p-6 text-sm text-red-400">{error}</p>
      ) : (
        <>
          <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-brand-gold/80"
            style={{
              aspectRatio: "744 / 1039",
              height: `min(78%, calc(92vw / ${CARD_RATIO}))`,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
            }}
          />
        </>
      )}

      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 pb-6 pt-4">
        <button onClick={onClose} className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/25">
          Done{addedCount > 0 ? ` (${addedCount})` : ""}
        </button>
        <label className="flex cursor-pointer items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-xs text-white backdrop-blur">
          <input type="checkbox" checked={autoAdd} onChange={(e) => setAutoAdd(e.target.checked)} />
          Auto-add
        </label>
      </div>

      {!error && (
        <p className="pointer-events-none absolute inset-x-0 top-16 text-center text-xs text-white/80">
          {toast ?? status}
        </p>
      )}

      <div
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-xl rounded-t-3xl border border-b-0 border-brand-gold/40 bg-panel p-4 pb-6 shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {chosen && target && (
          <>
            <div className="flex gap-3">
              <div className="relative aspect-[744/1039] w-20 shrink-0 overflow-hidden rounded-md bg-black">
                {chosen.image.url && <Image src={chosen.image.url} alt={chosen.image.alt} fill sizes="80px" className="object-cover" />}
              </div>
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-white">
                  {chosen.name}
                  {chosen.subtitle ? `, ${chosen.subtitle}` : ""}
                </p>
                <p className="text-xs text-white/50">{chosen.publicCode}</p>
                <p className="mt-1 text-xs text-brand-gold">
                  Page {Math.floor(target.position / perPage) + 1}, slot {(target.position % perPage) + 1}
                  {target.bump ? " (next free slot)" : ""}
                </p>
                {shown?.via === "name" && <p className="mt-1 text-[11px] text-white/40">Matched by name - check the print</p>}
              </div>
            </div>

            {shown && shown.candidates.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {shown.candidates.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => setPick(i)}
                    className={`rounded-md border px-2 py-1 text-[11px] ${
                      i === pick ? "border-brand-gold bg-brand-gold/10 text-brand-gold" : "border-white/10 text-white/60 hover:text-white"
                    }`}
                  >
                    {c.publicCode.replace(/\/.*/, "")}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => commit(chosen)}
                className="flex-1 rounded-full bg-brand-gold px-3 py-3 font-display text-sm font-semibold uppercase tracking-wide text-ink hover:bg-brand-goldSoft"
              >
                Add
              </button>
              <button
                onClick={() => dismiss(chosen)}
                className="rounded-full border border-white/15 px-5 py-3 text-sm text-white/70 hover:text-white"
              >
                Skip
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
