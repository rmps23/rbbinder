// Loading placeholders that mirror the real layout, so the page doesn't jump when data arrives.
// Flat shapes with a soft pulse (the pulse is switched off by prefers-reduced-motion).

export function Sk({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-cavity/70 ${className}`} />;
}

function Busy({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <Busy label="Loading collection" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Sk className="h-8 w-44" />
        <div className="flex gap-2">
          <Sk className="h-11 w-32" />
          <Sk className="h-11 w-32" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Sk className="h-36 rounded-xl" />
        <Sk className="h-36 rounded-xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Sk className="h-72 rounded-xl" />
        <Sk className="h-72 rounded-xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Sk className="h-56 rounded-xl" />
        <Sk className="h-56 rounded-xl" />
      </div>
    </Busy>
  );
}

export function BindersSkeleton() {
  return (
    <Busy label="Loading binders" className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Sk className="h-8 w-40" />
          <Sk className="h-4 w-64" />
        </div>
        <Sk className="h-11 w-36" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 6 }, (_, i) => (
          <Sk key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </Busy>
  );
}

export function BulkSkeleton() {
  return (
    <Busy label="Loading bulk" className="flex flex-col gap-4">
      <Sk className="h-[200px] rounded-xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-line bg-panel">
            <Sk className="aspect-[744/1039] w-full rounded-none" />
            <div className="space-y-2 p-2.5">
              <Sk className="h-4 w-3/4" />
              <Sk className="h-3 w-1/2" />
              <Sk className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
    </Busy>
  );
}

export function BinderSkeleton() {
  return (
    <Busy label="Loading binder" className="flex flex-col gap-4">
      <Sk className="h-[132px] rounded-xl" />
      <div className="flex min-h-[460px] items-center justify-center gap-4 rounded-xl border border-line bg-ink p-4">
        <Sk className="h-14 w-14 rounded-full" />
        <div className="flex h-[420px] w-full max-w-[640px] gap-1">
          <Sk className="h-full flex-1 rounded-xl" />
          <Sk className="h-full flex-1 rounded-xl" />
        </div>
        <Sk className="h-14 w-14 rounded-full" />
      </div>
    </Busy>
  );
}

export function ListSkeleton({ label }: { label: string }) {
  return (
    <Busy label={label} className="flex flex-col gap-4">
      <Sk className="h-9 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Sk key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </Busy>
  );
}
