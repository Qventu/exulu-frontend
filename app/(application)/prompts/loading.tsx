import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="h-full flex-1 flex-col p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 border-b border-border/50 pb-6 sm:mb-8 sm:flex-row sm:items-end sm:pb-8">
        <div className="space-y-3">
          <Skeleton className="h-12 w-56 sm:h-16 sm:w-72" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <Skeleton className="h-12 w-full sm:h-14 sm:w-44" />
      </div>
      <div className="mb-6 flex items-center gap-4">
        <Skeleton className="h-11 w-full max-w-lg sm:h-12" />
        <Skeleton className="h-11 w-28" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
