"use client";

//* Libraries Imports
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

//* Services Imports
import { getOne, remove, rpc } from "@/services/api-service";
import { getAuthenticatedUserId } from "@/services/auth-service";

//* Utils Imports
import { getApiErrorMessage } from "@/lib/api-error";

export type McpTokenRecord = { token: string; created_at: string };

/** Token pessoal do MCP: um por conta. Gerar outro invalida o anterior no mesmo instante. */
export function useMcpToken() {
  const [token, setToken] = useState<McpTokenRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchToken = useCallback(async () => {
    setIsLoading(true);
    try {
      const userId = await getAuthenticatedUserId();
      setToken(
        await getOne<McpTokenRecord>("mcp_tokens", {
          select: "token,created_at",
          filters: { user_id: userId },
        }),
      );
    } catch (error) {
      toast.error("Não foi possível carregar o token do MCP", {
        description: getApiErrorMessage(error, "Tente atualizar a página novamente."),
      });
      console.error("Erro ao carregar token do MCP:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // The initial request owns its loading state inside fetchToken.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchToken();
  }, [fetchToken]);

  async function regenerateToken() {
    setIsSaving(true);
    try {
      const created = await rpc<McpTokenRecord>("mcp_regenerate_token");
      setToken({ token: created.token, created_at: created.created_at });
      toast.success(token ? "Novo token gerado" : "Token gerado", {
        description: token
          ? "O token anterior parou de funcionar. Atualize-o nas IAs conectadas."
          : "Copie e configure na IA que vai usar o MCP.",
      });
      return true;
    } catch (error) {
      toast.error("Não foi possível gerar o token", {
        description: getApiErrorMessage(error, "Tente novamente em alguns instantes."),
      });
      console.error("Erro ao gerar token do MCP:", error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function revokeToken() {
    setIsSaving(true);
    try {
      const userId = await getAuthenticatedUserId();
      await remove("mcp_tokens", { user_id: userId });
      setToken(null);
      toast.success("Acesso revogado", {
        description: "Nenhuma IA consegue mais usar o MCP até você gerar um token.",
      });
      return true;
    } catch (error) {
      toast.error("Não foi possível revogar o token", {
        description: getApiErrorMessage(error, "Tente novamente em alguns instantes."),
      });
      console.error("Erro ao revogar token do MCP:", error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  return { token, isLoading, isSaving, regenerateToken, revokeToken };
}
