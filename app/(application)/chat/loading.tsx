import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex-1 overflow-hidden p-4">
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4">
          <Skeleton className="h-16 w-2/3 self-end rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-12 w-1/2 self-end rounded-lg" />
          <Skeleton className="h-20 w-5/6 rounded-lg" />
        </div>
      </div>
      <div className="p-4">
        <Skeleton className="mx-auto h-24 w-full max-w-3xl rounded-xl" />
      </div>
    </div>
  );
}
