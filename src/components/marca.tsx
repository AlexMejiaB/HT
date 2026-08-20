import { cn } from "@/lib/utils";

/**
 * Logotipo. El símbolo son tres nodos conectados —una ramificación— y el
 * wordmark va en grotesca pesada, como el original. Se dibuja en SVG en vez de
 * usar el JPG para que quede nítido a cualquier tamaño y herede el color.
 */
export function Logotipo({
  className,
  tamano = "base",
}: {
  className?: string;
  tamano?: "base" | "grande";
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span
        className={cn(
          "font-marca font-extrabold tracking-[-0.03em] text-tinta",
          tamano === "grande" ? "text-4xl sm:text-5xl" : "text-xl",
        )}
      >
        Highticket
      </span>
      <Simbolo className={tamano === "grande" ? "h-10" : "h-5"} />
    </span>
  );
}

/** El símbolo suelto, para usarlo como marca de agua o viñeta. */
export function Simbolo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 60 110"
      fill="none"
      aria-hidden="true"
      className={cn("w-auto text-marca", className)}
    >
      <path
        d="M14 55 L46 14 M14 55 L46 96"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="14" cy="55" r="13" fill="currentColor" />
      <circle cx="46" cy="14" r="13" fill="currentColor" />
      <circle cx="46" cy="96" r="13" fill="currentColor" />
    </svg>
  );
}
