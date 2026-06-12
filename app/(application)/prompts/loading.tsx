import { Skeleton } from "@/components/ui/skeleton";

/**
 * /prompts route skeleton — mirrors the redesigned layout (philosophy §6:
 * skeletons mirror the real layout, no card-grid pulse blocks):
 * PageHeader → Toolbar → bordered ListDetail with row-shaped skeletons
 * on the left and an empty detail pane on the right (lg+).
 */
export default function Loading() {
  return (
    <div
      aria-busy="true"
      className="mx-auto w-full max-w-7xl space-y-8 p-4 md:p-8"
    >
      {/* PageHeader */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-full sm:w-32" />
      </div>

      <div className="flex flex-col gap-3">
        {/* Toolbar: search + sort + filters */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Skeleton className="h-9 w-full md:max-w-sm" />
          <Skeleton className="h-9 w-full md:hidden" />
          <Skeleton className="hidden h-9 w-48 md:block" />
          <Skeleton className="hidden h-9 w-24 md:block" />
        </div>

        <div className="flex min-h-[60vh] overflow-hidden rounded-md border bg-card lg:min-h-[calc(100dvh-18rem)]">
          {/* List — fills the remaining width (matches ListDetail's
              `min-w-0 flex-1` on the list pane in the loaded layout). */}
          <div className="flex min-w-0 flex-1 flex-col">
            <ul className="flex-1 divide-y divide-border">
              {Array.from({ length: 10 }).map((_, index) => (
                <li key={index} className="space-y-1.5 px-3 py-2.5">
                  <Skeleton className="h-4 w-3/4 max-w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </li>
              ))}
            </ul>
          </div>
          {/* Detail pane (lg+) — fixed-width on the right, matching
              ListDetail's `w-96 xl:w-[28rem]` aside in static mode. Mirrors
              the loaded layout exactly so the skeleton → content swap has no
              visual jolt (cosmetic fix flagged in adversarial review). */}
          <aside className="hidden w-96 shrink-0 border-l border-border lg:flex lg:flex-col xl:w-[28rem]">
            <div className="border-b border-border px-4 py-3">
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="space-y-4 p-6">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
