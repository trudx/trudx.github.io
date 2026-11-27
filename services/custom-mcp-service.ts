"use client";

//* Services Imports
import { getAll, patch, post, remove } from "@/services/api-service";
import { getAuthenticatedUserId } from "@/services/auth-service";

//* Types Imports
import type { CustomMcpServer } from "@/lib/ai/custom-mcp-config";

const TABLE = "mcp_custom_servers";
const FIELDS = "id,name,url,headers,enabled_tools";

type ServerInput = Omit<CustomMcpServer, "id">;

export function listCustomMcpServers(userId: string) {
  return getAll<CustomMcpServer>(TABLE, {
    select: FIELDS,
    filters: { user_id: userId },
    order: [{ column: "name" }, { column: "id" }],
  });
}

export async function saveCustomMcpServer(userId: string, input: ServerInput, id?: string) {
  if (userId !== (await getAuthenticatedUserId())) throw new Error("Sua conta mudou.");

  const [saved] = id
    ? await patch<CustomMcpServer>(TABLE, input, { id, user_id: userId }, { select: FIELDS })
    : await post<CustomMcpServer>(TABLE, { ...input, user_id: userId }, { select: FIELDS });
  if (!saved) throw new Error("O servidor não está disponível para edição.");
  return saved;
}

export async function removeCustomMcpServer(userId: string, id: string) {
  if (userId !== (await getAuthenticatedUserId())) throw new Error("Sua conta mudou.");
  await remove(TABLE, { id, user_id: userId });
}
