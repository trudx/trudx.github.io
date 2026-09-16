"use client";

//* Components Imports
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Collapsible from "@/components/ui/collapsible";

import { InstallAppButton } from "@/components/install-app-button";

import { AuthBrand } from "./auth-brand";
import { BrandMark } from "./brand-mark";
import { SiteFooter } from "./site-footer";

//* Libraries Imports
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Briefcase,
  CalendarDays,
  Check,
  Clock,
  Code2,
  KanbanSquare,
  Megaphone,
  Palette,
  ShieldCheck,
  UsersRound,
  Wallet,
  Wallet2,
  Zap,
} from "lucide-react";

type ModuleItem = {
  index: string;
  icon: typeof UsersRound;
  title: string;
  description: string;
  image: string;
  alt: string;
};

const modules: ModuleItem[] = [
  {
    index: "01",
    icon: UsersRound,
    title: "Clientes",
    description: "Cadastre, edite e busque sua carteira de clientes, com indicadores de quem está ativo ou inativo.",
    image: "https://images.unsplash.com/photo-1758518730384-be3d205838e8?auto=format&fit=crop&q=80&w=800",
    alt: "Aperto de mão profissional entre dois parceiros de negócio",
  },
  {
    index: "02",
    icon: KanbanSquare,
    title: "Tarefas",
    description: "Um Kanban com colunas que você mesmo configura, e arrasta e solta pra acompanhar cada entrega.",
    image: "https://images.unsplash.com/photo-1611224885990-ab7363d1f2a9?auto=format&fit=crop&q=80&w=800",
    alt: "Post-its organizados em colunas de tarefa a fazer, em andamento e concluída",
  },
  {
    index: "03",
    icon: Wallet,
    title: "Financeiro",
    description:
      "Extrato de gastos, gastos fixos recorrentes e ganhos — inclusive importando o extrato do seu banco em OFX.",
    image: "https://images.unsplash.com/photo-1767424412548-1a1ac7f4b9bc?auto=format&fit=crop&q=80&w=800",
    alt: "Telas com gráficos de análise financeira",
  },
];

type ValueItem = {
  index: string;
  icon: typeof Zap;
  title: string;
  description: string;
};

const values: ValueItem[] = [
  {
    index: "01",
    icon: Zap,
    title: "Sem complicação",
    description:
      "Sem setup de horas, sem curva de aprendizado. Você cria a conta e já sai usando — sem tutorial obrigatório.",
  },
  {
    index: "02",
    icon: Wallet2,
    title: "Sem custo, sem pegadinha",
    description:
      "É grátis e ponto. Não tem plano premium escondido, não tem cobrança por usuário, não tem limite que some do dia pra noite.",
  },
  {
    index: "03",
    icon: ShieldCheck,
    title: "Seus dados, seu controle",
    description:
      "Tudo fica no Supabase com criptografia e login protegido. Nada de lock-in: seus dados são seus, pra sempre.",
  },
];

type StepItem = {
  number: string;
  title: string;
  description: string;
};

const steps: StepItem[] = [
  {
    number: "01",
    title: "Crie sua conta",
    description: "Menos de 1 minuto, com e-mail e senha. Sem cartão de crédito, sem confirmação por telefone.",
  },
  {
    number: "02",
    title: "Cadastre seus clientes",
    description:
      "Adicione nome, contato e status. A busca e os indicadores de ativo/inativo já estão prontos pra usar.",
  },
  {
    number: "03",
    title: "Organize o resto",
    description: "Suba tarefas pro Kanban, marque compromissos na agenda e controle o financeiro no mesmo lugar.",
  },
];

type PersonaItem = {
  icon: typeof Palette;
  label: string;
};

const personas: PersonaItem[] = [
  { icon: Palette, label: "Designers freelancers" },
  { icon: Code2, label: "Devs e programadores" },
  { icon: Megaphone, label: "Social media e marketing" },
  { icon: Briefcase, label: "Consultores e coaches" },
  { icon: Zap, label: "Prestadores de serviço" },
  { icon: UsersRound, label: "Pequenos negócios" },
];

