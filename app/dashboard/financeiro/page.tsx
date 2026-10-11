"use client";

//* Components Imports
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Checkbox from "@/components/ui/checkbox";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import Table from "@/components/ui/table";

import { FacetedFilter } from "@/app/dashboard/tasks/_components/faceted-filter";
import {
  BancosDialog,
  CategoriasDialog,
  ComparativoCard,
  ConciliacaoStatusBadge,
  DeleteFinanceiroDialog,
  DespesasCategoriaChart,
  DistribuicaoBancosCard,
  FinanceiroCartao,
  FinanceiroDetailDialog,
  FinanceiroFormDialog,
  FinanceiroGrupos,
  FinanceiroResumo,
  FinanceiroSaldoDialog,
  FinanceiroSecao,
  FinanceiroSkeleton,
  FixasVariaveisCard,
  GastosFixosDialog,
  ImportOfxDialog,
  InsightsCard,
  MaioresDespesasCard,
  PeriodFilterControl,
  PrivacyToggle,
  ReceitasDespesasChart,
  SaldoEvolucaoChart,
} from "./_components";

//* Libraries Imports
import { useEffect, useMemo, useState } from "react";
import { Building2, Download, Plus, Repeat, Search, Tags, Trash2, Undo2, Upload, X } from "lucide-react";

//* Hooks Imports
import { useBancos } from "@/hooks/use-bancos";
import { useClients } from "@/hooks/use-clients";
import { getPeriodRange, useFinanceiro, type FinanceiroRecord, type FinanceiroTipo } from "@/hooks/use-financeiro";
import { useFinanceiroCategorias } from "@/hooks/use-financeiro-categorias";
import { useFinanceiroGrupos } from "@/hooks/use-financeiro-grupos";
import { useFinanceiroImportacao } from "@/hooks/use-financeiro-importacao";
import { useFinanceiroPeriodo } from "@/hooks/use-financeiro-periodo";
import { useFinanceiroSaldos } from "@/hooks/use-financeiro-saldos";
import { useGastosFixos } from "@/hooks/use-gastos-fixos";

//* Utils Imports
import { FinanceiroPrivacyContext, formatCurrencyPrivate } from "./_components/financeiro-privacy";
import { addDays, comparisonBase } from "@/lib/financeiro/analytics";
import { buildDashboard, matchesFilters, SEM_VALOR, type DashboardFilters } from "@/lib/financeiro/dashboard";
import { getOrigem, toLedgerRow } from "@/lib/financeiro/ledger";
import { exportFinanceiroToCsv } from "@/lib/financeiro-csv";
import { formatDate } from "@/lib/format-date";
import { normalizeText } from "@/lib/normalize-text";

const ORIGEM_OPTIONS = [
  { value: "pdf", label: "Importado de PDF" },
  { value: "ofx", label: "Importado de OFX" },
  { value: "manual", label: "Manual / gasto fixo" },
];

const STATUS_OPTIONS = [
  { value: "provisorio", label: "Provisório" },
  { value: "revisao", label: "Revisão necessária" },
  { value: "conciliado", label: "Conciliado" },
  { value: "confirmado", label: "Confirmado" },
];

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const tipoLabels: Record<FinanceiroTipo, string> = {
  gasto: "Gasto",
  gasto_fixo: "Gasto fixo",
  ganho: "Ganho",
};
const tipoStyles: Record<FinanceiroTipo, string> = {
  gasto: "border-rose-200 bg-rose-50 text-rose-800",
  gasto_fixo: "border-amber-200 bg-amber-50 text-amber-800",
  ganho: "border-sky-200 bg-sky-50 text-sky-800",
};

