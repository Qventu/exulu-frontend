import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared skeleton markup for /projects — consumed both by the route-level
 * loading.tsx files and by the client pages while their queries resolve, so
 * the two states are pixel-identical (philosophy §6: skeletons mirror the
 * real layout). Pure presentational JSX — server- and client-renderable.
 */

/** One index list row: avatar · name · time · star. */
export function ProjectRowSkeleton() {
  return (
    <div className="flex min-h-[44px] items-center gap-3 rounded-md p-3">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <Skeleton className="h-4 w-40 max-w-[50%]" />
      <Skeleton className="ml-auto h-3 w-20" />
      <Skeleton className="size-5 rounded-md" />
    </div>
  );
}

/** Index list body (group label + rows), used under the real header. */
export function ProjectListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-1" aria-hidden="true">
      <Skeleton className="mx-3 h-3 w-24" />
      {Array.from({ length: rows }).map((_, index) => (
        <ProjectRowSkeleton key={index} />
      ))}
    </div>
  );
}

/** One session row: icon · two text lines · menu. */
export function SessionRowSkeleton() {
  return (
    <div className="flex min-h-[44px] items-center gap-3 rounded-md border border-border p-3">
      <Skeleton className="size-4 shrink-0 rounded" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-48 max-w-[70%]" />
        <Skeleton className="h-3 w-32 max-w-[50%]" />
      </div>
      <Skeleton className="size-8 shrink-0 rounded-md" />
    </div>
  );
}

/** Detail surface: breadcrumb · header (avatar/title/action) · tabs · rows. */
export function ProjectDetailSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-10 w-full sm:w-64" />
        </div>
      </div>
      <div className="space-y-6">
        <Skeleton className="h-10 w-full sm:w-72" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <SessionRowSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
