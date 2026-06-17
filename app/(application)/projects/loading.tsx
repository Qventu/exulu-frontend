import { Skeleton } from "@/components/ui/skeleton";

import { ProjectListSkeleton } from "./components/skeletons";

/**
 * Route-level skeleton mirroring the /projects index (PageShell content
 * variant capped at max-w-4xl: PageHeader with primary action → Toolbar
 * search → grouped row list). Rows reuse the same skeleton markup as the
 * in-page loading state (components/skeletons.tsx).
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 p-4 md:p-8">
      {/* PageHeader: title + purpose line + primary action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-full sm:w-36" />
      </div>

      <div className="space-y-4">
        {/* Toolbar search */}
        <Skeleton className="h-10 w-full md:max-w-sm" />
        <ProjectListSkeleton />
      </div>
    </div>
  );
}
