"use client";

//* Libraries Imports
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

//* Hooks Imports
import { useAppDataRefresh } from "@/hooks/use-app-data-refresh";

//* Services Imports
import { get, getAll, patch, post, remove } from "@/services/api-service";
import { getAuthenticatedUserId } from "@/services/auth-service";

//* Utils Imports
import { getApiErrorMessage, isUniqueViolation } from "@/lib/api-error";
import { suggestCategoriaId } from "@/lib/financeiro/categorize";

export type CategoriaRecord = {
  id: string;
  user_id: string;
  nome: string;
  termos: string[];
  created_at: string;
};

const TABLE = "financeiro_categorias";
const SELECT_COLUMNS = "id,user_id,nome,termos,created_at";

/** Ponto de partida sugerido quando o usuário ainda não tem categorias. Editável depois. */
export const SUGGESTED_CATEGORIAS: { nome: string; termos: string[] }[] = [
  { nome: "Alimentação", termos: ["restaurante", "lanchonete", "ifood", "padaria"] },
  { nome: "Mercado", termos: ["mercado", "supermercado", "atacadao"] },
  { nome: "Transporte", termos: ["uber", "99", "combustivel", "posto", "estacionamento"] },
  { nome: "Moradia", termos: ["aluguel", "condominio", "energia", "agua", "internet"] },
  { nome: "Assinaturas", termos: ["netflix", "spotify", "assinatura"] },
  { nome: "Lazer", termos: ["cinema", "show", "viagem"] },
  { nome: "Serviços", termos: ["servico", "tarifa", "seguro"] },
  { nome: "Outros", termos: [] },
];

function cleanTermos(termos: string[]) {
  return [...new Set(termos.map((termo) => termo.trim()).filter(Boolean))];
}

export function useFinanceiroCategorias() {
  const [categorias, setCategorias] = useState<CategoriaRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchCategorias = useCallback(async () => {
    setIsLoading(true);

    try {
      const userId = await getAuthenticatedUserId();
      setCategorias(
        await get<CategoriaRecord>(TABLE, {
          select: SELECT_COLUMNS,
          filters: { user_id: userId },
          order: [{ column: "nome", ascending: true }],
        }),
      );
    } catch (error) {
      // Migração ainda não aplicada ou falha de rede: o financeiro segue funcionando sem categorias.
      console.error("Erro ao listar categorias:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useAppDataRefresh(fetchCategorias, ["financeiro_categorias"]);

  useEffect(() => {
    // The initial request owns its loading state inside fetchCategorias.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCategorias();
  }, [fetchCategorias]);

  async function run(action: () => Promise<unknown>, successMessage: string, errorMessage: string) {
    setIsSaving(true);
    try {
      await action();
      await fetchCategorias();
      toast.success(successMessage);
      return true;
    } catch (error) {
      toast.error(
        isUniqueViolation(error) ? "Já existe uma categoria com esse nome" : errorMessage,
        {
          description: isUniqueViolation(error)
            ? undefined
            : getApiErrorMessage(error, "Tente novamente em alguns instantes."),
        },
      );
      console.error(errorMessage, error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function createCategoria(nome: string, termos: string[]) {
    if (!nome.trim()) {
      toast.error("Informe o nome da categoria");
      return false;
    }
    const userId = await getAuthenticatedUserId();
    return run(
      () => post(TABLE, { user_id: userId, nome: nome.trim(), termos: cleanTermos(termos) }),
      "Categoria criada",
      "Não foi possível criar a categoria",
    );
  }

  async function updateCategoria(id: string, nome: string, termos: string[]) {
    if (!nome.trim()) {
      toast.error("Informe o nome da categoria");
      return false;
    }
    const userId = await getAuthenticatedUserId();
    return run(
      () =>
        patch(TABLE, { nome: nome.trim(), termos: cleanTermos(termos) }, { id, user_id: userId }),
      "Categoria atualizada",
      "Não foi possível atualizar a categoria",
    );
  }

  async function deleteCategoria(id: string) {
    const userId = await getAuthenticatedUserId();
    return run(
      () => remove(TABLE, { id, user_id: userId }),
      "Categoria removida",
      "Não foi possível remover a categoria",
    );
  }

  async function createSuggested() {
    const userId = await getAuthenticatedUserId();
    return run(
      () =>
        post(
          TABLE,
          SUGGESTED_CATEGORIAS.map((categoria) => ({ ...categoria, user_id: userId })),
        ),
      "Categorias sugeridas criadas",
      "Não foi possível criar as categorias",
    );
  }

  /**
   * Categoriza o histórico sem categoria pelas palavras-chave. Só toca em lançamentos sem categoria
   * e só quando há correspondência — nunca sobrescreve uma escolha do usuário.
   */
  async function applyRulesToHistory() {
    setIsSaving(true);
    try {
      const userId = await getAuthenticatedUserId();
      const rows = await getAll<{ id: string; descricao: string | null }>("financeiro", {
        select: "id,descricao",
        filters: { user_id: userId, categoria_id: null },
        order: [{ column: "id", ascending: true }],
      });

      const byCategoria = new Map<string, string[]>();
      for (const row of rows) {
        const categoriaId = suggestCategoriaId(row.descricao, categorias);
        if (categoriaId)
          byCategoria.set(categoriaId, [...(byCategoria.get(categoriaId) ?? []), row.id]);
      }

      let updated = 0;
      for (const [categoriaId, ids] of byCategoria) {
        // Lotes pequenos: os ids vão na URL do PostgREST.
        for (let i = 0; i < ids.length; i += 80) {
          const chunk = ids.slice(i, i + 80);
          await patch(
            "financeiro",
            { categoria_id: categoriaId },
            { id: chunk, user_id: userId, categoria_id: null },
          );
          updated += chunk.length;
        }
      }

      toast.success(
        updated > 0
          ? `${updated} lançamento${updated === 1 ? "" : "s"} categorizado${updated === 1 ? "" : "s"}`
          : "Nenhum lançamento novo para categorizar",
      );
      return updated;
    } catch (error) {
      toast.error("Não foi possível aplicar as categorias", {
        description: getApiErrorMessage(error, "Tente novamente em alguns instantes."),
      });
      console.error("Erro ao aplicar regras de categoria:", error);
      return 0;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    applyRulesToHistory,
    categorias,
    isLoading,
    isSaving,
    createCategoria,
    updateCategoria,
    deleteCategoria,
    createSuggested,
    refreshCategorias: fetchCategorias,
  };
}
