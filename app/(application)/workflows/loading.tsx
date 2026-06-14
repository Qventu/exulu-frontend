import { PageShell } from "@/components/primitives/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for /workflows (Routines).
 *
 * Mirrors the post-promotion shell: PageHeader (no primary action),
 * Toolbar (search + view slot), 8-row table skeleton. The detail aside is
 * gone — selecting a routine now navigates to /workflows/[id], which ships
 * its own loading.tsx with the workbench skeleton.
 */
export default function Loading() {
  return (
    <PageShell variant="content">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-10 w-full max-w-xs" />
          <Skeleton className="hidden h-6 w-24 md:block" />
        </div>

        {/* Skeleton kept with the card chrome here because there's no
            real DataTable to provide its own border during loading. */}
        <div className="space-y-2 rounded-md border bg-card p-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </PageShell>
  );
}
