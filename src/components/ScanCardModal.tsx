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

const SCAN_INTERVAL_MS = 1400;
const SAME_CARD_COOLDOWN_MS = 4000;

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const busyRef = useRef(false);
  const pendingRef = useRef<ScanMatch | null>(null);
  const lastAddedRef = useRef<{ id: string; at: number } | null>(null);
  const onAddRef = useRef(onAdd);
  onAddRef.current = onAdd;
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const [status, setStatus] = useState("Starting camera...");
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<ScanMatch | null>(null);
  const [pick, setPick] = useState(0);
  const [autoAdd, setAutoAdd] = useState(false);
  const autoAddRef = useRef(autoAdd);
  autoAddRef.current = autoAdd;
  const [recent, setRecent] = useState<{ card: RiftCard; position: number }[]>([]);

  const commit = useCallback(
    (card: RiftCard) => {
      const { position } = targetPosition(card, slotsRef.current);
      onAddRef.current(card, position);
      lastAddedRef.current = { id: card.id, at: Date.now() };
      setRecent((r) => [{ card, position }, ...r].slice(0, 8));
      pendingRef.current = null;
      setMatch(null);
      setPick(0);
    },
    []
  );

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
    let timer: number | undefined;

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
        setStatus("Point the camera at a card");
        timer = window.setInterval(scanOnce, SCAN_INTERVAL_MS);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not start the camera.");
      }
    }

    async function scanOnce() {
      const video = videoRef.current;
      const worker = workerRef.current;
      if (!video || !worker || busyRef.current || pendingRef.current || !video.videoWidth) return;
      busyRef.current = true;
      try {
        // Crop to the on-screen guide frame (centered, card-shaped).
        const guideH = video.videoHeight * 0.92;
        const guideW = guideH * (744 / 1039);
        const sx = (video.videoWidth - guideW) / 2;
        const sy = (video.videoHeight - guideH) / 2;
        const scale = Math.min(1, 1100 / guideH);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(guideW * scale);
        canvas.height = Math.round(guideH * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, sx, sy, guideW, guideH, 0, 0, canvas.width, canvas.height);

        const { data } = await worker.recognize(canvas);
        const found = matchScan(data.text, cards);
        if (!found) return;

        const best = found.candidates[0];
        const last = lastAddedRef.current;
        if (last && last.id === best.id && Date.now() - last.at < SAME_CARD_COOLDOWN_MS) return;

        if (autoAddRef.current && found.via === "code") {
          commit(best);
        } else {
          pendingRef.current = found;
          setMatch(found);
          setPick(0);
        }
      } finally {
        busyRef.current = false;
      }
    }

    start();
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [cards, commit]);

  const chosen = match?.candidates[pick] ?? null;
  const target = chosen ? targetPosition(chosen, slots) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3" onClick={onClose}>
      <div
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-white">Scan cards</h2>
          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-white/60">
              <input type="checkbox" checked={autoAdd} onChange={(e) => setAutoAdd(e.target.checked)} />
              Auto-add when the number is read
            </label>
            <button onClick={onClose} className="rounded-md px-2 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white">
              Done
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[1fr_260px]">
          <div className="relative overflow-hidden rounded-xl bg-black">
            {error ? (
              <p className="p-6 text-sm text-red-400">{error}</p>
            ) : (
              <>
                <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
                <div
                  className="pointer-events-none absolute inset-y-[4%] left-1/2 aspect-[744/1039] -translate-x-1/2 rounded-lg border-2 border-brand-gold/80"
                  style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }}
                />
                <p className="absolute inset-x-0 bottom-2 text-center text-xs text-white/80">{status}</p>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {chosen && target ? (
              <div className="rounded-xl border border-brand-gold/40 bg-ink p-3">
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
                    {match?.via === "name" && <p className="mt-1 text-[11px] text-white/40">Matched by name - check the print</p>}
                  </div>
                </div>

                {match && match.candidates.length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {match.candidates.map((c, i) => (
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
                    className="flex-1 rounded-full bg-brand-gold px-3 py-2 font-display text-sm font-semibold uppercase tracking-wide text-ink hover:bg-brand-goldSoft"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      pendingRef.current = null;
                      lastAddedRef.current = { id: chosen.id, at: Date.now() };
                      setMatch(null);
                    }}
                    className="rounded-full border border-white/15 px-3 py-2 text-sm text-white/70 hover:text-white"
                  >
                    Skip
                  </button>
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/40">
                Fit the card inside the gold frame, flat and without glare. The number printed on the card (like 042/298) is read automatically.
              </p>
            )}

            {recent.length > 0 && (
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-white/40">Added this session</p>
                <ul className="space-y-1 text-xs text-white/70">
                  {recent.map((r, i) => (
                    <li key={`${r.card.id}-${i}`} className="flex justify-between gap-2">
                      <span className="truncate">{r.card.name}</span>
                      <span className="shrink-0 text-white/40">{r.card.publicCode.replace(/\/.*/, "")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
