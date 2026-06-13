/**
 * /skills/[skillId]/loading.tsx — route-level loading skeleton mirroring
 * the real editor layout.
 *
 * Spec: design/pages/skills.md inventory #41 (skill fetch / not-found —
 * loading slice) + #70 (file-tree loading skeleton). Replaces the
 * legacy in-page `Loader2` wall (skills.md M6: spinner walls vs. layout
 * skeletons; philosophy §6 "skeletons mirror the real layout").
 *
 * Composition mirrors `skill-editor-view.tsx`:
 *  - top bar (h-12): sidebar toggle + back + skill identity slot + action
 *    cluster (Refresh, History, Save Version) skeletons,
 *  - inline sidebar (≥md) with header + 6 indented file rows + footer,
 *  - editor pane empty-state skeleton.
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex h-12 flex-shrink-0 items-center gap-2 border-b bg-background px-3">
        <Skeleton className="size-8 rounded-md" />
        <div className="h-5 w-px bg-border" />
        <Skeleton className="size-8 rounded-md" />
        <div className="h-5 w-px bg-border" />
        <Skeleton className="size-4 rounded-sm" />
        <Skeleton className="h-4 w-32 sm:w-48" />
        <Skeleton className="h-5 w-10 rounded-full" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="hidden size-8 rounded-md md:block" />
          <Skeleton className="hidden h-8 w-20 rounded-md md:block" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
        </div>
      </div>

      {/* Body — inline sidebar (≥md) + editor pane. */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar (≥md only — the mobile sheet is closed by default). */}
        <div className="hidden w-60 flex-shrink-0 flex-col border-r md:flex">
          {/* Sidebar header */}
          <div className="flex flex-shrink-0 items-center justify-between border-b bg-muted/20 px-3 py-2">
            <Skeleton className="h-3 w-12" />
            <div className="flex items-center gap-1">
              <Skeleton className="size-7 rounded-md" />
              <Skeleton className="size-7 rounded-md" />
            </div>
          </div>
          {/* File rows */}
          <div className="flex-1 space-y-1 px-2 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-5"
                style={{
                  marginLeft: `${(i % 3) * 12}px`,
                  width: `${100 - (i % 4) * 8}%`,
                }}
              />
            ))}
          </div>
          {/* Sidebar footer */}
          <div className="flex flex-shrink-0 items-center justify-between border-t bg-muted/10 px-3 py-2">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-5 w-10 rounded-full" />
          </div>
        </div>

        {/* Editor pane empty state — mirrors the "select a file" surface
            with a quiet centered placeholder. */}
        <div className="flex min-w-0 flex-1 items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="size-10 rounded-md" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </div>
    </div>
  );
}
