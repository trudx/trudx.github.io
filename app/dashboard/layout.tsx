//* Components Imports
import { DashboardAuthGuard } from "./_components/dashboard-auth-guard";
import { DashboardSidebar } from "./_components/dashboard-sidebar";

//* Types Imports
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardAuthGuard>
      <div className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
        <aside className="w-full border-b bg-card px-4 py-3 lg:min-h-screen lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0 lg:px-2 lg:py-0">
          <DashboardSidebar />
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      </div>
    </DashboardAuthGuard>
  );
}
