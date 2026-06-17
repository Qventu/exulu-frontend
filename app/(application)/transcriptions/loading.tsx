import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level skeleton mirroring the redesigned page layout:
 * PageHeader (title/purpose + primary action) → Toolbar (search) →
 * queue group (label + rows). Matches PageShell `content` + `max-w-4xl`.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 p-4 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-full sm:w-44" />
      </div>
      <Skeleton className="h-9 w-full md:max-w-sm" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
