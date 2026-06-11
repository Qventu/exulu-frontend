import { PageShell } from "@/components/primitives/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageShell variant="narrow">
      <div className="space-y-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="space-y-4 rounded-lg border p-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-48 w-full" />
        <div className="flex justify-end">
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
    </PageShell>
  );
}
