import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="h-full flex-1 flex-col p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 border-b border-border/50 pb-6 sm:mb-8 sm:flex-row sm:items-end sm:pb-8">
        <div className="space-y-3">
          <Skeleton className="h-12 w-56 sm:h-16 sm:w-72" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <Skeleton className="h-12 w-full sm:h-14 sm:w-40" />
      </div>
      <Skeleton className="mb-6 h-11 w-full max-w-lg" />
      <div className="flex flex-col gap-4 lg:h-[calc(100vh-280px)] lg:flex-row lg:gap-6">
        <div className="flex w-full flex-col gap-2 lg:w-80 xl:w-96">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="min-h-[400px] flex-1 rounded-lg lg:min-h-0" />
      </div>
    </div>
  );
}
