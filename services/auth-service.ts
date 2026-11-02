"use client";

//* Services Imports
import { supabase } from "@/hooks/supabase";

/**
 * Id do usuário logado.
 *
 * Autenticação continua no `supabase-js`: ele cuida de sessão, refresh de token e persistência —
 * coisas que não são REST e que não faria sentido reimplementar sobre o Axios.
 *
 * Lê da sessão local (`getSession`) em vez de `getUser`, que faria uma ida ao servidor de auth
 * antes de TODA operação. O id aqui só monta filtros; quem garante o acesso é a RLS, que valida o
 * token em cada requisição. A validação do usuário contra o servidor fica no guard do dashboard.
 */
export async function getAuthenticatedUserId() {
  const { data, error } = await supabase.auth.getSession();
  const userId = data.session?.user.id;

  if (error || !userId) {
    throw new Error("Sua sessão expirou. Entre novamente.");
  }

  return userId;
}
