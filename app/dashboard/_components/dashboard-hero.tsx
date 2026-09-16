"use client";

//* Components Imports
import Skeleton from "@/components/ui/skeleton";
import Switch from "@/components/ui/switch";
import Tooltip from "@/components/ui/tooltip";

import { InstallAppButton } from "@/components/install-app-button";

//* Libraries Imports
import Image from "next/image";
import { LayoutDashboard } from "lucide-react";

//* Hooks Imports
import { useDashboardBackground } from "@/hooks/use-dashboard-background";

//* Types Imports
import type { StaticImageData } from "next/image";
import type { ReactNode } from "react";
import type { GreetingPeriod } from "@/lib/greeting";

//* Constants Imports
import imagemManha from "../_assets/manha.webp";
import imagemNoite from "../_assets/noite.webp";
import imagemTarde from "../_assets/tarde.webp";

//* Utils Imports
import { cn } from "@/lib/utils";

// Import estático (e não `/manha.png` do public): o caminho já sai com o basePath do GitHub Pages
// e a versão WebP pesa ~100KB contra ~2MB do PNG original.
const IMAGE_BY_PERIOD: Record<GreetingPeriod, StaticImageData> = {
  madrugada: imagemNoite,
  manha: imagemManha,
  tarde: imagemTarde,
  noite: imagemNoite,
};

type DashboardHeroProps = {
  period: GreetingPeriod;
  greeting: string;
  formattedDate: string;
  description: string;
  isLoading: boolean;
  /** Conteúdo que fica sobre a ilustração, logo abaixo do cabeçalho (ex.: os indicadores). */
  children?: ReactNode;
};

export function DashboardHero({
  period,
  greeting,
  formattedDate,
  description,
  isLoading,
  children,
}: DashboardHeroProps) {
  const { isEnabled, setEnabled } = useDashboardBackground();

  return (
    <div className="relative isolate overflow-hidden">
      <Image
        src={IMAGE_BY_PERIOD[period]}
        alt=""
        aria-hidden="true"
        fill
        placeholder="blur"
        sizes="100vw"
        className={cn(
          "pointer-events-none -z-10 object-cover transition-opacity duration-500 ease-in-out",
          isEnabled ? "opacity-45 dark:opacity-40" : "opacity-0",
        )}
      />
      {/* Esmaece a ilustração na metade de baixo, pra ela terminar dissolvida no fundo da página. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-t from-background from-0% via-background/40 via-45% to-transparent"
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-9 px-4 pt-7 pb-10 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <span className="flex size-7 items-center justify-center rounded-md bg-background/70 backdrop-blur">
                <LayoutDashboard className="size-3.5" />
              </span>
              Visão geral
            </div>

            <div className="flex items-center gap-3">
              <InstallAppButton
                variant="outline"
                size="lg"
                className="h-8 bg-background/70 px-3 text-xs font-medium backdrop-blur"
              />
              <div className="flex items-center gap-2 rounded-md bg-background/70 px-2.5 py-1.5 backdrop-blur">
                <label htmlFor="dashboard-background-switch" className="text-xs font-medium">
                  Imagem de fundo
                </label>
                <Tooltip.TooltipRoot>
                  <Tooltip.TooltipTrigger
                    render={
                      <Switch
                        id="dashboard-background-switch"
                        size="sm"
                        checked={isEnabled}
                        onCheckedChange={setEnabled}
                      />
                    }
                  />
                  <Tooltip.TooltipContent side="bottom" sideOffset={8}>
                    Imagem de fundo {isEnabled ? "ativada" : "desativada"}. Clique para{" "}
                    {isEnabled ? "desativar" : "ativar"}.
                  </Tooltip.TooltipContent>
                </Tooltip.TooltipRoot>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {isLoading || !greeting ? (
              <Skeleton className="h-10 w-72" />
            ) : (
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
                {greeting}
              </h1>
            )}
            <p className="text-sm text-foreground/70 first-letter:uppercase">{formattedDate}</p>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-foreground/80">{description}</p>
        </header>

        {children}
      </div>
    </div>
  );
}
