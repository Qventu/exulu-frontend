/**
 * /budgets route-level loading skeleton — mirrors the monitoring-first
 * layout (PageHeader + at-risk AttentionList stub + entity-config table).
 * No spinner walls (CLAUDE.md §6, philosophy §6).
 */
import { PageShell } from "@/components/primitives/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageShell>
      {/* PageHeader skeleton: title row + meta line. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-80 max-w-full" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>

      {/* "Budgets at risk" AttentionList stub — same 3-row shape the
          primitive renders on loading. */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-36" />
        <div className="divide-y rounded-lg border">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex min-h-11 items-center gap-3 px-3 py-2.5"
            >
              <Skeleton className="size-2 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-full max-w-sm" />
              <Skeleton className="ml-auto h-3 w-12 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* "All budgets" config section — tabs row + toolbar + 10 table rows. */}
      <div className="space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="space-y-2 rounded-md border p-2">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 p-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="hidden h-3 w-20 lg:block" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
