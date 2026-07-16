import { cn } from "@/lib/utils";

/**
 * Etiqueta de sección Travesía: versalitas espaciadas con doble regla
 * (herencia editorial de la dirección de arte, ver PRD §8-F4.5).
 */
export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "border-foreground/60 inline-block border-b-[3px] border-double pb-2 font-sans text-[11px] font-bold tracking-[0.2em] uppercase",
        className
      )}
    >
      {children}
    </h2>
  );
}
