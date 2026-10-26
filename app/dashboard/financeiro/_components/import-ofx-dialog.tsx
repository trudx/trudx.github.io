"use client";

//* Components Imports
import Button from "@/components/ui/button";
import Checkbox from "@/components/ui/checkbox";
import Dialog from "@/components/ui/dialog";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import Select from "@/components/ui/select";

import { ConciliacaoReview } from "./conciliacao-review";
import { OfxGroupCard } from "./ofx-group-card";

//* Libraries Imports
import { useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { TrendingDown, TrendingUp, Upload } from "lucide-react";

//* Hooks Imports
import { useAiSettings } from "@/hooks/use-ai-settings";
import { FinanceiroPrivacyContext } from "./financeiro-privacy";

//* Types Imports
import type { BancoRecord } from "@/hooks/use-bancos";
import type { ClientRecord } from "@/hooks/use-clients";
import type { CategoriaRecord } from "@/hooks/use-financeiro-categorias";
import type { FinanceiroInput } from "@/hooks/use-financeiro";
import type { ApplyImportParams, ApplyImportResult, ImportLinePayload } from "@/hooks/use-financeiro-importacao";
import type { AiDuplicateSuspect, ExistingEntry } from "@/lib/financeiro/ai-duplicates";
import type { GroupChoice, LineMeta } from "@/lib/financeiro/import-lines";
import type {
  ImportedLine,
  ProvisionalLine,
  ReconciliationPlan,
  ReviewDecision,
} from "@/lib/financeiro/reconciliation";
import type { OfxGroup, StatementMeta } from "@/lib/ofx";
import type { OfxReviewState } from "./ofx-group-card";

//* Utils Imports
import { findAiDuplicates } from "@/lib/financeiro/ai-duplicates";
import { buildImportLines } from "@/lib/financeiro/import-lines";
import { suggestCategoriaId } from "@/lib/financeiro/categorize";
import { fromCents } from "@/lib/financeiro/money";
import { suggestNatureza } from "@/lib/financeiro/natureza";
import { planReconciliation, resolvePlan } from "@/lib/financeiro/reconciliation";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { parseStatementFile } from "@/lib/ofx";

// Durante a importação os valores precisam estar legíveis para conferência; o modo privacidade
// continua valendo na tela por trás e volta sozinho quando o diálogo fecha.
const REVEALED_PRIVACY = { isHidden: false, toggle: () => {} };

type Step = "arquivo" | "grupos" | "conciliacao" | "ia-duplicados" | "duplicados";

type ImportOfxDialogProps = {
  open: boolean;
  clients: ClientRecord[];
  bancos: BancoRecord[];
  categorias: CategoriaRecord[];
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onFindProvisionals: (bancoId: string, minDate: string, maxDate: string) => Promise<ProvisionalLine[] | null>;
  onFindDuplicates: (inputs: FinanceiroInput[]) => Promise<FinanceiroInput[]>;
  onFindExisting: (minDate: string, maxDate: string, bancoId: string) => Promise<ExistingEntry[] | null>;
  onApply: (params: ApplyImportParams) => Promise<ApplyImportResult | null>;
};

/** Resultado do planejamento que ainda falta aplicar (depois de conciliação e duplicados). */
type PendingImport = {
  conciliacoes: { line: ImportedLine; provisionalId: string }[];
  novas: ImportedLine[];
};

/** Estado parado na revisão das duplicatas apontadas pela IA, antes da checagem exata. */
type AiReview = {
  conciliacoes: PendingImport["conciliacoes"];
  novas: ImportedLine[];
  suspects: AiDuplicateSuspect[];
  exactInputs: FinanceiroInput[];
  exactLines: ImportedLine[];
};

function sumIncluded(groups: OfxGroup[], review: Record<string, OfxReviewState>) {
  return groups.reduce(
    (sum, group) => (review[group.key]?.include ? sum + group.valor * group.transactions.length : sum),
    0,
  );
}

export function ImportOfxDialog({
  open,
  clients,
  bancos,
  categorias,
  isSaving,
  onOpenChange,
  onFindProvisionals,
  onFindDuplicates,
  onFindExisting,
  onApply,
}: ImportOfxDialogProps) {
  const ai = useAiSettings();
  const aiConfigured = Boolean(ai.settings.token.trim() && ai.settings.model.trim());
  const [step, setStep] = useState<Step>("arquivo");
  const [groups, setGroups] = useState<OfxGroup[]>([]);
  const [statementMeta, setStatementMeta] = useState<StatementMeta | null>(null);
  const [fileName, setFileName] = useState("");
  const [review, setReview] = useState<Record<string, OfxReviewState>>({});
  const [bancoId, setBancoId] = useState<string | null>(null);
  const [useReference, setUseReference] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [lineMeta, setLineMeta] = useState<Map<number, LineMeta>>(new Map());
  const [plan, setPlan] = useState<ReconciliationPlan | null>(null);
  const [provisionals, setProvisionals] = useState<Map<string, ProvisionalLine>>(new Map());
  const [rejectedAuto, setRejectedAuto] = useState<Set<number>>(new Set());
  const [decisions, setDecisions] = useState<Map<number, ReviewDecision>>(new Map());

  const [duplicates, setDuplicates] = useState<FinanceiroInput[] | null>(null);
  const [duplicateLines, setDuplicateLines] = useState<ImportedLine[]>([]);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<number>>(new Set());
  const [useAiCheck, setUseAiCheck] = useState(true);
  const [aiReview, setAiReview] = useState<AiReview | null>(null);
  const [aiDiscard, setAiDiscard] = useState<Set<number>>(new Set());
  const [aiFrom, setAiFrom] = useState("");
  const [aiTo, setAiTo] = useState("");

  function reset() {
    setStep("arquivo");
    setGroups([]);
    setStatementMeta(null);
    setFileName("");
    setReview({});
    setBancoId(null);
    setUseReference(false);
    setLineMeta(new Map());
    setPlan(null);
    setProvisionals(new Map());
    setRejectedAuto(new Set());
    setDecisions(new Map());
    setDuplicates(null);
    setDuplicateLines([]);
    setPending(null);
    setSelectedDuplicates(new Set());
    setAiReview(null);
    setAiDiscard(new Set());
    setAiFrom("");
    setAiTo("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsParsing(true);
    try {
      const { groups: parsedGroups, meta, warnings } = await parseStatementFile(file);
      for (const warning of warnings) toast.warning(warning);
      setGroups(parsedGroups);
      setStatementMeta(meta);
      setFileName(file.name);
      // O saldo do OFX é estruturado e confiável; o lido do PDF só vem marcado se a leitura bateu.
      setUseReference(Boolean(meta.saldoFinal && meta.saldoConfiavel));
      setReview(
        Object.fromEntries(
          parsedGroups.map((group) => [
            group.key,
            {
              include: true,
              tipo: group.tipoSugerido,
              cliente_id: null,
              natureza: suggestNatureza(group.descricao),
              categoria_id: suggestCategoriaId(group.descricao, categorias),
            } satisfies GroupChoice,
          ]),
        ),
      );
      setStep("grupos");
    } catch (error) {
      toast.error("Não foi possível ler esse extrato", {
        description:
          error instanceof Error ? error.message : "Confira se o arquivo exportado pelo banco não está corrompido.",
      });
      console.error("Erro ao processar extrato:", error);
    } finally {
      setIsParsing(false);
    }
  }

  function updateReview(key: string, patch: Partial<OfxReviewState>) {
    setReview((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  function toPayload(line: ImportedLine): ImportLinePayload {
    const meta = lineMeta.get(line.index);
    return {
      data: line.data,
      valor: fromCents(line.cents),
      tipo: line.tipo,
      descricao: line.descricao,
      fitid: line.fitid,
      natureza: meta?.natureza ?? "normal",
      cliente_id: meta?.cliente_id ?? null,
      categoria_id: meta?.categoria_id ?? null,
    };
  }

  async function applyFinal(final: PendingImport) {
    if (!statementMeta) return;

    const saldoReferencia = useReference && bancoId && statementMeta.saldoFinal ? statementMeta.saldoFinal : null;

    if (final.novas.length === 0 && final.conciliacoes.length === 0 && !saldoReferencia) {
      toast.info("Nenhum lançamento para importar");
      handleOpenChange(false);
      return;
    }

    const result = await onApply({
      bancoId,
      arquivo: fileName,
      formato: statementMeta.formato,
      periodo: statementMeta.periodo,
      saldoReferencia,
      novas: final.novas.map(toPayload),
      conciliacoes: final.conciliacoes.map(({ line, provisionalId }) => ({
        ...toPayload(line),
        id: provisionalId,
      })),
    });
    if (result) handleOpenChange(false);
  }

  /** Depois da conciliação: lança só as linhas "novas" pela checagem de duplicados e então aplica. */
  async function checkDuplicatesAndApply(final: PendingImport) {
    const inputs = final.novas.map<FinanceiroInput>((line) => ({
      data: line.data,
      tipo: line.tipo,
      valor: fromCents(line.cents),
      descricao: line.descricao,
      cliente_id: lineMeta.get(line.index)?.cliente_id ?? null,
      banco_id: bancoId,
      fitid: line.fitid,
    }));

    const duplicateInputs = await onFindDuplicates(inputs);
    const duplicateSet = new Set(duplicateInputs);
    const duplicateIndexes = inputs.flatMap((input, index) => (duplicateSet.has(input) ? [index] : []));
    const exactLines = duplicateIndexes.map((index) => final.novas[index]);
    const novas = final.novas.filter((_, index) => !duplicateIndexes.includes(index));

    const suspects = await askAiForDuplicates(novas);
    if (suspects.length > 0) {
      setAiReview({ conciliacoes: final.conciliacoes, novas, suspects, exactInputs: duplicateInputs, exactLines });
      setAiDiscard(new Set(suspects.map((suspect) => suspect.index)));
      setStep("ia-duplicados");
      return;
    }

    await continueWithExactDuplicates(final.conciliacoes, novas, duplicateInputs, exactLines);
  }

  /** Pergunta à IA (se configurada e liberada) quais linhas novas repetem lançamentos que já existem. */
  async function askAiForDuplicates(novas: ImportedLine[]) {
    if (!aiReady || !bancoId || novas.length === 0) return [] as AiDuplicateSuspect[];

    try {
      const candidates = novas.map((line) => ({
        data: line.data,
        tipo: line.tipo,
        valor: fromCents(line.cents),
        descricao: line.descricao,
      }));
      const existing = await onFindExisting(aiFrom, aiTo, bancoId);
      if (!existing) throw new Error("Não foi possível buscar os lançamentos existentes.");
      return await findAiDuplicates(ai.settings, candidates, existing, new AbortController().signal);
    } catch (error) {
      toast.warning("A IA não conseguiu checar duplicatas", {
        description: `${error instanceof Error ? error.message : "Tente novamente."} A importação segue sem essa checagem.`,
      });
      console.error("Erro na checagem de duplicatas pela IA:", error);
      return [] as AiDuplicateSuspect[];
    }
  }

  /** Mostra os duplicados exatos para decisão ou, não havendo, aplica a importação. */
  async function continueWithExactDuplicates(
    conciliacoes: PendingImport["conciliacoes"],
    novas: ImportedLine[],
    duplicateInputs: FinanceiroInput[],
    exactLines: ImportedLine[],
  ) {
    if (duplicateInputs.length === 0) {
      await applyFinal({ conciliacoes, novas });
      return;
    }

    setDuplicates(duplicateInputs);
    setDuplicateLines(exactLines);
    setPending({ conciliacoes, novas });
    setSelectedDuplicates(new Set());
    setStep("duplicados");
  }

  function toggleAiDiscard(index: number, checked: boolean) {
    setAiDiscard((current) => {
      const next = new Set(current);
      if (checked) next.add(index);
      else next.delete(index);
      return next;
    });
  }

  /** Segue a importação sem as linhas que o usuário confirmou como duplicadas. */
  async function handleResolveAiReview(discardSelected: boolean) {
    if (!aiReview) return;

    const discarded = discardSelected
      ? new Set(
          aiReview.suspects
            .filter((suspect) => aiDiscard.has(suspect.index))
            .map((suspect) => aiReview.novas[suspect.index]),
        )
      : new Set<ImportedLine>();
    const novas = aiReview.novas.filter((line) => !discarded.has(line));

    setIsWorking(true);
    try {
      setAiReview(null);
      await continueWithExactDuplicates(aiReview.conciliacoes, novas, aiReview.exactInputs, aiReview.exactLines);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleImport() {
    const { lines: builtLines, meta } = buildImportLines(groups, review);
    if (builtLines.length === 0) {
      toast.error("Selecione ao menos um lançamento para importar");
      return;
    }

    setIsWorking(true);
    try {
      let candidates: ProvisionalLine[] = [];
      if (bancoId) {
        const dates = builtLines.map((line) => line.data).sort();
        const found = await onFindProvisionals(bancoId, dates[0], dates[dates.length - 1]);
        if (!found) return;
        candidates = found;
      }

      const built = planReconciliation(builtLines, candidates);
      setLineMeta(meta);
      setProvisionals(new Map(candidates.map((candidate) => [candidate.id, candidate])));
      setPlan(built);
      setRejectedAuto(new Set());
      setDecisions(new Map());

      if (built.automaticos.length > 0 || built.revisao.length > 0) {
        setStep("conciliacao");
        return;
      }

      await checkDuplicatesAndApply({ conciliacoes: [], novas: built.novas });
    } finally {
      setIsWorking(false);
    }
  }

  async function handleContinueConciliacao() {
    if (!plan) return;

    // Casamento automático recusado vira lançamento novo (o provisório continua provisório).
    const adjusted: ReconciliationPlan = {
      ...plan,
      automaticos: plan.automaticos.filter((match) => !rejectedAuto.has(match.line.index)),
      novas: [
        ...plan.novas,
        ...plan.automaticos.filter((match) => rejectedAuto.has(match.line.index)).map((match) => match.line),
      ],
    };

    setIsWorking(true);
    try {
      const final = resolvePlan(adjusted, decisions);
      if (final.puladas.length > 0) {
        toast.info(
          `${final.puladas.length} linha${final.puladas.length === 1 ? "" : "s"} sem decisão não ${final.puladas.length === 1 ? "será importada" : "serão importadas"} agora`,
          { description: "Importe o extrato de novo depois para resolvê-las — nada é duplicado." },
        );
      }
      await checkDuplicatesAndApply({ conciliacoes: final.conciliacoes, novas: final.novas });
    } catch (error) {
      toast.error("Não foi possível aplicar suas decisões", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsWorking(false);
    }
  }

  function toggleDuplicate(index: number, checked: boolean) {
    setSelectedDuplicates((current) => {
      const next = new Set(current);
      if (checked) next.add(index);
      else next.delete(index);
      return next;
    });
  }

  async function handleConfirmDuplicates() {
    if (!pending) return;
    const selected = duplicateLines.filter((_, index) => selectedDuplicates.has(index));
    await applyFinal({
      conciliacoes: pending.conciliacoes,
      novas: [...pending.novas, ...selected],
    });
  }

  async function handleIgnoreDuplicates() {
    if (!pending) return;
    await applyFinal(pending);
  }

  // A IA só recebe o que já está no banco quando o usuário escolheu o banco e o período a comparar.
  const aiRangeValid = Boolean(aiFrom && aiTo && aiFrom <= aiTo);
  const aiReady = aiConfigured && useAiCheck && Boolean(bancoId) && aiRangeValid;
  const busy = isSaving || isWorking;
  const includedCount = groups.reduce(
    (total, group) => total + (review[group.key]?.include ? group.transactions.length : 0),
    0,
  );
  const ganhoGroups = groups.filter((group) => review[group.key]?.tipo === "ganho");
  const gastoGroups = groups.filter((group) => review[group.key]?.tipo === "gasto");
  const totalGanhos = sumIncluded(ganhoGroups, review);
  const totalGastos = sumIncluded(gastoGroups, review);
  const saldoFinal = statementMeta?.saldoFinal ?? null;
  const undecided = plan
    ? plan.revisao.filter(({ line }) => {
        const decision = decisions.get(line.index);
        return !decision || decision.kind === "pular";
      }).length
    : 0;

  return (
    <FinanceiroPrivacyContext value={REVEALED_PRIVACY}>
      <Dialog.DialogRoot open={open} onOpenChange={handleOpenChange}>
        <Dialog.DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-background p-6 sm:max-w-3xl sm:p-8">
          <Dialog.DialogHeader>
            {step === "ia-duplicados" && aiReview ? (
              <>
                <Dialog.DialogTitle className="text-xl font-bold tracking-[-0.04em]">
                  A IA encontrou possíveis duplicatas
                </Dialog.DialogTitle>
                <Dialog.DialogDescription>
                  {aiReview.suspects.length} lançamento{aiReview.suspects.length === 1 ? "" : "s"} do extrato parece
                  {aiReview.suspects.length === 1 ? "" : "m"} repetir algo que você já tem. Os marcados serão
                  descartados (não entram no financeiro); desmarque os que forem movimentos diferentes.
                </Dialog.DialogDescription>
              </>
            ) : step === "duplicados" && duplicates ? (
              <>
                <Dialog.DialogTitle className="text-xl font-bold tracking-[-0.04em]">
                  Lançamentos parecidos já existem
                </Dialog.DialogTitle>
                <Dialog.DialogDescription>
                  Encontramos {duplicates.length} lançamento{duplicates.length === 1 ? "" : "s"} com a mesma data, valor
                  e descrição de algo que já está no seu extrato. Selecione os que quer importar mesmo assim, ou ignore
                  todos.
                </Dialog.DialogDescription>
              </>
            ) : step === "conciliacao" ? (
              <>
                <Dialog.DialogTitle className="text-xl font-bold tracking-[-0.04em]">
                  Conciliar com seus lançamentos provisórios
                </Dialog.DialogTitle>
                <Dialog.DialogDescription>
                  O extrato traz lançamentos que parecem os que você já registrou à mão. Conciliar mantém o seu
                  lançamento (categoria, cliente) e incorpora os dados oficiais do banco, sem contar o valor duas vezes.
                </Dialog.DialogDescription>
              </>
            ) : (
              <>
                <Dialog.DialogTitle className="text-xl font-bold tracking-[-0.04em]">
                  Importar extrato
                </Dialog.DialogTitle>
                <Dialog.DialogDescription>
                  Selecione o extrato exportado pelo seu banco (OFX, CSV ou PDF do Santander). Transações parecidas são
                  agrupadas para você revisar de uma vez.
                </Dialog.DialogDescription>
              </>
            )}
          </Dialog.DialogHeader>

          {step === "ia-duplicados" && aiReview ? (
            <ul className="space-y-2">
              {aiReview.suspects.map((suspect) => {
                const line = aiReview.novas[suspect.index];
                return (
                  <li key={suspect.index} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                    <Checkbox
                      className="mt-0.5"
                      aria-label={`Descartar ${line.descricao}`}
                      checked={aiDiscard.has(suspect.index)}
                      onCheckedChange={(checked) => toggleAiDiscard(suspect.index, checked === true)}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-medium">{line.descricao || "Sem descrição"}</p>
                      <p className="text-xs text-muted-foreground">
                        Extrato: {formatDate(line.data)} · {formatCurrency(fromCents(line.cents))} ·{" "}
                        {line.tipo === "gasto" ? "Saída" : "Ganho"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Já existe: {suspect.existing.descricao || "Sem descrição"} · {formatDate(suspect.existing.data)}{" "}
                        · {formatCurrency(suspect.existing.valor)}
                      </p>
                      {suspect.reason && <p className="text-xs italic text-muted-foreground">{suspect.reason}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : step === "duplicados" && duplicates ? (
            <ul className="space-y-2">
              {duplicates.map((duplicate, index) => (
                <li key={index} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <Checkbox
                    checked={selectedDuplicates.has(index)}
                    onCheckedChange={(checked) => toggleDuplicate(index, checked === true)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{duplicate.descricao || "Sem descrição"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(duplicate.data)} · {formatCurrency(duplicate.valor)} ·{" "}
                      {duplicate.tipo === "gasto" ? "Saída" : "Ganho"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : step === "conciliacao" && plan ? (
            <ConciliacaoReview
              plan={plan}
              provisionals={provisionals}
              rejectedAuto={rejectedAuto}
              decisions={decisions}
              onToggleAuto={(index, accepted) =>
                setRejectedAuto((current) => {
                  const next = new Set(current);
                  if (accepted) next.delete(index);
                  else next.add(index);
                  return next;
                })
              }
              onDecide={(index, decision) => setDecisions((current) => new Map(current).set(index, decision))}
            />
          ) : step === "arquivo" ? (
            <div className="space-y-2">
              <Label htmlFor="ofx-file">Arquivo .ofx, .csv ou .pdf</Label>
              <Input
                id="ofx-file"
                type="file"
                accept=".ofx,.qfx,.csv,.pdf"
                disabled={isParsing}
                onChange={(event) => void handleFileChange(event)}
                className="h-11"
              />
              {isParsing && <p className="text-sm text-muted-foreground">Lendo arquivo...</p>}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Esses dados são de qual banco?</Label>
                <Select.SelectRoot
                  value={bancoId ?? "none"}
                  onValueChange={(value) => setBancoId(value === "none" ? null : value)}
                >
                  <Select.SelectTrigger className="h-10 w-full bg-background sm:max-w-xs">
                    <Select.SelectValue>
                      {bancos.find((banco) => banco.id === bancoId)?.nome ?? "Não quero informar o banco"}
                    </Select.SelectValue>
                  </Select.SelectTrigger>
                  <Select.SelectContent>
                    <Select.SelectItem value="none">Não quero informar o banco</Select.SelectItem>
                    {bancos.map((banco) => (
                      <Select.SelectItem key={banco.id} value={banco.id}>
                        {banco.nome}
                      </Select.SelectItem>
                    ))}
                  </Select.SelectContent>
                </Select.SelectRoot>
                {!bancoId && (
                  <p className="text-xs text-muted-foreground">
                    Sem o banco não dá para conciliar com lançamentos provisórios nem registrar o saldo do extrato.
                  </p>
                )}
              </div>

              {aiConfigured && (
                <div className="space-y-3 rounded-lg border bg-card p-3 text-sm">
                  <label className="flex items-start gap-3">
                    <Checkbox
                      className="mt-0.5"
                      checked={useAiCheck}
                      onCheckedChange={(checked) => setUseAiCheck(checked === true)}
                    />
                    <span>
                      Pedir à IA para apontar possíveis duplicatas
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Envia ao provedor de IA configurado os lançamentos que você já tem no banco escolhido, dentro do
                        período abaixo (data, valor e descrição), junto com as linhas novas. Você decide o que
                        descartar.
                      </span>
                    </span>
                  </label>
                  {useAiCheck && (
                    <div className="space-y-2 pl-7">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor="ai-from">Comparar a partir de</Label>
                          <Input
                            id="ai-from"
                            type="date"
                            value={aiFrom}
                            onChange={(event) => setAiFrom(event.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="ai-to">Até</Label>
                          <Input
                            id="ai-to"
                            type="date"
                            value={aiTo}
                            onChange={(event) => setAiTo(event.target.value)}
                          />
                        </div>
                      </div>
                      {statementMeta?.periodo && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAiFrom(statementMeta.periodo?.inicio ?? "");
                            setAiTo(statementMeta.periodo?.fim ?? "");
                          }}
                        >
                          Usar o período do extrato
                        </Button>
                      )}
                      {!aiReady && (
                        <p className="text-xs text-amber-700">
                          {!bancoId
                            ? "Selecione o banco acima para enviar à IA."
                            : "Informe um período válido (início até fim) para enviar à IA."}{" "}
                          Enquanto isso, a checagem da IA não é feita.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {saldoFinal && (
                <label className="flex items-start gap-3 rounded-lg border bg-card p-3 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={useReference && Boolean(bancoId)}
                    disabled={!bancoId}
                    onCheckedChange={(checked) => setUseReference(checked === true)}
                  />
                  <span>
                    Usar o saldo de <strong>{formatCurrency(saldoFinal.valor)}</strong> em {formatDate(saldoFinal.data)}{" "}
                    como saldo de referência do banco
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      É a âncora do saldo confirmado.
                      {statementMeta?.saldoConfiavel
                        ? ""
                        : " Lido do texto do PDF e a leitura teve divergências: confira com o app do banco antes de marcar."}
                    </span>
                  </span>
                </label>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <TrendingUp className="size-4" />
                    <span className="text-xs font-bold uppercase tracking-[0.1em]">Ganhos</span>
                  </div>
                  <p className="mt-1 text-lg font-black text-emerald-800">+{formatCurrency(totalGanhos)}</p>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                  <div className="flex items-center gap-2 text-rose-800">
                    <TrendingDown className="size-4" />
                    <span className="text-xs font-bold uppercase tracking-[0.1em]">Saídas</span>
                  </div>
                  <p className="mt-1 text-lg font-black text-rose-800">-{formatCurrency(totalGastos)}</p>
                </div>
              </div>

              {ganhoGroups.length > 0 && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                    <TrendingUp className="size-4" />
                    Ganhos ({ganhoGroups.length})
                  </h3>
                  {ganhoGroups.map((group) => (
                    <OfxGroupCard
                      key={group.key}
                      group={group}
                      review={review[group.key]}
                      clients={clients}
                      categorias={categorias}
                      onUpdate={(patch) => updateReview(group.key, patch)}
                    />
                  ))}
                </div>
              )}

              {gastoGroups.length > 0 && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-rose-800">
                    <TrendingDown className="size-4" />
                    Saídas ({gastoGroups.length})
                  </h3>
                  {gastoGroups.map((group) => (
                    <OfxGroupCard
                      key={group.key}
                      group={group}
                      review={review[group.key]}
                      clients={clients}
                      categorias={categorias}
                      onUpdate={(patch) => updateReview(group.key, patch)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <Dialog.DialogFooter className="mt-4 border-t-0 bg-transparent p-0">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            {step === "ia-duplicados" && aiReview ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void handleResolveAiReview(false)}
                >
                  Importar tudo mesmo assim
                </Button>
                <Button type="button" disabled={busy} onClick={() => void handleResolveAiReview(true)}>
                  <Upload />
                  {busy
                    ? "Importando..."
                    : aiDiscard.size > 0
                      ? `Descartar ${aiDiscard.size} e continuar`
                      : "Continuar"}
                </Button>
              </>
            ) : step === "duplicados" && pending ? (
              <>
                <Button type="button" variant="outline" disabled={busy} onClick={() => void handleIgnoreDuplicates()}>
                  Ignorar duplicados
                </Button>
                <Button
                  type="button"
                  disabled={
                    busy ||
                    (pending.novas.length === 0 && pending.conciliacoes.length === 0 && selectedDuplicates.size === 0)
                  }
                  onClick={() => void handleConfirmDuplicates()}
                >
                  <Upload />
                  {busy ? "Importando..." : "Importar selecionados"}
                </Button>
              </>
            ) : step === "conciliacao" ? (
              <>
                <Button type="button" variant="outline" disabled={busy} onClick={() => setStep("grupos")}>
                  Voltar
                </Button>
                <Button type="button" disabled={busy} onClick={() => void handleContinueConciliacao()}>
                  <Upload />
                  {busy ? "Importando..." : undecided > 0 ? `Continuar (${undecided} sem decisão)` : "Continuar"}
                </Button>
              </>
            ) : (
              step === "grupos" && (
                <Button type="button" disabled={busy || includedCount === 0} onClick={() => void handleImport()}>
                  <Upload />
                  {busy ? "Analisando..." : `Importar ${includedCount} lançamento${includedCount === 1 ? "" : "s"}`}
                </Button>
              )
            )}
          </Dialog.DialogFooter>
        </Dialog.DialogContent>
      </Dialog.DialogRoot>
    </FinanceiroPrivacyContext>
  );
}
