import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level skeleton mirroring the /token layout (PageShell narrow:
 * PageHeader + the single token card).
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 p-4 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-10 w-full sm:w-32" />
      </div>
      <div className="space-y-4 rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
