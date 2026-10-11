"use client";

//* Components Imports
import Checkbox from "@/components/ui/checkbox";
import RadioGroup from "@/components/ui/radio-group";

//* Libraries Imports
import { ArrowLeftRight, Link2 } from "lucide-react";

//* Hooks Imports
import { useFinanceiroPrivacy } from "./financeiro-privacy";

//* Types Imports
import type {
  Candidate,
  ImportedLine,
  ProvisionalLine,
  ReconciliationPlan,
  ReviewDecision,
} from "@/lib/financeiro/reconciliation";

//* Utils Imports
import { fromCents } from "@/lib/financeiro/money";
import { formatDate } from "@/lib/format-date";

const NOVA = "__nova";
const PULAR = "__pular";

type ConciliacaoReviewProps = {
  plan: ReconciliationPlan;
  provisionals: Map<string, ProvisionalLine>;
  /** Casamentos automáticos que o usuário recusou (a linha entra como lançamento novo). */
  rejectedAuto: Set<number>;
  decisions: Map<number, ReviewDecision>;
  onToggleAuto: (index: number, accepted: boolean) => void;
  onDecide: (index: number, decision: ReviewDecision) => void;
};

function PairSummary({
  line,
  provisional,
}: {
  line: ImportedLine;
  provisional: ProvisionalLine | undefined;
}) {
  const { formatValor } = useFinanceiroPrivacy();
  const dateDiffers = provisional && provisional.data !== line.data;

  return (
    <div className="min-w-0 flex-1 space-y-0.5 text-sm">
      <p className="truncate font-medium" title={provisional?.descricao ?? undefined}>
        {provisional?.descricao || "Sem descrição"}
        <span className="font-normal text-muted-foreground"> · seu lançamento</span>
      </p>
      <p
        className="flex items-center gap-1.5 truncate text-xs text-muted-foreground"
        title={line.descricao}
      >
        <ArrowLeftRight className="size-3 shrink-0" />
        {line.descricao}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatValor(fromCents(line.cents))} · {formatDate(line.data)}
        {dateDiffers && (
          <span className="text-amber-700 dark:text-amber-400">
            {" "}
            (você lançou em {formatDate(provisional.data)})
          </span>
        )}
      </p>
    </div>
  );
}

export function ConciliacaoReview({
  plan,
  provisionals,
  rejectedAuto,
  decisions,
  onToggleAuto,
  onDecide,
}: ConciliacaoReviewProps) {
  const { formatValor } = useFinanceiroPrivacy();

  const usedElsewhere = (index: number) =>
    new Set(
      [...decisions.entries()]
        .filter(([other, decision]) => other !== index && decision.kind === "conciliar")
        .map(([, decision]) => (decision as { provisionalId: string }).provisionalId),
    );

  function valueOf(index: number) {
    const decision = decisions.get(index);
    if (!decision || decision.kind === "pular") return PULAR;
    return decision.kind === "nova" ? NOVA : decision.provisionalId;
  }

  function handleChange(index: number, value: string) {
    if (value === PULAR) onDecide(index, { kind: "pular" });
    else if (value === NOVA) onDecide(index, { kind: "nova" });
    else onDecide(index, { kind: "conciliar", provisionalId: value });
  }

  function describeCandidate(candidate: Candidate, line: ImportedLine) {
    const provisional = provisionals.get(candidate.provisionalId);
    const diff =
      candidate.diasDiferenca === 0
        ? "mesma data"
        : `${candidate.diasDiferenca} dia${candidate.diasDiferenca === 1 ? "" : "s"} de diferença`;
    return `${provisional?.descricao || "Sem descrição"} · ${formatDate(provisional?.data ?? line.data)} · ${formatValor(fromCents(line.cents))} · ${diff}`;
  }

  return (
    <div className="space-y-6">
      {plan.automaticos.length > 0 && (
        <section className="space-y-2" aria-label="Conciliações automáticas">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Link2 className="size-4" />
            Serão conciliados automaticamente ({plan.automaticos.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            Mesmo banco, valor, tipo e data, e só um candidato possível. Desmarque para importar
            como lançamento novo e manter o seu provisório.
          </p>
          <ul className="space-y-2">
            {plan.automaticos.map(({ line, provisionalId }) => (
              <li key={line.index} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                <Checkbox
                  className="mt-1"
                  checked={!rejectedAuto.has(line.index)}
                  onCheckedChange={(checked) => onToggleAuto(line.index, checked === true)}
                  aria-label={`Conciliar ${line.descricao}`}
                />
                <PairSummary line={line} provisional={provisionals.get(provisionalId)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.revisao.length > 0 && (
        <section className="space-y-2" aria-label="Conciliações que precisam de decisão">
          <h3 className="text-sm font-bold">Precisam da sua decisão ({plan.revisao.length})</h3>
          <p className="text-xs text-muted-foreground">
            Há mais de uma possibilidade (ou a data diverge). Nada é conciliado sem a sua escolha;
            sem escolha, a linha não é importada agora.
          </p>
          <ul className="space-y-3">
            {plan.revisao.map(({ line, candidatos }) => {
              const taken = usedElsewhere(line.index);
              return (
                <li key={line.index} className="space-y-3 rounded-lg border bg-card p-3">
                  <div>
                    <p className="text-sm font-medium">{line.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      No extrato: {formatValor(fromCents(line.cents))} · {formatDate(line.data)}
                    </p>
                  </div>
                  <RadioGroup.RadioGroupRoot
                    value={valueOf(line.index)}
                    onValueChange={(value) => handleChange(line.index, String(value))}
                    aria-label={`Decisão para ${line.descricao}`}
                  >
                    {candidatos.map((candidate) => (
                      <label
                        key={candidate.provisionalId}
                        className="flex cursor-pointer items-start gap-2 text-sm"
                      >
                        <RadioGroup.RadioGroupItem
                          value={candidate.provisionalId}
                          disabled={taken.has(candidate.provisionalId)}
                          className="mt-0.5"
                        />
                        <span>
                          Conciliar com: {describeCandidate(candidate, line)}
                          {taken.has(candidate.provisionalId) && (
                            <span className="text-xs text-muted-foreground">
                              {" "}
                              (já usado em outra linha)
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <RadioGroup.RadioGroupItem value={NOVA} className="mt-0.5" />
                      <span>Não é nenhum deles: importar como novo e manter os provisórios</span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-muted-foreground">
                      <RadioGroup.RadioGroupItem value={PULAR} className="mt-0.5" />
                      <span>Decidir depois (não importar esta linha agora)</span>
                    </label>
                  </RadioGroup.RadioGroupRoot>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
