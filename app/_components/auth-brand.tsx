//* Components Imports
import { BrandMark } from "./brand-mark";

//* Utils Imports
import { cn } from "@/lib/utils";

// Lockup da marca: estrela em bloco sólido + logotipo em display com tracking aberto.
export function AuthBrand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark />
      <span className="text-xl leading-none text-foreground font-semibold tracking-[-0.03em]">
        trudx
      </span>
    </div>
  );
}
