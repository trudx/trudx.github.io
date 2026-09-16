//* Components Imports
import Button from "@/components/ui/button";

import { AuthBrand } from "./auth-brand";
import { BrandMark } from "./brand-mark";
import { SiteFooter } from "./site-footer";

//* Libraries Imports
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

//* Types Imports
import type { ReactNode } from "react";

type AuthShellProps = {
  kicker: string;
  title: ReactNode;
  description: string;
  children: ReactNode;
};

// Login e cadastro compartilham a mesma composição de cartaz (bloco sólido à esquerda, formulário
// à direita). Uma casca só evita que as duas telas saiam do compasso quando uma for ajustada.
export function AuthShell({ kicker, title, description, children }: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b">
        <nav className="mx-auto flex max-w-[92rem] items-center justify-between px-5 py-3.5 sm:px-8 lg:px-12">
          <AuthBrand />
          <Button render={<Link href="/" />} variant="ghost" className="h-9 gap-2 px-3 text-xs font-semibold">
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        </nav>
      </header>

      <div className="mx-auto grid w-full max-w-[92rem] flex-1 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="p-3 lg:p-4">
          <div className="relative h-full overflow-hidden rounded-2xl bg-foreground px-6 py-12 text-background sm:px-10 lg:py-16">
            <BrandMark
              boxed={false}
              className="pointer-events-none absolute -right-16 -bottom-20 size-[22rem] rotate-12 text-background/[0.04]"
            />

            <div className="relative flex h-full flex-col justify-between gap-12">
              <div>
                <p className="trudx-kicker text-background/60">{kicker}</p>
                <h1 className="mt-7 max-w-xl text-4xl leading-[1.06] sm:text-5xl font-semibold tracking-[-0.03em]">
                  {title}
                </h1>
                <p className="mt-7 max-w-md text-sm leading-6 text-background/75">{description}</p>
              </div>

              <p className="border-t border-background/30 pt-5 text-xs text-background/60">
                Clientes · Tarefas · Agenda · Financeiro
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
          <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm sm:p-8">{children}</div>
        </section>
      </div>

      <div className="border-t">
        <SiteFooter />
      </div>
    </main>
  );
}
