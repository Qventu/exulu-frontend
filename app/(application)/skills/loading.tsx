import { Skeleton } from "@/components/ui/skeleton";

/**
 * /skills route skeleton — mirrors the redesigned layout (philosophy §6:
 * skeletons mirror the real layout). PageHeader → Toolbar → bordered
 * ListDetail with row-shaped skeletons on the left and a panel skeleton on
 * the right (lg+). Replaces the legacy spinner-wall (resolves M6).
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
        {/* Toolbar: search + count */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Skeleton className="h-9 w-full md:max-w-sm" />
          <Skeleton className="hidden h-4 w-24 md:ml-auto md:block" />
        </div>

        <div className="flex min-h-[60vh] overflow-hidden rounded-md border bg-card lg:min-h-[calc(100dvh-18rem)]">
          {/* List — slim picker on the left (matches ListDetail's
              detailEmphasis="primary" shape: list lg:w-80 xl:w-96). */}
          <div className="flex min-w-0 flex-col lg:w-80 lg:shrink-0 xl:w-96">
            <ul className="flex-1 divide-y divide-border">
              {Array.from({ length: 6 }).map((_, index) => (
                <li key={index} className="space-y-1.5 px-3 py-2.5">
                  <Skeleton className="h-4 w-3/4 max-w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </li>
              ))}
            </ul>
          </div>
          {/* Detail pane (lg+) — flex-1 on the right; the skill content IS the page. */}
          <aside className="hidden min-w-0 flex-1 border-l border-border lg:flex lg:flex-col">
            <div className="border-b border-border px-4 py-3">
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="space-y-4 p-6">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
