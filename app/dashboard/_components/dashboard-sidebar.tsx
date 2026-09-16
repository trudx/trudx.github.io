"use client";

//* Components Imports
import Button from "@/components/ui/button";

import { BrandMark } from "@/app/_components/brand-mark";

import { ThemeToggle } from "./theme-toggle";

//* Libraries Imports
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, KanbanSquare, LayoutDashboard, LogOut, Settings, UsersRound, Wallet } from "lucide-react";

//* Hooks Imports
import { useLogout } from "@/hooks/use-logout";

//* Utils Imports
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/dashboard/clients", label: "Clientes", icon: UsersRound },
  { href: "/dashboard/tasks", label: "Tarefas", icon: KanbanSquare },
  { href: "/dashboard/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/dashboard/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/dashboard/settings", label: "Configurações", icon: Settings },
];

// Painel no estilo do Figma: cabeçalho de arquivo, rótulo de seção pequeno e itens de 28px com
// seleção em bloco suave — denso, sem competir com o conteúdo.
export function DashboardSidebar() {
  const pathname = usePathname();
  const { logout, isLoading } = useLogout();

  return (
    <div className="flex min-h-0 flex-col gap-4 lg:sticky lg:top-0 lg:h-dvh lg:py-3">
      <Link
        href="/dashboard"
        className="flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
        aria-label="Ir para a visão geral"
      >
        <BrandMark className="size-6 rounded-md" />
        <span className="text-[0.8rem] font-semibold tracking-[-0.01em] text-foreground">trudx</span>
        <span className="ml-auto rounded-sm bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
          Free
        </span>
      </Link>

      <nav
        className="-mx-1 flex gap-0.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
        aria-label="Navegação principal"
      >
        <p className="trudx-kicker mb-1 hidden px-2 lg:block">Páginas</p>

        {navigation.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;

          return (
            <Button
              key={href}
              variant="ghost"
              size="sm"
              render={<Link href={href} aria-current={isActive ? "page" : undefined} />}
              className={cn(
                "h-7 shrink-0 justify-start gap-2 px-2 text-xs font-normal text-foreground/80",
                isActive && "bg-accent font-medium text-foreground hover:bg-accent",
              )}
            >
              <Icon className={cn("size-3.5 text-muted-foreground", isActive && "text-foreground")} />
              <span>{label}</span>
            </Button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-1 border-t pt-3">
        <ThemeToggle />

        <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <BrandMark className="size-6 rounded-full" />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">Minha conta</p>
            <p className="truncate text-[0.65rem] text-muted-foreground">Plano gratuito</p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isLoading}
          onClick={() => void logout()}
          className="h-7 w-full justify-start gap-2 px-2 text-xs font-normal text-foreground/80"
        >
          <LogOut className="size-3.5 text-muted-foreground" />
          <span>{isLoading ? "Saindo..." : "Sair"}</span>
        </Button>

        <p className="px-2 pt-2 text-[0.65rem] text-muted-foreground">
          por{" "}
          <a
            href="https://kayky.dev.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:text-foreground hover:underline"
          >
            Kayky
          </a>
        </p>
      </div>
    </div>
  );
}