const planFeatures: string[] = [
  "Cadastro ilimitado de clientes",
  "Kanban de tarefas com colunas configuráveis",
  "Agenda integrada com seus compromissos",
  "Financeiro com extrato, fixos e importação OFX",
  "Login seguro com Supabase Auth",
  "Acesso por qualquer dispositivo",
];

type FaqItem = {
  question: string;
  answer: string;
};

const faqItems: FaqItem[] = [
  {
    question: "É realmente grátis? Tem alguma pegadinha?",
    answer:
      "É grátis, sem letras miúdas. Não existe plano premium, não existe versão de teste com data pra expirar e não cobramos nada pelo que está no app hoje. O trudx é mantido como projeto independente.",
  },
  {
    question: "Preciso cadastrar cartão de crédito?",
    answer: "Não. Você cria a conta só com e-mail e senha — sem cartão, sem boleto, sem Pix pra liberar acesso.",
  },
  {
    question: "Vai continuar grátis no futuro?",
    answer:
      "A ideia é manter o núcleo do produto sempre gratuito. Se um dia surgir algo opcional e pago, será algo novo, nunca o que já funciona hoje.",
  },
  {
    question: "Meus dados estão seguros?",
    answer:
      "Sim. A autenticação e o banco usam o Supabase, com criptografia em trânsito e em repouso. Você pode editar ou apagar qualquer registro quando quiser — seus dados são seus.",
  },
];

const dossie = [
  { label: "Módulos", value: "04" },
  { label: "Mensalidade", value: "R$ 0" },
  { label: "Cartão", value: "Não" },
  { label: "Limite de clientes", value: "∞" },
];

