"use client";

const ACCENT_TEXT: Record<string, string> = {
  gold: "text-brand-gold",
  cyan: "text-brand-cyan",
};

const ACCENT_RING: Record<string, string> = {
  gold: "focus-within:ring-brand-gold/50",
  cyan: "focus-within:ring-brand-cyan/50",
};

export function QuantityStepper({
  value,
  onChange,
  accent = "gold",
}: {
  value: number;
  onChange: (qty: number) => void;
  accent?: "gold" | "cyan";
}) {
  return (
    <div
      onClick={(e) => e.preventDefault()}
      className={`flex items-center gap-0.5 rounded-full bg-white/5 p-0.5 ring-1 ring-inset ring-white/10 transition focus-within:ring-2 ${ACCENT_RING[accent]}`}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white active:scale-90"
        aria-label="Decrease"
      >
        <span className="text-sm leading-none">−</span>
      </button>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={`w-7 shrink-0 appearance-none bg-transparent text-center text-sm font-bold tabular-nums outline-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${ACCENT_TEXT[accent]}`}
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white active:scale-90"
        aria-label="Increase"
      >
        <span className="text-sm leading-none">+</span>
      </button>
    </div>
  );
}
