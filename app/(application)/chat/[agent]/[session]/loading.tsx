/**
 * Session loading skeleton (item 8; philosophy.md §6 — skeletons mirror the
 * real layout, no centered spinner walls).
 *
 * Mirrors SessionScreen: h-12 header bar, three message bubbles at the
 * conversation column width (mx-auto max-w-3xl px-4 — keep in sync with
 * CHAT_COLUMN in ../../components/chat-shell.tsx; inlined here so this stays
 * a server component), and the composer card. Fills the dvh-bounded ChatShell
 * slot (h-full — the shell owns the dvh, V1; no 100vh anywhere).
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {/* ChatHeader mirror */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-4 w-32" />
        <div className="flex-1" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="size-8 rounded-md" />
      </div>

      {/* Conversation column mirror */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-6">
          <Skeleton className="h-16 w-2/3 self-end rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-12 w-1/2 self-end rounded-lg" />
        </div>
      </div>

      {/* Composer card mirror (safe-area padded like the real region, V3) */}
      <div className="shrink-0 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto w-full max-w-3xl px-4 pb-2">
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          <Skeleton className="mx-auto h-3 w-56" />
        </div>
      </div>
    </div>
  );
}
