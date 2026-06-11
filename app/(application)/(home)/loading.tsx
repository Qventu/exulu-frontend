import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level skeleton mirroring the Today layout (philosophy §6 — skeletons
 * mirror the real layout, no spinner walls): PageHeader (title/purpose +
 * primary action) → Resume card strip → Vitals stat grid → attention list.
 * Matches PageShell `content` + `max-w-6xl`. The desktop region order is
 * mirrored; the page itself reorders regions below `md`.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-4 md:p-8">
      {/* PageHeader */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-full sm:w-32" />
      </div>

      {/* Resume strip */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-56" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              className={
                index === 3
                  ? "hidden h-24 w-full rounded-lg sm:block"
                  : "h-24 w-full rounded-lg"
              }
            />
          ))}
        </div>
      </div>

      {/* Vitals grid */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-36" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Needs attention list */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-44" />
        <div className="divide-y rounded-lg border">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex min-h-11 items-center gap-3 px-3 py-2.5">
              <Skeleton className="size-2 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-full max-w-sm" />
              <Skeleton className="ml-auto h-3 w-12 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
