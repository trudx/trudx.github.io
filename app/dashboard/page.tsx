"use client";

//* Components Imports
import { DashboardHero, OverviewDetailDialog, OverviewMetricCard } from "./_components";

//* Libraries Imports
import { useState } from "react";
import {
  Activity,
  CalendarCheck,
  CalendarClock,
  CircleAlert,
  CircleCheckBig,
  Hourglass,
  TrendingDown,
  TrendingUp,
  UserPlus,
} from "lucide-react";

//* Hooks Imports
import { useClients } from "@/hooks/use-clients";
import { getLastDaysPeriod, useFinanceiro } from "@/hooks/use-financeiro";
import { useProfile } from "@/hooks/use-profile";
import { useTaskSummary } from "@/hooks/use-task-summary";

//* Types Imports
import type { OverviewDetailItem } from "./_components";

//* Utils Imports
import { formatCurrency } from "@/lib/format-currency";
import { formatDate, formatDateLong, formatTimestamp } from "@/lib/format-date";
import { buildGreeting, getGreetingPeriod } from "@/lib/greeting";

type DetailKey = "ganhos" | "gastos" | "clientes";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export default function DashboardPage() {
  const { profile, isLoading: isLoadingProfile } = useProfile();
  // Relógio e sorteio ficam num inicializador, não no render: os dois são impuros e mudariam a
  // cada re-renderização (a frase trocaria sozinha). O inicializador roda no cliente durante a
  // hidratação, então a hora usada é a real do usuário, não a do build.
  const [sessao] = useState(() => {
    const agora = new Date();
    return {
      agora,
      seed: Math.random(),
      hojeIso: toIsoDate(agora),
      seteDiasAtras: toIsoDate(addDays(agora, -6)),
      periodo: getLastDaysPeriod(7),
    };
  });
  const { allRecords, isLoading: isLoadingFinanceiro } = useFinanceiro(sessao.periodo);
  const { clients, isLoading: isLoadingClients } = useClients();
  const { summary: tarefas, isLoading: isLoadingTasks } = useTaskSummary(sessao.hojeIso);
  const [openDetail, setOpenDetail] = useState<DetailKey | null>(null);

  const { hojeIso, seteDiasAtras } = sessao;

  const ganhos = allRecords.filter((record) => record.tipo === "ganho");
  const gastos = allRecords.filter((record) => record.tipo !== "ganho");
  const totalGanhos = ganhos.reduce((sum, record) => sum + record.valor, 0);
  const totalGastos = gastos.reduce((sum, record) => sum + record.valor, 0);

  // `created_at` é timestamp completo; comparar só a parte da data evita erro de fuso.
  const clientesRecentes = clients.filter(
    (client) => client.created_at.slice(0, 10) >= seteDiasAtras,
  );

  const firstName = profile.name.trim().split(" ")[0];
  const greeting = firstName ? buildGreeting(firstName, sessao.seed, sessao.agora) : "";

  const detailProps = {
    ganhos: {
      title: "Ganhos dos últimos 7 dias",
      description: `${ganhos.length} ${ganhos.length === 1 ? "lançamento" : "lançamentos"} desde ${formatDate(seteDiasAtras)}.`,
      total: formatCurrency(totalGanhos),
      totalClassName: "text-emerald-700",
      items: ganhos.map<OverviewDetailItem>((record) => ({
        id: record.id,
        primary: record.descricao || "Sem descrição",
        secondary: formatDate(record.data),
        trailing: `+${formatCurrency(record.valor)}`,
        trailingClassName: "text-emerald-700",
      })),
    },
    gastos: {
      title: "Gastos dos últimos 7 dias",
      description: `${gastos.length} ${gastos.length === 1 ? "lançamento" : "lançamentos"} desde ${formatDate(seteDiasAtras)}.`,
      total: formatCurrency(totalGastos),
      totalClassName: "text-rose-700",
      items: gastos.map<OverviewDetailItem>((record) => ({
        id: record.id,
        primary: record.descricao || "Sem descrição",
        secondary: formatDate(record.data),
        trailing: `-${formatCurrency(record.valor)}`,
        trailingClassName: "text-rose-700",
      })),
    },
    clientes: {
      title: "Clientes dos últimos 7 dias",
      description: `${clientesRecentes.length} ${clientesRecentes.length === 1 ? "cliente cadastrado" : "clientes cadastrados"} desde ${formatDate(seteDiasAtras)}.`,
      total: undefined,
      totalClassName: undefined,
      items: clientesRecentes.map<OverviewDetailItem>((client) => ({
        id: client.id,
        primary: client.name,
        secondary: formatTimestamp(client.created_at),
      })),
    },
  } as const;

  const detail = openDetail ? detailProps[openDetail] : null;

  return (
    // Margens negativas espelham o padding do <main> do layout: a ilustração vai de ponta a ponta.
    <div className="-mx-4 -mt-6 sm:-mx-6 sm:-mt-8 lg:-mx-8">
      <DashboardHero
        period={getGreetingPeriod(sessao.agora)}
        greeting={greeting}
        formattedDate={formatDateLong(hojeIso)}
        description="Um resumo do que entrou, saiu e está para vencer — clique num indicador para ver os lançamentos."
        isLoading={isLoadingProfile}
      >
        <section aria-labelledby="dashboard-financeiro-title" className="flex flex-col gap-3">
          <h2 id="dashboard-financeiro-title" className="trudx-kicker text-foreground/70">
            Últimos 7 dias
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <OverviewMetricCard
              variant="hero"
              icon={TrendingUp}
              label="Ganhos"
              value={ganhos.length > 0 ? formatCurrency(totalGanhos) : null}
              emptyLabel="Sem ganhos"
              hint={`${ganhos.length} ${ganhos.length === 1 ? "lançamento" : "lançamentos"}`}
              isLoading={isLoadingFinanceiro}
              valueClassName="text-emerald-400"
              onOpen={() => setOpenDetail("ganhos")}
            />
            <OverviewMetricCard
              variant="hero"
              icon={TrendingDown}
              label="Gastos"
              value={gastos.length > 0 ? formatCurrency(totalGastos) : null}
              emptyLabel="Sem gastos"
              hint={`${gastos.length} ${gastos.length === 1 ? "lançamento" : "lançamentos"}`}
              isLoading={isLoadingFinanceiro}
              valueClassName="text-rose-400"
              onOpen={() => setOpenDetail("gastos")}
            />
            <OverviewMetricCard
              variant="hero"
              icon={UserPlus}
              label="Novos clientes"
              value={clientesRecentes.length > 0 ? String(clientesRecentes.length) : null}
              emptyLabel="Sem novos clientes"
              hint="Ver quem entrou"
              isLoading={isLoadingClients}
              onOpen={() => setOpenDetail("clientes")}
            />
          </div>
        </section>
      </DashboardHero>

      <section
        aria-labelledby="dashboard-tarefas-title"
        className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 pb-8 sm:px-6 lg:px-8"
      >
        <h2 id="dashboard-tarefas-title" className="trudx-kicker">
          Tarefas
        </h2>
        {/* Por data: o que está devendo entrega. As concluídas não entram — já saíram da fila. */}
        <div className="grid gap-4 md:grid-cols-3">
          <OverviewMetricCard
            icon={CalendarCheck}
            label="Para hoje"
            value={String(tarefas.dueToday)}
            emptyLabel="—"
            isLoading={isLoadingTasks}
          />
          <OverviewMetricCard
            icon={CalendarClock}
            label="Para amanhã"
            value={String(tarefas.dueTomorrow)}
            emptyLabel="—"
            isLoading={isLoadingTasks}
          />
          <OverviewMetricCard
            icon={CircleAlert}
            label="Atrasadas"
            value={String(tarefas.overdue)}
            emptyLabel="—"
            hint="Entrega antes de hoje"
            isLoading={isLoadingTasks}
          />
        </div>
        {/* Por etapa, seguindo as colunas-marco do kanban. Sem a marca configurada, o card avisa
            em vez de mostrar um número que não quer dizer nada. */}
        <div className="grid gap-4 md:grid-cols-3">
          <OverviewMetricCard
            icon={Hourglass}
            label="Pendentes"
            value={tarefas.hasPendingColumn ? String(tarefas.pending) : null}
            emptyLabel="Defina a coluna de pendência"
            hint="Na fila, ainda não começaram"
            isLoading={isLoadingTasks}
          />
          <OverviewMetricCard
            icon={Activity}
            label="Em produção"
            value={String(tarefas.inProgress)}
            emptyLabel="—"
            hint="Entre pendência e conclusão"
            isLoading={isLoadingTasks}
          />
          <OverviewMetricCard
            icon={CircleCheckBig}
            label="Concluídas"
            value={tarefas.hasDoneColumn ? String(tarefas.done) : null}
            emptyLabel="Defina a coluna de conclusão"
            hint="Concluídas ou canceladas"
            isLoading={isLoadingTasks}
          />
        </div>
      </section>

      {detail && (
        <OverviewDetailDialog
          title={detail.title}
          description={detail.description}
          total={detail.total}
          totalClassName={detail.totalClassName}
          items={detail.items}
          onOpenChange={(open) => {
            if (!open) setOpenDetail(null);
          }}
        />
      )}
    </div>
  );
}
