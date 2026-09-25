"use client";

export function QuantityStepper({
  value,
  onChange,
  accent = "amber",
}: {
  value: number;
  onChange: (qty: number) => void;
  accent?: "amber" | "sky";
}) {
  const accentClasses =
    accent === "amber"
      ? "focus:border-amber-400 hover:border-amber-400/50"
      : "focus:border-sky-400 hover:border-sky-400/50";

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
        aria-label="Diminuir"
      >
        −
      </button>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={`h-7 w-12 rounded-md border border-white/10 bg-[#0d0f14] text-center text-sm text-white outline-none ${accentClasses}`}
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
        aria-label="Aumentar"
      >
        +
      </button>
    </div>
  );
}
