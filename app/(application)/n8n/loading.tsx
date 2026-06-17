/**
 * /n8n route-level loading skeleton — mirrors the new full-bleed shell
 * (compact PageHeader bar + full-bleed iframe host area). Philosophy.md §6:
 * skeletons mirror the real layout to avoid layout shift.
 */
import { PageShell } from "@/components/primitives/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageShell variant="full-bleed">
      {/* PageHeader bar mirror (compact density). */}
      <div className="border-b px-4 py-3 md:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="h-8 w-32 shrink-0" />
        </div>
      </div>

      {/* iframe host mirror — full-bleed block. */}
      <div className="min-h-0 flex-1">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
    </PageShell>
  );
}