/** Extrai um número de algo como "50", "50 reais" ou "R$ 50,00". */
function parseValorBusca(value: string) {
  const cleaned = value.replace(/[^\d.,]/g, "").replace(",", ".");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function FinanceiroPage() {
  // Sempre começa oculto ao abrir a aba — ver `financeiro-privacy.ts`.
  const [isValoresHidden, setIsValoresHidden] = useState(true);
  const privacy = useMemo(
    () => ({ isHidden: isValoresHidden, toggle: () => setIsValoresHidden((current) => !current) }),
    [isValoresHidden],
  );
  const {
    allRecords,
    tipoFilter,
    setTipoFilter,
    periodFilter,
    setPeriodFilter,
    isLoading,
    isSaving,
    deletingId,
    isBulkDeleting,
    createRecord,
    findDuplicates,
    updateRecord,
    deleteRecord,
    deleteRecords,
    refreshRecords,
  } = useFinanceiro();
  const { clients, selectableClients } = useClients();
  const gastosFixosState = useGastosFixos();
  const gruposState = useFinanceiroGrupos();
  const bancosState = useBancos();
  const categoriasState = useFinanceiroCategorias();

  const today = localToday();
  const range = useMemo(() => getPeriodRange(periodFilter), [periodFilter]);
  const isMonth = periodFilter.mode === "month";
  const comparison = useMemo(() => comparisonBase(range, today, isMonth), [range, today, isMonth]);
  const { rows: previousRows, refreshPeriodo } = useFinanceiroPeriodo(comparison.previous);
  const saldosState = useFinanceiroSaldos(today, addDays(range.start, -1));

  // Importar/desfazer mexe em lançamentos, saldos e no período de comparação de uma vez.
  const importacao = useFinanceiroImportacao(async () => {
    await Promise.all([refreshRecords(), saldosState.refreshSaldos(), refreshPeriodo()]);
  });

  const [isSaldoOpen, setIsSaldoOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isGastosFixosOpen, setIsGastosFixosOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isBancosOpen, setIsBancosOpen] = useState(false);
  const [isCategoriasOpen, setIsCategoriasOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<FinanceiroRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<FinanceiroRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [descricaoBusca, setDescricaoBusca] = useState("");
  const [valorBusca, setValorBusca] = useState("");
  const [origemFilter, setOrigemFilter] = useState<string[]>([]);
  const [clienteFilter, setClienteFilter] = useState<string[]>([]);
  const [bancoFilter, setBancoFilter] = useState<string[]>([]);
  const [categoriaFilter, setCategoriaFilter] = useState<string[]>([]);
  // Só a tabela: "revisão necessária" depende do saldo de referência, que não existe por lançamento.
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const clienteOptions = useMemo(
    () => [
      { value: SEM_VALOR, label: "Sem cliente" },
      ...clients.map((client) => ({ value: client.id, label: client.name })),
    ],
    [clients],
  );
  const bancoOptions = useMemo(
    () => [
      { value: SEM_VALOR, label: "Sem banco (avulsos)" },
      ...bancosState.bancos.map((banco) => ({ value: banco.id, label: banco.nome })),
    ],
    [bancosState.bancos],
  );
  const categoriaOptions = useMemo(
    () => [
      { value: SEM_VALOR, label: "Sem categoria" },
      ...categoriasState.categorias.map((categoria) => ({
        value: categoria.id,
        label: categoria.nome,
      })),
    ],
    [categoriasState.categorias],
  );

  const bancoName = (id: string | null) => bancosState.bancos.find((banco) => banco.id === id)?.nome ?? "Sem banco";
  const categoryName = (id: string | null) =>
    categoriasState.categorias.find((categoria) => categoria.id === id)?.nome ?? "Sem categoria";

  // Um único conjunto de filtros alimenta tabela, cards e gráficos.
  const filters = useMemo<DashboardFilters>(
    () => ({
      tipo: tipoFilter,
      origem: origemFilter,
      cliente: clienteFilter,
      banco: bancoFilter,
      categoria: categoriaFilter,
    }),
    [tipoFilter, origemFilter, clienteFilter, bancoFilter, categoriaFilter],
  );
  const hasActiveFilters =
    tipoFilter !== "all" ||
    origemFilter.length + clienteFilter.length + bancoFilter.length + categoriaFilter.length > 0;

  function clearFilters() {
    setTipoFilter("all");
    setOrigemFilter([]);
    setClienteFilter([]);
    setBancoFilter([]);
    setCategoriaFilter([]);
  }

  const currentLedger = useMemo(() => allRecords.map(toLedgerRow), [allRecords]);
  const ledgerById = useMemo(() => new Map(currentLedger.map((row) => [row.id, row])), [currentLedger]);
  const refDataByBanco = useMemo(
    () => new Map(saldosState.hoje.map((row) => [row.banco_id, row.ref_data])),
    [saldosState.hoje],
  );
  const isObsoleto = (record: FinanceiroRecord) => {
    const refData = refDataByBanco.get(record.banco_id);
    return record.status === "provisorio" && Boolean(refData) && record.data <= (refData as string);
  };
  const statusOf = (record: FinanceiroRecord) => (isObsoleto(record) ? "revisao" : record.status);

  const model = useMemo(
    () =>
      buildDashboard({
        currentRows: currentLedger,
        previousRows,
        period: range,
        isMonth,
        today,
        filters,
        saldosHoje: saldosState.hoje,
        saldosInicio: saldosState.inicio,
        categoryName: (id) =>
          categoriasState.categorias.find((categoria) => categoria.id === id)?.nome ?? "Sem categoria",
        formatCents: (cents) => formatCurrencyPrivate(cents / 100, isValoresHidden),
      }),
    [
      currentLedger,
      previousRows,
      range,
      isMonth,
      today,
      filters,
      saldosState.hoje,
      saldosState.inicio,
      categoriasState.categorias,
      isValoresHidden,
    ],
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = normalizeText(descricaoBusca);
    const valorAlvo = parseValorBusca(valorBusca);
    const valorMin = valorAlvo !== null ? valorAlvo * 0.9 : null;
    const valorMax = valorAlvo !== null ? valorAlvo * 1.1 : null;

    return allRecords.filter((record) => {
      const row = ledgerById.get(record.id);
      if (!row || !matchesFilters(row, filters)) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(statusOf(record))) return false;
      if (normalizedSearch && !normalizeText(record.descricao ?? "").includes(normalizedSearch)) return false;
      if (valorMin !== null && valorMax !== null && (record.valor < valorMin || record.valor > valorMax)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRecords, ledgerById, filters, statusFilter, descricaoBusca, valorBusca, refDataByBanco]);

  useEffect(() => {
    // Selection only makes sense scoped to the currently filtered/loaded records.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds((current) => {
      const validIds = new Set(filteredRecords.map((record) => record.id));
      const next = new Set([...current].filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [filteredRecords]);

  const total = filteredRecords.reduce(
    (sum, record) => sum + (record.tipo === "ganho" ? record.valor : -record.valor),
    0,
  );
  const allSelected = filteredRecords.length > 0 && selectedIds.size === filteredRecords.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(filteredRecords.map((record) => record.id)));
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleIn(setter: (updater: (current: string[]) => string[]) => void, id: string | null) {
    const key = id ?? SEM_VALOR;
    setter((current) => (current.includes(key) ? current.filter((item) => item !== key) : [key]));
  }

  function handleExport() {
    const toExport =
      selectedIds.size > 0 ? filteredRecords.filter((record) => selectedIds.has(record.id)) : filteredRecords;
    exportFinanceiroToCsv(
      toExport,
      clients,
      bancosState.bancos,
      `extrato-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  }

  // Saldos e período de comparação são buscados à parte; toda escrita no extrato os deixa velhos.
  // O refresh não é aguardado de propósito: o toast da operação não deve esperar outro round trip.
  function refreshDerived() {
    void saldosState.refreshSaldos();
    void refreshPeriodo();
  }

  async function handleCreateRecord(input: Parameters<typeof createRecord>[0]) {
    const success = await createRecord(input);
    if (success) void saldosState.refreshSaldos();
    return success;
  }

  async function handleUpdateRecord(id: string, input: Parameters<typeof updateRecord>[1]) {
    const success = await updateRecord(id, input);
    if (success) void saldosState.refreshSaldos();
    return success;
  }

  async function handleUndoLastImport() {
    if (!importacao.lastImport) return;
    const { inseridas, conciliadas } = importacao.lastImport;
    const confirmed = window.confirm(
      `Desfazer a última importação? ${inseridas} lançamento${inseridas === 1 ? "" : "s"} será${inseridas === 1 ? "" : "o"} removido${inseridas === 1 ? "" : "s"} e ${conciliadas} provisório${conciliadas === 1 ? "" : "s"} conciliado${conciliadas === 1 ? "" : "s"} voltará${conciliadas === 1 ? "" : "ão"} ao estado anterior.`,
    );
    if (!confirmed) return;

    await importacao.undoLastImport();
  }

  async function handleDeleteRecord(id: string) {
    const success = await deleteRecord(id);
    if (success) refreshDerived();
    return success;
  }

  async function handleBulkDelete() {
    const success = await deleteRecords([...selectedIds]);
    if (success) {
      setSelectedIds(new Set());
      refreshDerived();
    }
    return success;
  }

  async function handleApplyCategoryRules() {
    const updated = await categoriasState.applyRulesToHistory();
    if (updated > 0) await refreshRecords();
    return updated;
  }

  function handleSelectTopExpense(id: string) {
    const record = allRecords.find((candidate) => candidate.id === id);
    if (record) setDetailRecord(record);
  }

  const lastImportCount = importacao.lastImport
    ? importacao.lastImport.inseridas + importacao.lastImport.conciliadas
    : 0;
  const hasData = !model.isEmpty;
  const emptyChart = (
    <p className="py-10 text-center text-sm text-muted-foreground">
      Sem movimentação neste período com os filtros atuais.
    </p>
  );

  return (
    <FinanceiroPrivacyContext value={privacy}>
      <section className="space-y-8">
        <div className="flex flex-col justify-between gap-5 border-b pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="trudx-kicker mb-1.5 text-muted-foreground">Financeiro</p>
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-foreground">Extrato</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Acompanhe gastos, gastos fixos e ganhos num único lugar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrivacyToggle isHidden={isValoresHidden} onToggle={privacy.toggle} />
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-xs font-medium"
              onClick={() => setIsBancosOpen(true)}
            >
              <Building2 />
              Bancos
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-xs font-medium"
              onClick={() => setIsCategoriasOpen(true)}
            >
              <Tags />
              Categorias
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-xs font-medium"
              onClick={() => setIsGastosFixosOpen(true)}
            >
              <Repeat />
              Gastos fixos
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-xs font-medium"
              onClick={() => setIsImportOpen(true)}
            >
              <Upload />
              Importar extrato
            </Button>
            {importacao.lastImport && (
              <Button
                type="button"
                variant="outline"
                className="h-8 px-3 text-xs font-medium"
                disabled={importacao.isUndoing}
                onClick={() => void handleUndoLastImport()}
              >
                <Undo2 />
                {importacao.isUndoing ? "Desfazendo..." : `Desfazer último import (${lastImportCount})`}
              </Button>
            )}
            <Button type="button" className="h-8 px-3 text-xs font-medium" onClick={() => setIsFormOpen(true)}>
              <Plus />
              Novo lançamento
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border bg-background p-4" role="group" aria-label="Filtros globais">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_16rem]">
            <PeriodFilterControl value={periodFilter} onChange={setPeriodFilter} />
            <div className="flex flex-col justify-center gap-2">
              <p className="text-xs font-semibold text-muted-foreground">Filtrar por tipo</p>
              <Select.SelectRoot
                value={tipoFilter}
                onValueChange={(value) => setTipoFilter(value as FinanceiroTipo | "all")}
              >
                <Select.SelectTrigger className="h-10 w-full bg-background">
                  <Select.SelectValue>{tipoFilter === "all" ? "Todos" : tipoLabels[tipoFilter]}</Select.SelectValue>
                </Select.SelectTrigger>
                <Select.SelectContent>
                  <Select.SelectItem value="all">Todos</Select.SelectItem>
                  <Select.SelectItem value="gasto">Gasto</Select.SelectItem>
                  <Select.SelectItem value="gasto_fixo">Gasto fixo</Select.SelectItem>
                  <Select.SelectItem value="ganho">Ganho</Select.SelectItem>
                </Select.SelectContent>
              </Select.SelectRoot>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FacetedFilter
              label="Banco"
              options={bancoOptions}
              selected={bancoFilter}
              emptyMessage="Nenhum banco encontrado."
              onChange={setBancoFilter}
            />
            <FacetedFilter
              label="Categoria"
              options={categoriaOptions}
              selected={categoriaFilter}
              emptyMessage="Nenhuma categoria encontrada."
              onChange={setCategoriaFilter}
            />
            <FacetedFilter
              label="Cliente"
              options={clienteOptions}
              selected={clienteFilter}
              emptyMessage="Nenhum cliente encontrado."
              onChange={setClienteFilter}
            />
            <FacetedFilter label="Origem" options={ORIGEM_OPTIONS} selected={origemFilter} onChange={setOrigemFilter} />
            {hasActiveFilters && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <X />
                Limpar filtros
              </Button>
            )}
          </div>
        </div>

        <FinanceiroSecao title="Resumo financeiro" description={model.comparison.label}>
          <FinanceiroResumo
            model={model}
            bancoName={bancoName}
            isLoadingSaldo={saldosState.isLoading}
            hasSaldoError={saldosState.hasError}
            onOpenSaldo={() => setIsSaldoOpen(true)}
          />
        </FinanceiroSecao>

        <FinanceiroSecao title="Evolução financeira">
          {isLoading ? (
            <FinanceiroSkeleton />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              <FinanceiroCartao title="Receitas × despesas" subtitle="Interage com os filtros acima">
                {hasData ? <ReceitasDespesasChart series={model.series} granularity={model.granularity} /> : emptyChart}
              </FinanceiroCartao>
              <FinanceiroCartao title="Evolução do saldo" subtitle="Só filtro de banco se aplica ao saldo">
                {model.balanceSeries.length > 0 ? (
                  <SaldoEvolucaoChart points={model.balanceSeries} kind={model.balanceSeriesKind} />
                ) : (
                  emptyChart
                )}
              </FinanceiroCartao>
            </div>
          )}
        </FinanceiroSecao>

        <FinanceiroSecao title="Análise dos gastos">
          <div className="grid gap-4 xl:grid-cols-3">
            <FinanceiroCartao
              title="Despesas por categoria"
              subtitle="Clique numa categoria para filtrar o extrato"
              className="xl:col-span-1"
            >
              {categoriasState.categorias.length === 0 && hasData && (
                <div className="mb-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  Você ainda não tem categorias. Crie em <strong>Categorias</strong> para classificar as despesas.
                </div>
              )}
              <DespesasCategoriaChart
                categories={model.categories}
                categoryName={categoryName}
                selected={categoriaFilter}
                onSelect={(id) => toggleIn(setCategoriaFilter, id)}
              />
            </FinanceiroCartao>
            <FixasVariaveisCard data={model.fixedVariable} />
            <MaioresDespesasCard rows={model.top} bancoName={bancoName} onSelect={handleSelectTopExpense} />
          </div>
        </FinanceiroSecao>

        <FinanceiroSecao title="Comparativos" defaultOpen={false}>
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-1">
              <ComparativoCard model={model} categoryName={categoryName} />
            </div>
            <DistribuicaoBancosCard
              flows={model.banks}
              balances={model.allBankBalances}
              bancoName={bancoName}
              selected={bancoFilter}
              onSelect={(id) => toggleIn(setBancoFilter, id)}
            />
            <InsightsCard insights={model.insights} />
          </div>
        </FinanceiroSecao>

        <FinanceiroSecao title="Agrupamentos personalizados" defaultOpen={false}>
          <FinanceiroGrupos
            grupos={gruposState.grupos}
            records={allRecords}
            ledger={currentLedger}
            previousLedger={previousRows}
            comparison={comparison}
            isSaving={gruposState.isSaving}
            deletingId={gruposState.deletingId}
            onCreate={gruposState.createGrupo}
            onUpdate={gruposState.updateGrupo}
            onDelete={gruposState.deleteGrupo}
          />
        </FinanceiroSecao>

        {isLoading ? (
          <FinanceiroSkeleton />
        ) : (
          <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={descricaoBusca}
                  onChange={(event) => setDescricaoBusca(event.target.value)}
                  placeholder="Buscar por descrição..."
                  aria-label="Buscar por descrição"
                  className="h-10 bg-background pl-9"
                />
              </div>
              <div className="relative">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={valorBusca}
                  onChange={(event) => setValorBusca(event.target.value)}
                  placeholder="Buscar por valor aproximado (±10%)..."
                  aria-label="Buscar por valor aproximado"
                  inputMode="decimal"
                  className="h-10 bg-background pl-9"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <FacetedFilter
                label="Status"
                options={STATUS_OPTIONS}
                selected={statusFilter}
                onChange={setStatusFilter}
              />
              <p className="text-xs text-muted-foreground">
                Soma dos lançamentos exibidos:{" "}
                <span className={!isValoresHidden && total < 0 ? "text-rose-700" : "text-foreground"}>
                  {formatCurrencyPrivate(total, isValoresHidden)}
                </span>
              </p>
            </div>

            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={filteredRecords.length === 0}
                  onClick={toggleSelectAll}
                >
                  {allSelected ? "Limpar seleção" : "Selecionar todos"}
                </Button>
                {selectedIds.size > 0 && (
                  <p className="text-sm font-semibold text-muted-foreground">
                    {selectedIds.size} selecionado{selectedIds.size === 1 ? "" : "s"}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={filteredRecords.length === 0}
                  onClick={handleExport}
                >
                  <Download />
                  {selectedIds.size > 0 ? "Exportar selecionados" : "Exportar Excel"}
                </Button>
                {selectedIds.size > 0 && (
                  <Button type="button" variant="destructive" size="sm" onClick={() => setIsBulkDeleteOpen(true)}>
                    <Trash2 />
                    Excluir selecionados
                  </Button>
                )}
              </div>
            </div>

            <Table.TableRoot>
              <Table.TableHeader>
                <Table.TableRow className="hover:bg-transparent">
                  <Table.TableHead className="w-10 px-3">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onCheckedChange={toggleSelectAll}
                      disabled={filteredRecords.length === 0}
                      aria-label="Selecionar todos os lançamentos"
                    />
                  </Table.TableHead>
                  {["Data", "Tipo", "Descrição", "Categoria", "Cliente", "Banco", "Status"].map((label) => (
                    <Table.TableHead
                      key={label}
                      className="px-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      {label}
                    </Table.TableHead>
                  ))}
                  <Table.TableHead className="px-3 text-right text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Valor
                  </Table.TableHead>
                  <Table.TableHead className="px-3 text-right text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Ações
                  </Table.TableHead>
                </Table.TableRow>
              </Table.TableHeader>
              <Table.TableBody>
                {filteredRecords.length === 0 ? (
                  <Table.TableRow>
                    <Table.TableCell colSpan={10} className="h-40 text-center">
                      <p className="font-semibold">Nenhum lançamento encontrado</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Ajuste o período/filtros/busca, cadastre um lançamento ou importe um extrato.
                      </p>
                    </Table.TableCell>
                  </Table.TableRow>
                ) : (
                  filteredRecords.map((record) => {
                    const client = clients.find((candidate) => candidate.id === record.cliente_id);
                    const banco = bancosState.bancos.find((candidate) => candidate.id === record.banco_id);
                    const categoria = categoriasState.categorias.find(
                      (candidate) => candidate.id === record.categoria_id,
                    );
                    const origem = getOrigem(record);
                    return (
                      <Table.TableRow
                        key={record.id}
                        data-selected={selectedIds.has(record.id) || undefined}
                        className="cursor-pointer data-selected:bg-accent/60"
                        onClick={() => setDetailRecord(record)}
                      >
                        <Table.TableCell className="px-3" onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(record.id)}
                            onCheckedChange={(checked) => toggleSelect(record.id, checked === true)}
                            aria-label={`Selecionar ${record.descricao ?? "lançamento"}`}
                          />
                        </Table.TableCell>
                        <Table.TableCell className="px-3 py-4 text-muted-foreground">
                          {formatDate(record.data)}
                        </Table.TableCell>
                        <Table.TableCell className="px-3 py-4">
                          <Badge variant="outline" className={tipoStyles[record.tipo]}>
                            {tipoLabels[record.tipo]}
                          </Badge>
                        </Table.TableCell>
                        <Table.TableCell className="px-3 py-4 font-semibold">
                          {record.descricao != null && record.descricao?.length > 30
                            ? record.descricao?.substring(0, 30) + "..."
                            : record.descricao || "—"}
                          {record.natureza !== "normal" && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {record.natureza === "estorno" ? "estorno" : "interno"}
                            </span>
                          )}
                        </Table.TableCell>
                        <Table.TableCell className="px-3 py-4 text-muted-foreground">
                          {categoria?.nome ?? "—"}
                        </Table.TableCell>
                        <Table.TableCell className="px-3 py-4 text-muted-foreground">
                          {client?.name ?? "—"}
                        </Table.TableCell>
                        <Table.TableCell className="px-3 py-4 text-muted-foreground">
                          {banco?.nome ?? "—"}
                        </Table.TableCell>
                        <Table.TableCell className="px-3 py-4">
                          <ConciliacaoStatusBadge status={record.status} isObsoleto={isObsoleto(record)} />
                          <span className="sr-only"> origem {origem}</span>
                        </Table.TableCell>
                        <Table.TableCell
                          className={`px-3 py-4 text-right font-semibold ${record.tipo === "ganho" ? "text-emerald-700" : "text-foreground"}`}
                        >
                          {record.tipo === "ganho" ? "+" : "-"}
                          {formatCurrencyPrivate(record.valor, isValoresHidden)}
                        </Table.TableCell>
                        <Table.TableCell className="px-3 py-4 text-right" onClick={(event) => event.stopPropagation()}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeletingRecord(record)}
                            aria-label={`Excluir ${record.descricao ?? "lançamento"}`}
                          >
                            <Trash2 />
                          </Button>
                        </Table.TableCell>
                      </Table.TableRow>
                    );
                  })
                )}
              </Table.TableBody>
            </Table.TableRoot>
          </div>
        )}

        {isSaldoOpen && (
          <FinanceiroSaldoDialog
            balance={model.balance}
            bankBalances={model.allBankBalances}
            bancos={bancosState.bancos}
            referencias={saldosState.referencias}
            onOpenChange={(open) => {
              if (!open) setIsSaldoOpen(false);
            }}
            onSaveReferencia={saldosState.saveReferencia}
            onDeleteReferencia={saldosState.deleteReferencia}
          />
        )}
        <FinanceiroFormDialog
          open={isFormOpen}
          clients={selectableClients}
          bancos={bancosState.bancos}
          categorias={categoriasState.categorias}
          isSaving={isSaving}
          onOpenChange={setIsFormOpen}
          onSubmit={handleCreateRecord}
        />
        <ImportOfxDialog
          open={isImportOpen}
          clients={selectableClients}
          bancos={bancosState.bancos}
          categorias={categoriasState.categorias}
          isSaving={importacao.isApplying}
          onOpenChange={setIsImportOpen}
          onFindProvisionals={importacao.findProvisionals}
          onFindDuplicates={findDuplicates}
          onApply={importacao.applyImport}
        />
        <CategoriasDialog
          open={isCategoriasOpen}
          categorias={categoriasState.categorias}
          isSaving={categoriasState.isSaving}
          onOpenChange={setIsCategoriasOpen}
          onCreate={categoriasState.createCategoria}
          onUpdate={categoriasState.updateCategoria}
          onDelete={categoriasState.deleteCategoria}
          onCreateSuggested={categoriasState.createSuggested}
          onApplyRules={handleApplyCategoryRules}
        />
        <BancosDialog
          open={isBancosOpen}
          bancos={bancosState.bancos}
          isSaving={bancosState.isSaving}
          deletingId={bancosState.deletingId}
          onOpenChange={setIsBancosOpen}
          onCreate={bancosState.createBanco}
          onDelete={bancosState.deleteBanco}
        />
        <GastosFixosDialog
          open={isGastosFixosOpen}
          gastosFixos={gastosFixosState.gastosFixos}
          isSaving={gastosFixosState.isSaving}
          deletingId={gastosFixosState.deletingId}
          onOpenChange={setIsGastosFixosOpen}
          onCreate={gastosFixosState.createGastoFixo}
          onUpdate={gastosFixosState.updateGastoFixo}
          onToggleAtivo={gastosFixosState.toggleAtivo}
          onDelete={gastosFixosState.deleteGastoFixo}
        />
        <FinanceiroDetailDialog
          record={detailRecord}
          tipoLabel={detailRecord ? tipoLabels[detailRecord.tipo] : ""}
          tipoClassName={detailRecord ? tipoStyles[detailRecord.tipo] : ""}
          clients={selectableClients}
          bancos={bancosState.bancos}
          categorias={categoriasState.categorias}
          isObsoleto={detailRecord ? isObsoleto(detailRecord) : false}
          isSaving={isSaving}
          isValoresHidden={isValoresHidden}
          onOpenChange={(open) => {
            if (!open) setDetailRecord(null);
          }}
          onSave={handleUpdateRecord}
          onDelete={(record) => {
            setDetailRecord(null);
            setDeletingRecord(record);
          }}
        />
        <DeleteFinanceiroDialog
          open={Boolean(deletingRecord)}
          descricao={deletingRecord?.descricao ?? "esse lançamento"}
          isDeleting={Boolean(deletingId)}
          onOpenChange={(open) => {
            if (!open) setDeletingRecord(null);
          }}
          onConfirm={() => (deletingRecord ? handleDeleteRecord(deletingRecord.id) : Promise.resolve(false))}
        />
        <DeleteFinanceiroDialog
          open={isBulkDeleteOpen}
          count={selectedIds.size}
          isDeleting={isBulkDeleting}
          onOpenChange={setIsBulkDeleteOpen}
          onConfirm={handleBulkDelete}
        />
      </section>
    </FinanceiroPrivacyContext>
  );
}
