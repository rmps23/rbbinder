// The head of every page: a mono kicker, the title, and a mono line of facts. Actions go on the right.
export function PageHead({ title, kicker, meta, right }: { title: string; kicker?: string; meta?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {kicker && (
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-t3">
            <span className="mr-2 text-brand-gold">/</span>
            {kicker}
          </p>
        )}
        <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-t1">{title}</h1>
        {meta && <p className="mt-1.5 font-mono text-xs text-t3">{meta}</p>}
      </div>
      {right}
    </header>
  );
}
