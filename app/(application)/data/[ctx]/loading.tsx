/**
 * Route-level loading skeleton mirroring the workspace layout:
 * PageHeader (breadcrumb + title + action) → Tabs → Toolbar →
 * full-width items table.
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-48" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <Skeleton className="h-10 w-64" />

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Skeleton className="h-10 w-full md:max-w-sm" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="ml-auto h-10 w-44" />
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
