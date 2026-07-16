/** Marca de agua «brújula-estela»: anillos concéntricos + aguja (firma Travesía). */
export function CompassWake({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 240" aria-hidden fill="none" stroke="currentColor" className={className}>
      <circle cx="120" cy="120" r="112" strokeWidth="1.5" />
      <circle cx="120" cy="120" r="78" strokeWidth="1.5" />
      <circle cx="120" cy="120" r="44" strokeWidth="1.5" />
      <polygon
        points="120,64 138,148 120,130 102,148"
        fill="currentColor"
        stroke="none"
        transform="rotate(42 120 120)"
      />
      <circle cx="120" cy="120" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
}
