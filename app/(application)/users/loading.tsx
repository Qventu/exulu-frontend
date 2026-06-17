import { PageShell } from "@/components/primitives/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton mirroring the AccessSurface composition: PageHeader +
 * Tabs strip + Toolbar + table rows. Replaces the legacy single-table
 * skeleton.
 */
export default function Loading() {
  return (
    <PageShell variant="content">
      {/* PageHeader */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Tabs */}
      <Skeleton className="h-10 w-72 max-w-full" />

      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <Skeleton className="h-9 w-full max-w-sm" />

        {/* Table rows */}
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </PageShell>
  );
}
