import { PageShell } from "@/components/primitives/page-shell";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for /workflows/[id] — mirrors the workbench layout:
 * breadcrumb + header (title + meta + action cluster), Separator, then a
 * `lg:grid-cols-[200px_1fr]` grid with SectionNav skeleton on the left and
 * four stacked DetailSection skeletons on the right inside `max-w-3xl`.
 */
export default function Loading() {
  return (
    <PageShell variant="content">
      <div className="space-y-3">
        <Skeleton className="h-4 w-44" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-md" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-7 w-64 max-w-full" />
              <Skeleton className="h-4 w-48 max-w-full" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="size-9" />
          </div>
        </div>
      </div>

      <Separator />

      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-8 w-full" />
          ))}
        </div>

        <div className="min-w-0">
          <div className="mx-auto max-w-3xl space-y-12">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="space-y-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-32 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
