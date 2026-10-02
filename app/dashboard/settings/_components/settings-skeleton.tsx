//* Components Imports
import Skeleton from "@/components/ui/skeleton";

import { LabelSkeleton } from "@/components/label-skeleton";

export function SettingsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando dados da conta" className="rounded-xl border bg-card p-5">
      <div className="space-y-4">
        <Skeleton className="mb-5 h-12 w-64 max-w-full" />
        <LabelSkeleton />
        <LabelSkeleton />
        <LabelSkeleton />

        <div className="flex justify-end pt-2">
          <Skeleton className="h-8 w-36" />
        </div>
      </div>
    </div>
  );
}
