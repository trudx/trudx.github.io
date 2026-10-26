"use client";

//* Libraries Imports
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

//* Services Imports
import { getAll, getOne, rpc } from "@/services/api-service";
import { getAuthenticatedUserId } from "@/services/auth-service";

//* Types Imports
import type { FinanceiroNatureza } from "@/lib/financeiro/types";
import type { ProvisionalLine } from "@/lib/financeiro/reconciliation";

//* Utils Imports
import { getApiErrorMessage } from "@/lib/api-error";
import { addDays } from "@/lib/financeiro/analytics";
import { toCents } from "@/lib/financeiro/money";

export type ImportacaoRecord = {
  id: string;
  banco_id: string | null;
  arquivo: string | null;
  formato: "ofx" | "pdf" | "csv" | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  inseridas: number;
  conciliadas: number;
  created_at: string;
};

/** Linha do extrato como o servidor a recebe. `valor` em reais (positivo); o sinal vem de `tipo`. */
export type ImportLinePayload = {
  data: string;
  valor: number;
  tipo: "gasto" | "ganho";
  descricao: string;
  fitid: string;
  natureza: FinanceiroNatureza;
  cliente_id: string | null;
  categoria_id: string | null;
};

export type ApplyImportParams = {
  bancoId: string | null;
  arquivo: string;
  formato: "ofx" | "pdf" | "csv";
  periodo: { inicio: string; fim: string } | null;
  saldoReferencia: { data: string; valor: number } | null;
  novas: ImportLinePayload[];
  conciliacoes: (ImportLinePayload & { id: string })[];
};

export type ApplyImportResult = {
  lote_id: string | null;
  inseridas: number;
  conciliadas: number;
  ignoradas: number;
};

const IMPORT_COLUMNS =
  "id,banco_id,arquivo,formato,periodo_inicio,periodo_fim,inseridas,conciliadas,created_at";
// Margem além da tolerância do motor de conciliação, para o gasto fixo (tolerância maior) não ficar de fora.
const SEARCH_MARGIN_DAYS = 7;

/**
 * Importação de extratos com conciliação.
 *
 * O plano (quem casa com quem) é calculado no app, mas aplicado por uma função do Postgres numa
 * única transação: ou o lote inteiro entra, ou nada muda. Desfazer também é por lote, restaurando
 * os provisórios conciliados em vez de apagá-los.
 */
export function useFinanceiroImportacao(onChanged: () => void | Promise<void>) {
  const [lastImport, setLastImport] = useState<ImportacaoRecord | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  const fetchLastImport = useCallback(async () => {
    try {
      const userId = await getAuthenticatedUserId();
      const data = await getOne<ImportacaoRecord>("financeiro_importacoes", {
        select: IMPORT_COLUMNS,
        filters: { user_id: userId, desfeita_em: null },
        order: [{ column: "created_at", ascending: false }],
      });
      setLastImport(data);
    } catch (error) {
      // Sem a tabela (migração ainda não aplicada) o botão de desfazer simplesmente não aparece.
      setLastImport(null);
      console.error("Erro ao buscar última importação:", error);
    }
  }, []);

  useEffect(() => {
    // The initial request owns its state inside fetchLastImport.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLastImport();
  }, [fetchLastImport]);

  /** Provisórios ainda livres do banco, na janela de datas do lote (mais a margem de tolerância). */
  async function findProvisionals(bancoId: string, minDate: string, maxDate: string) {
    try {
      const userId = await getAuthenticatedUserId();
      const rows = await getAll<{
        id: string;
        data: string;
        tipo: ProvisionalLine["tipo"];
        valor: number | string;
        descricao: string | null;
        fitid: string | null;
        gasto_fixo_id: string | null;
      }>("financeiro", {
        select: "id,data,tipo,valor,descricao,fitid,gasto_fixo_id",
        filters: {
          user_id: userId,
          banco_id: bancoId,
          status: "provisorio",
          fitid: null,
          data: {
            gte: addDays(minDate, -SEARCH_MARGIN_DAYS),
            lte: addDays(maxDate, SEARCH_MARGIN_DAYS),
          },
        },
        order: [{ column: "id", ascending: true }],
      });

      return rows.map<ProvisionalLine>((row) => ({ ...row, cents: toCents(Number(row.valor)) }));
    } catch (error) {
      toast.error("Não foi possível buscar os lançamentos provisórios", {
        description: getApiErrorMessage(error, "Tente novamente em alguns instantes."),
      });
      console.error("Erro ao buscar provisórios:", error);
      return null;
    }
  }

  async function applyImport(params: ApplyImportParams): Promise<ApplyImportResult | null> {
    setIsApplying(true);

    try {
      await getAuthenticatedUserId();
      const result = await rpc<ApplyImportResult>("financeiro_aplicar_importacao", {
        p_banco_id: params.bancoId,
        p_arquivo: params.arquivo,
        p_formato: params.formato,
        p_periodo_inicio: params.periodo?.inicio ?? null,
        p_periodo_fim: params.periodo?.fim ?? null,
        p_saldo_data: params.saldoReferencia?.data ?? null,
        p_saldo: params.saldoReferencia?.valor ?? null,
        p_novas: params.novas,
        p_conciliacoes: params.conciliacoes,
      });

      await fetchLastImport();
      await onChanged();

      const partes = [
        result.inseridas > 0 && `${result.inseridas} novo${result.inseridas === 1 ? "" : "s"}`,
        result.conciliadas > 0 &&
          `${result.conciliadas} conciliado${result.conciliadas === 1 ? "" : "s"}`,
      ].filter(Boolean);
      toast.success(
        partes.length > 0
          ? `Importação concluída: ${partes.join(" · ")}`
          : "Nada novo para importar",
        {
          description:
            result.ignoradas > 0
              ? `${result.ignoradas} já estava${result.ignoradas === 1 ? "" : "m"} no financeiro e ${result.ignoradas === 1 ? "foi ignorado" : "foram ignorados"}.`
              : undefined,
        },
      );
      return result;
    } catch (error) {
      toast.error("Não foi possível importar o extrato", {
        description: getApiErrorMessage(
          error,
          "Nada foi alterado. Tente novamente em alguns instantes.",
        ),
      });
      console.error("Erro ao aplicar importação:", error);
      return null;
    } finally {
      setIsApplying(false);
    }
  }

  async function undoLastImport() {
    if (!lastImport) return false;
    setIsUndoing(true);

    try {
      await getAuthenticatedUserId();
      const result = await rpc<{ restauradas: number; removidas: number }>(
        "financeiro_desfazer_importacao",
        {
          p_lote: lastImport.id,
        },
      );

      await fetchLastImport();
      await onChanged();
      toast.success("Importação desfeita", {
        description: `${result.removidas} lançamento${result.removidas === 1 ? "" : "s"} removido${result.removidas === 1 ? "" : "s"} · ${result.restauradas} provisório${result.restauradas === 1 ? "" : "s"} restaurado${result.restauradas === 1 ? "" : "s"}.`,
      });
      return true;
    } catch (error) {
      toast.error("Não foi possível desfazer a importação", {
        description: getApiErrorMessage(
          error,
          "Nada foi alterado. Tente novamente em alguns instantes.",
        ),
      });
      console.error("Erro ao desfazer importação:", error);
      return false;
    } finally {
      setIsUndoing(false);
    }
  }

  return { lastImport, isApplying, isUndoing, findProvisionals, applyImport, undoLastImport };
}
