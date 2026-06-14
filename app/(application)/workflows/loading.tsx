import { PageShell } from "@/components/primitives/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for /workflows (Routines).
 *
 * Mirrors the new shell layout: PageHeader (no primary action),
 * Toolbar (search + view slot), table skeleton (8 rows), with a slim aside
 * placeholder at lg+ (matching the ListDetail docked-panel right column).
 */
export default function Loading() {
  return (
    <PageShell variant="content">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-10 w-full max-w-xs" />
          <Skeleton className="hidden h-6 w-24 md:block" />
        </div>

        <div className="flex min-h-[60vh] gap-0 overflow-hidden rounded-md border bg-card">
          <div className="flex-1 space-y-2 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
          <div className="hidden w-[420px] shrink-0 border-l p-4 lg:block">
            <div className="space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
