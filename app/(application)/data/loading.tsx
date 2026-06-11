import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-full flex-1 flex-col p-8 pt-6">
      <div className="mb-8 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid min-h-0 flex-1 gap-6 md:grid-cols-3">
        <Skeleton className="rounded-lg md:col-span-2" />
        <Skeleton className="rounded-lg" />
      </div>
    </div>
  );
}
