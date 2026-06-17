import { PageShell } from "@/components/primitives/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton mirroring the real /configuration layout: stacked header (title +
 * actions wrap on phones), then the two-pane grid — token editor rows left,
 * preview card right (inline ≥ lg only, matching the Sheet behavior below).
 */
export default function Loading() {
  return (
    <PageShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Skeleton className="h-10 w-full sm:w-24 lg:hidden" />
          <Skeleton className="h-10 w-full sm:w-10" />
          <Skeleton className="h-10 w-full sm:w-32" />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Skeleton className="h-11 w-full md:h-10 md:w-56" />
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Skeleton className="h-11 w-full md:h-9 md:max-w-xs" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-x-2 md:grid-cols-[16px_220px_minmax(0,1fr)_auto]"
              >
                <Skeleton className="size-4 rounded-sm" />
                <Skeleton className="h-4 w-32 max-w-full" />
                <Skeleton className="col-span-3 h-11 md:col-span-1 md:col-start-3 md:row-start-1 md:h-8" />
                <span className="hidden md:col-start-4 md:block md:size-8" />
              </div>
            ))}
          </div>
        </div>
        <Skeleton className="hidden h-96 w-full rounded-lg lg:block" />
      </div>
    </PageShell>
  );
}
