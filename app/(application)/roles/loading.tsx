import { PageShell } from "@/components/primitives/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Brief skeleton shown before /roles server-redirects to /users?tab=roles.
 * Mirrors the access shell so the redirect is visually seamless.
 */
export default function Loading() {
  return (
    <PageShell variant="content">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-10 w-72 max-w-full" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full max-w-sm" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </PageShell>
  );
}
