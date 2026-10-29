//* Utils Imports
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  /** Estrela dentro de um bloco sólido (lockup principal). Sem isso, sai só o glifo. */
  boxed?: boolean;
  /** Estrela facetada. Só para marcas grandes: abaixo de 32 px as facetas viram borrão. */
  faceted?: boolean;
  className?: string;
  starClassName?: string;
};

// Estrela soviética da identidade (viewBox "6 7 52 50"). As faces claras seguem `currentColor` e as
// de sombra ficam em chumbo, que funciona sobre piche e sobre osso.
const STAR_SOLID =
  "32,8 37.88,25.91 56.73,25.97 41.51,37.09 47.28,55.03 32,44 16.72,55.03 22.49,37.09 7.27,25.97 26.12,25.91";

const STAR_LIT_FACES = [
  "32,34 26.12,25.91 32,8",
  "32,34 37.88,25.91 56.73,25.97",
  "32,34 41.51,37.09 47.28,55.03",
  "32,34 32,44 16.72,55.03",
  "32,34 22.49,37.09 7.27,25.97",
];

const STAR_SHADE_FACES = [
  "32,34 32,8 37.88,25.91",
  "32,34 56.73,25.97 41.51,37.09",
  "32,34 47.28,55.03 32,44",
  "32,34 16.72,55.03 22.49,37.09",
  "32,34 7.27,25.97 26.12,25.91",
];

const CHUMBO = "#6e6e6e";

function FacetedStar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="6 7 52 50"
      aria-hidden="true"
      className={cn("fill-current", className)}
      focusable="false"
    >
      {STAR_LIT_FACES.map((points) => (
        <polygon key={points} points={points} />
      ))}
      {STAR_SHADE_FACES.map((points) => (
        <polygon key={points} points={points} fill={CHUMBO} />
      ))}
    </svg>
  );
}

function SolidStar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="6 7 52 50"
      aria-hidden="true"
      className={cn("fill-current", className)}
      focusable="false"
    >
      <polygon points={STAR_SOLID} />
    </svg>
  );
}

export function BrandMark({
  boxed = true,
  faceted = false,
  className,
  starClassName,
}: BrandMarkProps) {
  const Star = faceted ? FacetedStar : SolidStar;

  if (!boxed) {
    return <Star className={cn("size-5", className, starClassName)} />;
  }

  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg bg-foreground text-background",
        className,
      )}
    >
      <Star className={cn("size-[66%]", starClassName)} />
    </span>
  );
}

// Wordmark "TRUDX" da identidade, já em curvas (não depende da fonte carregada).
const WORDMARK_PATH =
  "M19 0H799V184H513V750H305V184H19Z M1055.0 480V750H848.0V0H1293.0Q1379.0 0 1443.0 30.5Q1507.0 61 1543.0 114.5Q1579.0 168 1579.0 241Q1579.0 312 1543.0 366.0Q1507.0 420 1443.0 450Q1418.0 462 1390.0 469L1605.0 750H1365.0L1163.0 480ZM1055.0 328H1264.0Q1314.0 328 1342.0 305.0Q1370.0 282 1370.0 241Q1370.0 199 1342.0 176.5Q1314.0 154 1264.0 154H1055.0Z M1855.0 415Q1855.0 466 1874.5 503.5Q1894.0 541 1932.5 561.0Q1971.0 581 2027.0 581Q2084.0 581 2122.0 561.0Q2160.0 541 2179.0 503.5Q2198.0 466 2198.0 415V0H2406.0V425Q2406.0 528 2358.5 604.5Q2311.0 681 2226.0 723.5Q2141.0 766 2027.0 766Q1914.0 766 1828.5 723.5Q1743.0 681 1695.5 604.5Q1648.0 528 1648.0 425V0H1855.0Z M2870.0 0Q3003.0 0 3103.5 46.5Q3204.0 93 3259.5 177.5Q3315.0 262 3315.0 375.0Q3315.0 488 3259.5 572.5Q3204.0 657 3103.5 703.5Q3003.0 750 2870.0 750H2496.0V0ZM2702.0 566H2886.0Q2953.0 566 3002.5 542.5Q3052.0 519 3079.0 476.0Q3106.0 433 3106.0 375Q3106.0 316 3079.0 273.5Q3052.0 231 3002.5 207.5Q2953.0 184 2886.0 184H2702.0Z M3876.0 360 4193.0 750H3938.0L3746.0 502L3553.0 750H3301.0L3620.0 360L3323.0 0H3582.0L3751.0 218L3917.0 0H4172.0Z";

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 4193 766"
      role="img"
      aria-label="trudx"
      className={cn("h-4 w-auto fill-current", className)}
    >
      <path d={WORDMARK_PATH} />
    </svg>
  );
}
