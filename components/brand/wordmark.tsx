import { cn } from "@/lib/utils";

/** La «O» de RUMBO: circunferencia con aguja de compás (naranja señal). */
export function BrandO({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={cn("inline-block h-[0.78em] w-auto", className)}
    >
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="5" />
      <polygon
        points="16,7 20.5,20.5 16,17.5 11.5,20.5"
        transform="rotate(42 16 16)"
        className="fill-signal"
      />
    </svg>
  );
}

/**
 * Wordmark de RUMBO: «RUMB» en Bricolage Grotesque 800 + O-aguja.
 * El tamaño se controla con `text-*` en className (el icono escala en em).
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-brand inline-flex items-center leading-none font-extrabold tracking-tight",
        className,
      )}
    >
      <span aria-hidden>RUMB</span>
      <BrandO className="ml-[0.05em] translate-y-[0.02em]" />
      <span className="sr-only">RUMBO</span>
    </span>
  );
}
