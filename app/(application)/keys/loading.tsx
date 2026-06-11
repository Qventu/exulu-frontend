import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level skeleton mirroring the /keys layout (PageShell content variant:
 * PageHeader → Toolbar search → table at md+, card list below md — the
 * skeleton mirrors the mobile layout too, responsive.md §5).
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-4 md:p-8">
      {/* PageHeader: title + purpose line + primary action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-full sm:w-32" />
      </div>

      <div className="space-y-4">
        {/* Toolbar search */}
        <Skeleton className="h-10 w-full md:max-w-sm" />

        {/* Card list below md */}
        <div className="space-y-2 md:hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-2 rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>

        {/* Table at md+ */}
        <div className="hidden rounded-md border md:block">
          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-full" />
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
