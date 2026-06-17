import { Skeleton } from "@/components/ui/skeleton";

/**
 * /agents route skeleton — mirrors the redesigned layout (inventory item 2;
 * philosophy §6: skeletons mirror the real layout, no card-grid pulse
 * blocks): PageHeader (title + purpose + primary action) → Toolbar (search +
 * filters) → bordered divide-y list of row-shaped skeletons.
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
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-full sm:w-32" />
      </div>

      <div className="flex flex-col gap-4">
        {/* Toolbar: search + (md+) two filter selects */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Skeleton className="h-9 w-full md:max-w-sm" />
          <Skeleton className="h-9 w-full md:hidden" />
          <Skeleton className="hidden h-9 w-40 md:block" />
          <Skeleton className="hidden h-9 w-44 md:block" />
        </div>

        {/* Row-shaped list skeletons */}
        <div className="rounded-md border">
          <ul className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, index) => (
              <li
                key={index}
                className="flex items-center gap-3 px-3 py-2 md:px-4"
              >
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="hidden h-3 w-24 md:block" />
                </div>
                <Skeleton className="hidden h-4 w-16 md:block" />
                <Skeleton className="size-8 rounded-md" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
