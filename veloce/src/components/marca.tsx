import { cn } from "@/lib/utils";
import { site } from "@/lib/site";

/**
 * Logotipo: la palabra en caja roja con el sufijo pequeño alineado abajo,
 * como en el documento comercial.
 */
export function Logotipo({
  className,
  invertido = false,
}: {
  className?: string;
  invertido?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 px-2.5 py-1 font-extrabold tracking-[-0.05em]",
        invertido ? "bg-papel text-tinta" : "bg-marca text-tinta",
        className,
      )}
    >
      <span className="text-xl leading-none">{site.marca.toUpperCase()}</span>
      <span className="text-[0.5rem] font-bold tracking-[0.1em] leading-none">
        {site.marcaSufijo.toUpperCase()}
      </span>
    </span>
  );
}
