"use client";

type LegendItem = { label: string; color: string; dashed?: boolean };

/** Legenda sempre presente (identidade nunca só pela cor). */
export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-0.5 w-4 rounded-full"
            style={
              item.dashed
                ? {
                    background: `repeating-linear-gradient(90deg, ${item.color} 0 4px, transparent 4px 7px)`,
                  }
                : { background: item.color, height: "0.5rem", width: "0.5rem", borderRadius: 2 }
            }
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
