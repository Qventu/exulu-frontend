import { PageShell } from "@/components/primitives/page-shell";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton mirroring the real /settings layout (responsive.md DoD: skeletons
 * mirror the mobile layout too): header, then the four card-less sections —
 * Appearance (segmented control), Language (select), Personal system prompt
 * (textarea + save), Account (definition rows) — separated by dividers.
 */
export default function Loading() {
  return (
    <PageShell variant="narrow">
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>

      <div className="flex flex-col gap-8">
        {/* Appearance */}
        <div className="space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="h-12 w-full rounded-lg sm:w-96 md:h-10" />
        </div>
        <Separator />
        {/* Language */}
        <div className="space-y-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-60 max-w-full" />
          <Skeleton className="h-11 w-full sm:max-w-xs md:h-10" />
        </div>
        <Separator />
        {/* Personal system prompt */}
        <div className="space-y-4">
          <Skeleton className="h-5 w-52 max-w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-36 w-full" />
          <div className="flex justify-end">
            <Skeleton className="h-10 w-full sm:w-20" />
          </div>
        </div>
        <Separator />
        {/* Account */}
        <div className="space-y-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-56 max-w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/5" />
        </div>
      </div>
    </PageShell>
  );
}