export function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <nav className="mx-auto flex max-w-[92rem] items-center justify-between px-5 py-3.5 sm:px-8 lg:px-12">
          <AuthBrand />

          <div className="flex items-center gap-2">
            <Button
              render={<Link href="/login" />}
              variant="ghost"
              className="hidden h-9 px-3 text-xs font-semibold sm:inline-flex"
            >
              Entrar
            </Button>
            <Button render={<Link href="/signup" />} variant="foreground" className="h-9 px-4 text-xs font-semibold">
              Criar conta
            </Button>
          </div>
        </nav>
      </header>

      <div className="h-[93vh] flex flex-col">
        {/* ── 01 · Manifesto ─────────────────────────────────────────────── */}
        <section className="border-b h-full">
          <div className="mx-auto grid max-w-[92rem] lg:grid-cols-[1.15fr_0.85fr] h-full">
            <div className="px-5 py-14 sm:px-8 lg:border-r lg:px-12 lg:py-20">
              <p className="trudx-kicker text-muted-foreground">Manifesto</p>

              <h1 className="mt-7 text-5xl leading-[1.04] text-foreground sm:text-6xl lg:text-[4.2rem] font-semibold tracking-[-0.03em]">
                Menos planilha.
                <span className="block text-muted-foreground">Mais trabalho entregue.</span>
              </h1>

              <div className="mt-9 grid gap-8 sm:grid-cols-[auto_1fr] sm:items-start">
                <BrandMark className="size-14" />
                <p className="max-w-md text-base leading-7 text-muted-foreground">
                  O <span className="font-semibold text-foreground">trudx</span> reúne clientes, tarefas, agenda e
                  financeiro sob uma única ordem — feito pra quem toca o negócio sozinho e não quer pagar mensalidade de
                  ferramenta corporativa.
                </p>
              </div>

              <div className="mt-10 flex flex-wrap gap-2.5">
                <Button
                  render={<Link href="/signup" />}
                  variant="foreground"
                  size="lg"
                  className="h-10 px-4 text-xs font-semibold"
                >
                  Criar conta grátis
                  <ArrowUpRight className="size-4 transition-transform duration-200 group-hover/button:translate-x-0.5 group-hover/button:-translate-y-0.5" />
                </Button>
                <Button
                  render={<Link href="/login" />}
                  variant="outline"
                  size="lg"
                  className="h-10 px-4 text-xs font-semibold"
                >
                  Já tenho conta
                </Button>
                <InstallAppButton variant="ghost" size="lg" className="h-10 px-4 text-xs font-semibold" />
              </div>

              <p className="mt-8 flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
                <Check className="size-3.5" strokeWidth={3} />
                Sem mensalidade · Sem validade · Sem letras miúdas
              </p>
            </div>

            {/* Cartaz: bloco sólido, estrela em escala e ficha técnica em mono. */}
            <aside className="p-3 lg:p-4">
              <div className="relative h-full overflow-hidden rounded-2xl bg-foreground text-background">
                <BrandMark
                  boxed={false}
                  className="pointer-events-none absolute -top-16 -right-20 size-[26rem] rotate-12 text-background/[0.04]"
                />

                <div className="relative flex h-full flex-col justify-between gap-12 px-5 py-14 sm:px-8 lg:px-10 lg:py-20">
                  <div>
                    <p className="trudx-kicker text-background/60">Plano único</p>
                    <p className="mt-5 text-7xl leading-none font-semibold tracking-[-0.03em]">R$ 0</p>
                    <p className="mt-3 text-xs text-background/70">Para sempre · Sem cartão</p>
                  </div>

                  <dl className="border-t border-background/30">
                    {dossie.map(({ label, value }) => (
                      <div
                        key={label}
                        className="flex items-baseline justify-between gap-4 border-b border-background/15 py-3"
                      >
                        <dt className="text-xs text-background/60">{label}</dt>
                        <dd className="text-xl font-semibold tracking-[-0.03em]">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* Faixa de módulos: barra sólida, itens separados por estrela. */}
        <div className="overflow-hidden border-b bg-foreground text-background">
          <div className="mx-auto flex max-w-[92rem] flex-wrap items-center justify-center gap-x-6 gap-y-2 px-5 py-3.5 sm:px-8 lg:px-12">
            {[
              { icon: UsersRound, label: "Clientes" },
              { icon: KanbanSquare, label: "Tarefas" },
              { icon: CalendarDays, label: "Agenda" },
              { icon: Wallet, label: "Financeiro" },
            ].map(({ icon: Icon, label }, index) => (
              <div key={label} className="flex items-center gap-6">
                {index > 0 ? <BrandMark boxed={false} className="size-3 text-background/50" /> : null}
                <span className="flex items-center gap-2 text-xs font-semibold">
                  <Icon className="size-3.5" strokeWidth={2.5} />
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 02 · Princípios ────────────────────────────────────────────── */}
      <section className="border-b">
        <div className="mx-auto grid max-w-[92rem] lg:grid-cols-[0.34fr_0.66fr]">
          <div className="px-5 py-12 sm:px-8 lg:border-r lg:px-12 lg:py-20">
            <p className="trudx-kicker text-muted-foreground">Princípios</p>
            <h2 className="mt-6 text-3xl leading-[1.1] text-foreground lg:text-5xl font-semibold tracking-[-0.03em]">
              Feito pra quem toca o negócio sozinho
            </h2>
            <p className="mt-6 max-w-sm text-sm leading-6 text-muted-foreground">
              A maioria das ferramentas obriga você a escolher entre pagar caro, perder horas configurando ou aceitar um
              app raso demais. Aqui a proposta é outra: tudo que importa, sem custo e sem barreira.
            </p>
          </div>

          <div className="grid sm:grid-cols-3">
            {values.map(({ index, icon: Icon, title, description }) => (
              <article
                key={title}
                className="group border-b /15 px-5 py-10 transition-colors last:border-b-0 hover:bg-muted sm:border-b-0 sm:border-r sm:px-7 sm:last:border-r-0 lg:px-8 lg:py-14"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center bg-foreground text-background">
                    <Icon className="size-4" strokeWidth={2.3} />
                  </span>
                  <span className="text-sm font-semibold text-foreground/25">{index}</span>
                </div>
                <h3 className="mt-7 text-xl leading-tight text-foreground font-semibold tracking-[-0.03em]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 03 · Procedimento ──────────────────────────────────────────── */}
      <section className="border-b bg-muted/40">
        <div className="mx-auto max-w-[92rem] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
          <div className="flex flex-wrap items-end justify-between gap-6 border-b pb-5">
            <p className="trudx-kicker text-muted-foreground">Procedimento</p>
            <h2 className="text-3xl leading-none text-foreground lg:text-4xl font-semibold tracking-[-0.03em]">
              Em três passos você já está usando
            </h2>
          </div>

          <div className="grid md:grid-cols-3">
            {steps.map(({ number, title, description }) => (
              <article
                key={number}
                className="border-b border-foreground/20 px-0 py-8 last:border-b-0 md:border-b-0 md:border-r md:px-8 md:py-12 md:first:pl-0 md:last:border-r-0 md:last:pr-0"
              >
                <span className="block text-6xl leading-none text-foreground/20 lg:text-7xl font-semibold tracking-[-0.03em]">
                  {number}
                </span>
                <div className="mt-6 border-t pt-5">
                  <h3 className="text-xl leading-tight text-foreground font-semibold tracking-[-0.03em]">{title}</h3>
                  <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 04 · Módulos ───────────────────────────────────────────────── */}
      <section className="border-b">
        <div className="mx-auto max-w-[92rem]">
          <div className="flex flex-wrap items-end justify-between gap-6 border-b px-5 py-10 sm:px-8 lg:px-12">
            <p className="trudx-kicker text-muted-foreground">Módulos</p>
            <h2 className="text-3xl leading-none text-foreground lg:text-4xl font-semibold tracking-[-0.03em]">
              Três frentes, um só login
            </h2>
          </div>

          <div className="grid sm:grid-cols-3">
            {modules.map(({ index, icon: Icon, title, description, image, alt }) => (
              <article
                key={title}
                className="group border-b /15 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
              >
                <div className="relative aspect-[5/4] overflow-hidden border-b">
                  <Image
                    src={image}
                    alt={alt}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover grayscale contrast-125 transition duration-500 group-hover:scale-[1.03] group-hover:grayscale-0"
                  />
                  <span className="absolute top-0 left-0 bg-foreground px-3 py-1.5 text-xs font-semibold text-background">
                    {index}
                  </span>
                </div>

                <div className="px-5 py-8 lg:px-8 lg:py-10">
                  <div className="flex items-center gap-3">
                    <Icon className="size-4 text-foreground" strokeWidth={2.4} />
                    <h3 className="text-xl text-foreground font-semibold tracking-[-0.03em]">{title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 05 · Destinatários ─────────────────────────────────────────── */}
      <section className="border-b">
        <div className="mx-auto grid max-w-[92rem] lg:grid-cols-[0.34fr_0.66fr]">
          <div className="px-5 py-12 sm:px-8 lg:border-r lg:px-12 lg:py-20">
            <p className="trudx-kicker text-muted-foreground">Destinatários</p>
            <h2 className="mt-6 text-3xl leading-[1.1] text-foreground lg:text-5xl font-semibold tracking-[-0.03em]">
              Pra quem responde por tudo
            </h2>
            <p className="mt-6 max-w-sm text-sm leading-6 text-muted-foreground">
              Se você cobra por projeto, atende cliente final e responde do orçamento à entrega, o trudx foi desenhado
              pra você.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3">
            {personas.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex min-h-[7.5rem] flex-col justify-between gap-4 border-r border-b p-5 transition-colors hover:bg-muted lg:p-7"
              >
                <Icon className="size-4 text-foreground" strokeWidth={2.3} />
                <span className="text-sm leading-tight text-foreground font-semibold tracking-[-0.03em]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 06 · Plano único ───────────────────────────────────────────── */}
      <section className="border-b">
        <div className="mx-auto grid max-w-[92rem] lg:grid-cols-2">
          <div className="relative overflow-hidden bg-foreground px-5 py-14 text-background sm:px-8 lg:border-r lg:px-12 lg:py-20">
            <div className="relative">
              <p className="trudx-kicker text-background/60">Plano único</p>
              <p className="mt-8 text-7xl leading-none font-semibold tracking-[-0.03em]">R$ 0</p>
              <p className="mt-4 text-xs text-background/70">Para sempre · Sem cobrança escondida</p>

              <Button
                render={<Link href="/signup" />}
                variant="secondary"
                size="lg"
                className="mt-10 h-10 w-full px-4 text-xs font-semibold sm:w-auto"
              >
                Criar conta grátis
                <ArrowUpRight className="size-4 transition-transform duration-200 group-hover/button:translate-x-0.5 group-hover/button:-translate-y-0.5" />
              </Button>
            </div>
          </div>

          <div className="px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
            <p className="trudx-kicker text-muted-foreground">O que está incluso</p>
            <ul className="mt-8">
              {planFeatures.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-4 border-b py-4 text-sm leading-6 text-foreground first:border-t first:"
                >
                  <BrandMark boxed={false} className="size-3 shrink-0 text-foreground" />
                  <span className="font-medium">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 07 · Esclarecimentos ───────────────────────────────────────── */}
      <section className="border-b bg-muted/40">
        <div className="mx-auto max-w-[92rem] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
          <div className="flex flex-wrap items-end justify-between gap-6 border-b pb-5">
            <p className="trudx-kicker text-muted-foreground">Esclarecimentos</p>
            <h2 className="text-3xl leading-none text-foreground lg:text-4xl font-semibold tracking-[-0.03em]">
              Ainda tem dúvida? Sem stress
            </h2>
          </div>

          <div className="mx-auto max-w-4xl">
            {faqItems.map((item, index) => (
              <Collapsible.CollapsibleRoot
                key={item.question}
                className="group border-b border-foreground/20 data-[open]:bg-background"
              >
                <Collapsible.CollapsibleTrigger className="flex w-full items-center gap-5 py-5 text-left outline-none sm:gap-8">
                  <span className="text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                  <span className="flex-1 text-lg leading-tight text-foreground sm:text-xl font-semibold tracking-[-0.03em]">
                    {item.question}
                  </span>
                  <span className="grid size-8 shrink-0 place-items-center border text-foreground transition-transform duration-200 group-data-[open]:rotate-45">
                    <svg
                      className="size-3.5"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M6 1.5v9M1.5 6h9" />
                    </svg>
                  </span>
                </Collapsible.CollapsibleTrigger>
                <Collapsible.CollapsibleContent className="overflow-hidden text-sm leading-6 text-muted-foreground transition-all data-[starting-style]:h-0 data-[ending-style]:h-0 data-[open]:animate-none">
                  <div className="max-w-2xl pb-6 sm:pl-[4.2rem]">{item.answer}</div>
                </Collapsible.CollapsibleContent>
              </Collapsible.CollapsibleRoot>
            ))}
          </div>
        </div>
      </section>

      {/* ── 08 · Convocação ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b bg-foreground text-background">
        <BrandMark
          boxed={false}
          className="pointer-events-none absolute -bottom-24 -left-16 size-[22rem] -rotate-12 text-background/[0.04]"
        />

        <div className="relative mx-auto max-w-[92rem] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <Badge variant="default" className="h-7 gap-2 bg-background px-3 text-xs font-semibold text-foreground">
            <BrandMark boxed={false} className="size-3" />
            100% grátis
          </Badge>

          <h2 className="mt-8 max-w-4xl text-4xl leading-[1.06] sm:text-5xl font-semibold tracking-[-0.03em]">
            Pronto para parar de pular entre planilhas?
          </h2>

          <div className="mt-10 flex flex-wrap items-center gap-2.5">
            <Button
              render={<Link href="/signup" />}
              variant="secondary"
              size="lg"
              className="h-10 px-4 text-xs font-semibold"
            >
              Criar conta grátis
              <ArrowUpRight className="size-4 transition-transform duration-200 group-hover/button:translate-x-0.5 group-hover/button:-translate-y-0.5" />
            </Button>
            <Button
              render={<Link href="/login" />}
              variant="outline"
              size="lg"
              className="h-10 bg-transparent px-4 text-xs font-semibold text-background hover:bg-background/10 hover:text-background !border-background/40"
            >
              Entrar
            </Button>
          </div>

          <p className="mt-8 flex items-center gap-2 text-xs text-background/70">
            <Clock className="size-3.5" strokeWidth={2.5} />
            Menos de 1 minuto para começar
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
