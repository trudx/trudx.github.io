"use client";

//* Libraries Imports
import { useEffect } from "react";
import { useRouter } from "next/navigation";

//* Services Imports
import { supabase } from "@/hooks/supabase";

//* Utils Imports
import { readLastDashboardRoute } from "@/lib/last-dashboard-route";

/** Quem já tem sessão e abre o site pela landing volta direto para a última aba usada. */
export function LastRouteRedirect() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function redirectToLastRoute() {
      const lastRoute = readLastDashboardRoute();
      if (!lastRoute) return;

      // `getSession` lê a sessão local sem ir à rede; o guard do dashboard valida o usuário de fato.
      const { data } = await supabase.auth.getSession();
      if (isMounted && data.session) router.replace(lastRoute);
    }

    void redirectToLastRoute();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return null;
}
