//* Utils Imports
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  /** Estrela vazada dentro de um bloco sólido (lockup principal). Sem isso, sai só o glifo. */
  boxed?: boolean;
  className?: string;
  starClassName?: string;
};

// Pentagrama de 5 pontas com raio interno em 0,4 do externo — a proporção "cheia" da estrela
// construtivista, não a estrela fina de ícone genérico.
const STAR_PATH =
  "M12 2 L14.35 8.76 L21.51 8.91 L15.8 13.24 L17.88 20.09 L12 16 L6.12 20.09 L8.2 13.24 L2.49 8.91 L9.65 8.76 Z";

export function BrandMark({ boxed = true, className, starClassName }: BrandMarkProps) {
  const star = (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-[62%] fill-current", starClassName)}
      focusable="false"
    >
      <path d={STAR_PATH} />
    </svg>
  );

  if (!boxed) {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={cn("size-5 fill-current", className, starClassName)}
        focusable="false"
      >
        <path d={STAR_PATH} />
      </svg>
    );
  }

  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-md bg-foreground text-background",
        className,
      )}
    >
      {star}
    </span>
  );
}
