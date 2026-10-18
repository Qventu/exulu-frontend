import { PageShell } from "@/components/primitives/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageShell>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-96" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </PageShell>
  );
}
