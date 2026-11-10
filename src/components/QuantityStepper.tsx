"use client";

const ACCENT_TEXT: Record<string, string> = {
  gold: "text-foil",
  cyan: "text-ok",
};

const ACCENT_RING: Record<string, string> = {
  gold: "focus-within:ring-foil/50",
  cyan: "focus-within:ring-ok/50",
};

export function QuantityStepper({
  value,
  onChange,
  accent = "gold",
  compact = false,
}: {
  value: number;
  onChange: (qty: number) => void;
  accent?: "gold" | "cyan";
  compact?: boolean;
}) {
  return (
    <div
      onClick={(e) => e.preventDefault()}
      className={`flex items-center gap-0.5 rounded-md bg-panel2 p-0.5 ring-1 ring-inset ring-white/10 transition focus-within:ring-2 ${ACCENT_RING[accent]}`}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className={`flex shrink-0 items-center justify-center rounded-md text-t3 transition hover:bg-cavity hover:text-t1 active:scale-90 ${compact ? "h-9 w-9 sm:h-7 sm:w-7" : "h-11 w-11 sm:h-9 sm:w-9"}`}
        aria-label="Decrease"
      >
        <span className="text-sm leading-none">−</span>
      </button>
      <input data-bare
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={`${compact ? "w-7" : "w-8"} shrink-0 appearance-none bg-transparent text-center text-sm font-bold tabular-nums outline-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${ACCENT_TEXT[accent]}`}
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className={`flex shrink-0 items-center justify-center rounded-md text-t3 transition hover:bg-cavity hover:text-t1 active:scale-90 ${compact ? "h-9 w-9 sm:h-7 sm:w-7" : "h-11 w-11 sm:h-9 sm:w-9"}`}
        aria-label="Increase"
      >
        <span className="text-sm leading-none">+</span>
      </button>
    </div>
  );
}
