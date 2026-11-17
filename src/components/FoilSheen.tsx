// Holographic sheen laid over a card picture for foil cards. Put it inside the `relative` box that holds the art.
export function FoilSheen({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`foil-sheen pointer-events-none absolute inset-0 z-[3] rounded-[inherit] ${className}`} />;
}
