"use client";

/**
 * MemoryPanelContent — "What <agent> remembers" panel body (spec 2026-09-29
 * agent-memory-redesign, Task 13, §4.3). Mounted inside a `SidePanel` by
 * session-screen.tsx; this component owns only the body.
 *
 * Lists the CURRENT USER's own memories (server-side RBAC still applies —
 * the `created_by` filter is a UX narrowing, not the access control), with
 * All/Private/Public tabs, a "New" badge for items saved earlier in this
 * open session (RecalledMemories does the equivalent for the per-answer
 * "Recalled N memories" block), and per-row Edit / Change access (both open
 * the item detail page) / Forget (ConfirmDialog → DELETE_MEMORY_ITEM →
 * refetch).
 *
 * Uses the same route-local GET_ITEMS/PAGINATION_POSTFIX-derived query and
 * DELETE_MEMORY_ITEM mutation as memory-card.tsx / recalled-memories.tsx —
 * NOT app/(application)/data/queries.ts's DELETE_ITEM: the eslint
 * feature-isolation rule (codebase-structure §1.2) bans chat/** importing
 * from data/**.
 */

import { useMutation, useQuery } from "@apollo/client";
import { Bookmark, ChevronDown, Globe, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { ChatSessionController } from "../hooks";
import { DELETE_MEMORY_ITEM, GET_MY_MEMORIES, myMemoriesKey } from "../queries";
import {
  savedIdsFromMessages,
  splitByVisibility,
  type MyMemory,
} from "./memory-panel-data";

export function MemoryPanelContent({
  controller,
}: {
  controller: ChatSessionController;
}) {
  const t = useTranslations("chat");
  const { user } = React.useContext(UserContext);
  const agent = controller.agent;
  const contextId = agent.memory ?? "";
  const [tab, setTab] = React.useState<"all" | "private" | "public">("all");
  const [pending, setPending] = React.useState<MyMemory | null>(null);

  const { data, loading, refetch } = useQuery(GET_MY_MEMORIES(contextId), {
    variables: { filters: [{ created_by: { eq: user?.id } }], page: 1, limit: 200 },
    skip: !contextId || !user?.id,
    fetchPolicy: "cache-and-network",
  });
  const [deleteItem] = useMutation(DELETE_MEMORY_ITEM(contextId));

  const items: MyMemory[] = data?.[myMemoriesKey(contextId)]?.items ?? [];
  // Panel subtitle vs. tab-count chip disagreement above the 200-row fetch
  // limit (final-review finding 6): the subtitle's total reads the
  // pagination query's actual itemCount, while the All/Private/Public tab
  // counts intentionally stay derived from the fetched `items` array (they
  // describe what's in the list below, capped the same way it is).
  const totalCount: number = data?.[myMemoriesKey(contextId)]?.pageInfo?.itemCount ?? items.length;
  const { privateItems, publicItems } = splitByVisibility(items);
  const shown = tab === "private" ? privateItems : tab === "public" ? publicItems : items;
  const newIds = savedIdsFromMessages(controller.messages);

  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={Bookmark}
          title={t("memory.panelEmptyTitle", { agent: agent.name })}
          description={t("memory.panelEmptyDescription")}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 p-4">
        <p className="text-xs text-muted-foreground">
          {t("memory.panelSubtitle", {
            count: totalCount,
            privateCount: privateItems.length,
            publicCount: publicItems.length,
          })}
        </p>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">
              {t("memory.tabAll")} {items.length}
            </TabsTrigger>
            <TabsTrigger value="private" className="flex-1">
              {t("memory.tabPrivate")} {privateItems.length}
            </TabsTrigger>
            <TabsTrigger value="public" className="flex-1">
              {t("memory.tabPublic")} {publicItems.length}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {shown.length === 0 ? (
        // The overall panel isn't empty (items.length > 0 above already
        // short-circuited that case) — this is a tab with no rows in it,
        // e.g. Public with no public memories yet (finding 9).
        <p className="flex-1 px-4 py-6 text-center text-sm text-muted-foreground">
          {t("memory.tabEmpty")}
        </p>
      ) : (
        <ul className="flex-1 divide-y overflow-y-auto">
          {shown.map((m) => {
            const Icon = m.rights_mode === "private" ? Lock : Globe;
            return (
              <li key={m.id}>
                <Collapsible>
                  <CollapsibleTrigger className="flex w-full items-start gap-2 px-4 py-3 text-left text-sm hover:bg-accent">
                    <Icon
                      className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">{m.information || m.name}</span>
                    {newIds.has(m.id) && (
                      <Badge variant="secondary" className="text-xs">
                        {t("memory.new")}
                      </Badge>
                    )}
                    <ChevronDown
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 px-4 pb-3 pl-10 text-xs text-muted-foreground">
                    <p>
                      {m.type ? `${m.type} · ` : ""}
                      {t(`memory.mode.${m.rights_mode}`)} ·{" "}
                      <RelativeTime date={m.createdAt} />
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/data/${contextId}/items/${m.id}`}>
                          {t("memory.edit")}
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/data/${contextId}/items/${m.id}#access`}>
                          {t("memory.changeAccess")}
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setPending(m)}
                      >
                        {t("memory.forget")}
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center justify-between gap-2 border-t p-3 text-xs text-muted-foreground">
        <span>{t("memory.panelTip")}</span>
        <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
          <Link href={`/data/${contextId}?mine=1`}>{t("memory.allMine")}</Link>
        </Button>
      </div>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        variant="destructive"
        title={t("memory.forgetConfirmTitle")}
        description={t("memory.forgetConfirmDescription", { title: pending?.name ?? "" })}
        confirmLabel={t("memory.forget")}
        onConfirm={async () => {
          if (!pending) return;
          try {
            await deleteItem({ variables: { id: pending.id } });
            toast.success(t("memory.forgotToast"));
            await refetch();
            // Only clear on success — ConfirmDialog's contract is "reject =
            // stay open" (recalled-memories.tsx follows the same rule).
            setPending(null);
          } catch {
            toast.error(t("memory.forgetFailed"));
            throw new Error("forget failed");
          }
        }}
      />
    </div>
  );
}
