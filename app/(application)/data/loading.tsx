import { PageShell } from "@/components/primitives/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level Suspense fallback for /data. Mirrors the real ContextLibrary
 * shape — PageShell → PageHeader (title + description + meta, no primary
 * action) → Toolbar search → bordered row list — so the skeleton lines up
 * with the loaded UI instead of the retired 2-column dashboard. The row-list
 * skeleton matches ContextLibrary's own in-query skeleton.
 */
export default function Loading() {
  return (
    <PageShell variant="content">
      {/* Header (PageHeader: title + description + quiet meta line). */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>

      <div className="flex flex-col gap-4">
        {/* Toolbar search. */}
        <Skeleton className="h-9 w-full max-w-xs" />

        {/* Bordered context row list. */}
        <div className="rounded-md border">
          <ul className="divide-y divide-border" aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <li
                key={index}
                className="flex items-center gap-3 px-3 py-4 md:px-4"
              >
                <Skeleton className="size-2 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48 max-w-full" />
                  <Skeleton className="hidden h-3 w-64 max-w-full md:block" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PageShell>
  );
}
