//* Components Imports
import { BrandMark, BrandWordmark } from "./brand-mark";

//* Utils Imports
import { cn } from "@/lib/utils";

// Lockup da marca (assinatura horizontal): estrela em bloco sólido + wordmark da identidade.
export function AuthBrand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark />
      <BrandWordmark className="h-4 text-foreground" />
    </div>
  );
}
