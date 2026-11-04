"use client";

//* Libraries Imports
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

//* Services Imports
import { supabase } from "@/hooks/supabase";

//* Types Imports
import type { ReactNode } from "react";

//* Utils Imports
import { readLastDashboardRoute, saveLastDashboardRoute } from "@/lib/last-dashboard-route";

export function DashboardAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const entryPathname = useRef(pathname);
  const [isChecking, setIsChecking] = useState(true);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);

  if (pendingRoute && pathname === pendingRoute) setPendingRoute(null);

  useEffect(() => {
    let isMounted = true;

    async function checkUser() {
      const { data, error } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (error || !data.user) {
        router.replace("/login");
        return;
      }

      // Só reabre a última aba quando o site entra pela raiz do dashboard (login, PWA); um link
      // direto para outra aba é respeitado.
      const lastRoute = readLastDashboardRoute();
      if (entryPathname.current === "/dashboard" && lastRoute && lastRoute !== "/dashboard") {
        setPendingRoute(lastRoute);
        router.replace(lastRoute);
      }

      setIsChecking(false);
    }

    void checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        router.replace("/login");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    // Enquanto a última aba é restaurada, a raiz ainda está na URL e sobrescreveria o valor salvo.
    if (isChecking || pendingRoute) return;
    saveLastDashboardRoute(pathname);
  }, [isChecking, pendingRoute, pathname]);

  if (isChecking || pendingRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex items-center gap-3 rounded-md border bg-card px-5 py-4 text-sm font-semibold shadow-sm">
          <span className="size-2 animate-pulse rounded-full bg-foreground" />
          Verificando sua sessão...
        </div>
      </div>
    );
  }

  return children;
}
