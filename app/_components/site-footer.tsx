//* Components Imports
import { BrandMark } from "./brand-mark";

export function SiteFooter() {
  return (
    <footer className="bg-background">
      <div className="mx-auto flex max-w-[92rem] flex-col gap-4 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <BrandMark className="size-7" />
          <span className="text-sm text-foreground font-semibold tracking-[-0.03em]">trudx</span>
        </div>

        <p className="text-xs text-muted-foreground">
          Desenvolvido por{" "}
          <a
            href="https://kayky.dev.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            Kayky
          </a>{" "}
          · sistemas sob medida
        </p>
      </div>
    </footer>
  );
}
