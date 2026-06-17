"use client";

/**
 * PromptDetail — the right-hand "document" for /prompts and the body of
 * /prompts/[id] (work item 2.9; prompts.md §3 "Detail" + inventory items
 * 24–43, 55–57).
 *
 * Replaces the legacy `prompt-preview.tsx`:
 * - Browser-chrome traffic lights GONE (M3 decoration); their one datum
 *   (shareable identity) survives as "Copy link" in the overflow menu.
 * - `dangerouslySetInnerHTML` GONE (H3 stored-XSS + mangled `\{var\}`
 *   regex); variables render via the shared <PromptContent /> primitive.
 * - Color confetti GONE (M1) — token-only, philosophy §4.
 * - Star icon (M11 — convention; the legacy ThumbsUp fought it) via the
 *   shared <FavoriteToggle /> primitive, with the correct `favoriteId`
 *   resolved by the caller (fixes H2).
 * - Delete behind the shared <ConfirmDialog /> (H5 + responsive.md hard
 *   rule 5: no native `confirm()`).
 * - "Use prompt" now increments `usage_count` (M8 — the legacy chat path
 *   was the only path that did).
 *
 * Layout:
 *   header row: name (text-xl) + actions
 *     [Use prompt default] [Edit outline (write)] [☆ FavoriteToggle]
 *     [⋯ OverflowMenu (Copy content, Copy link, Delete*)]
 *   description + meta line (creator · updated · visibility · used · favs)
 *   content block (PromptContent + CopyButton pinned top-right)
 *   tags + assigned agents (secondary / outline badges, muted)
 *   collapsed history section
 */

import { Bot, Edit, Link as LinkIcon, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { useQuery } from "@apollo/client";

import { UserContext } from "@/app/(application)/authenticated";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { CopyButton } from "@/components/primitives/copy-button";
import { FavoriteToggle } from "@/components/primitives/favorite-toggle";
import { OverflowMenu, type OverflowMenuItem } from "@/components/primitives/overflow-menu";
import { PromptContent } from "@/components/primitives/prompt-content";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  checkPromptWriteAccess,
  extractVariables,
  fillPromptVariables,
} from "@/lib/prompts";
import { GET_AGENTS_BY_IDS, GET_USER_BY_ID } from "@/queries/queries";
import type { PromptLibrary } from "@/types/models/prompt-library";

import {
  useDeletePromptLocal,
  useIncrementPromptUsageLocal,
  useTogglePromptFavoriteLocal,
} from "../hooks";
import { AccessBadge } from "./access-badge";
import { PromptEditorModal } from "./prompt-editor-modal";
import { VariableFillDialog } from "./variable-fill-dialog";
import { VersionHistoryPanel } from "./version-history-panel";

interface PromptDetailProps {
  prompt: PromptLibrary;
  /** Refetch the list/favorites map after a write. */
  onUpdated?: () => void;
  /** Called after a successful delete (consumer redirects / clears selection). */
  onDeleted?: () => void;
  /** Resolved favorite-row id from the caller's favorites map (fixes H2). */
  favoriteId?: string;
  /** Refetch the caller's favorites map after toggle. */
  onFavoritesChanged?: () => void;
  /** Hide the "back to list" outline button (the list view doesn't need it). */
  hideBackLink?: boolean;
}

export function PromptDetail({
  prompt,
  onUpdated,
  onDeleted,
  favoriteId,
  onFavoritesChanged,
}: PromptDetailProps) {
  const t = useTranslations("prompts");
  const tCommon = useTranslations("common");
  const { user } = React.useContext(UserContext);

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [variableFormOpen, setVariableFormOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [favoriting, setFavoriting] = React.useState(false);

  const [deletePrompt] = useDeletePromptLocal();
  const [incrementUsage] = useIncrementPromptUsageLocal();
  const toggleFavorite = useTogglePromptFavoriteLocal();

  const hasWriteAccess = checkPromptWriteAccess(prompt, user);
  const variables = React.useMemo(
    () => extractVariables(prompt.content),
    [prompt.content],
  );
  const isFavorited = prompt.is_favorited ?? false;

  const { data: agentsData } = useQuery(GET_AGENTS_BY_IDS, {
    variables: { ids: prompt.assigned_agents ?? [] },
    skip: !prompt.assigned_agents || prompt.assigned_agents.length === 0,
  });
  const assignedAgentNames: string[] =
    agentsData?.agentByIds?.map((a: { name: string }) => a.name) ?? [];

  const { data: creatorData, loading: creatorLoading } = useQuery(
    GET_USER_BY_ID,
    {
      variables: { id: prompt.created_by },
      skip: !prompt.created_by,
    },
  );
  const creatorName: string =
    creatorData?.userById?.name ?? t("unknownUser");

  const handleCopyContent = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      toast.success(tCommon("copied"));
    } catch {
      toast.error(tCommon("copyFailed"));
    }
  }, [prompt.content, tCommon]);

  const handleCopyLink = React.useCallback(async () => {
    try {
      const url = `${window.location.origin}/prompts/${prompt.id}`;
      await navigator.clipboard.writeText(url);
      toast.success(t("linkCopied"));
    } catch {
      toast.error(tCommon("copyFailed"));
    }
  }, [prompt.id, t, tCommon]);

  const recordUsage = React.useCallback(async () => {
    // Fixes prompts.md M8: legacy "Use prompt" never incremented this — the
    // chat insertion path was the only path that did.
    try {
      await incrementUsage({
        variables: {
          id: prompt.id,
          usage_count: (prompt.usage_count ?? 0) + 1,
        },
      });
      onUpdated?.();
    } catch {
      // Best-effort; the copy already succeeded.
    }
  }, [incrementUsage, onUpdated, prompt.id, prompt.usage_count]);

  const handleUsePrompt = React.useCallback(async () => {
    if (variables.length > 0) {
      setVariableFormOpen(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(prompt.content);
      toast.success(t("copiedReady"));
      void recordUsage();
    } catch {
      toast.error(tCommon("copyFailed"));
    }
  }, [prompt.content, recordUsage, t, tCommon, variables.length]);

  const handleSubmitVariables = React.useCallback(
    async (values: Record<string, string>) => {
      const filled = fillPromptVariables(prompt.content, values);
      try {
        await navigator.clipboard.writeText(filled);
        toast.success(t("copiedReady"));
        void recordUsage();
      } catch {
        toast.error(tCommon("copyFailed"));
      }
      setVariableFormOpen(false);
    },
    [prompt.content, recordUsage, t, tCommon],
  );

  const handleToggleFavorite = React.useCallback(async () => {
    if (favoriting || !user) return;
    setFavoriting(true);
    try {
      await toggleFavorite({
        promptId: prompt.id,
        userId: user.id,
        isFavorited,
        currentCount: prompt.favorite_count ?? 0,
        favoriteId,
      });
      onFavoritesChanged?.();
      onUpdated?.();
      toast.success(
        isFavorited ? t("favoriteRemoved") : t("favoriteAdded"),
      );
    } catch (error) {
      console.error(error);
      toast.error(t("favoriteFailed"));
    } finally {
      setFavoriting(false);
    }
  }, [
    favoriteId,
    favoriting,
    isFavorited,
    onFavoritesChanged,
    onUpdated,
    prompt.favorite_count,
    prompt.id,
    t,
    toggleFavorite,
    user,
  ]);

  const handleConfirmDelete = React.useCallback(async () => {
    await deletePrompt({ variables: { id: prompt.id } });
    toast.success(t("deleted"));
    onDeleted?.();
  }, [deletePrompt, onDeleted, prompt.id, t]);

  const overflowItems = React.useMemo<OverflowMenuItem[]>(() => {
    const items: OverflowMenuItem[] = [
      {
        label: t("copyContent"),
        onSelect: () => void handleCopyContent(),
      },
      {
        label: t("copyLink"),
        icon: LinkIcon,
        onSelect: () => void handleCopyLink(),
      },
    ];
    if (hasWriteAccess) {
      items.push({
        label: tCommon("delete"),
        icon: Trash2,
        destructive: true,
        onSelect: () => setDeleteOpen(true),
      });
    }
    return items;
  }, [handleCopyContent, handleCopyLink, hasWriteAccess, t, tCommon]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="space-y-6">
          {/* Header row: name + actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="truncate text-xl font-semibold tracking-tight">
                {prompt.name}
              </h2>
              {prompt.description ? (
                <p className="text-sm text-muted-foreground">
                  {prompt.description}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button onClick={handleUsePrompt}>{t("usePrompt")}</Button>
              {hasWriteAccess ? (
                <Button
                  variant="outline"
                  onClick={() => setEditorOpen(true)}
                  className="gap-2"
                >
                  <Edit aria-hidden="true" className="size-4" />
                  {tCommon("edit")}
                </Button>
              ) : null}
              <FavoriteToggle
                pressed={isFavorited}
                onToggle={() => void handleToggleFavorite()}
                label={
                  isFavorited
                    ? t("removeFromFavorites")
                    : t("addToFavorites")
                }
              />
              <OverflowMenu
                items={overflowItems}
                label={tCommon("actions")}
              />
            </div>
          </div>

          {/* Meta line (item 29/30/33-style data, muted) */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {creatorLoading ? (
              <Skeleton className="h-3 w-20" />
            ) : (
              <span className="truncate">
                {t("createdBy", { name: creatorName })}
              </span>
            )}
            <span aria-hidden="true">·</span>
            <RelativeTime date={prompt.updatedAt} className="text-xs" />
            <span aria-hidden="true">·</span>
            <AccessBadge mode={prompt.rights_mode} compact />
            <span aria-hidden="true">·</span>
            <span>
              {t("usedCount", { count: prompt.usage_count ?? 0 })}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t("favoritesCount", { count: prompt.favorite_count ?? 0 })}
            </span>
          </div>

          {/* Content block */}
          <div className="relative rounded-lg border bg-muted/30 p-4">
            <div className="absolute right-2 top-2">
              <CopyButton value={prompt.content} label={t("copyContent")} />
            </div>
            <PromptContent content={prompt.content} className="pr-10" />
          </div>

          {/* Tags + assigned agents */}
          {(prompt.tags && prompt.tags.length > 0) ||
          assignedAgentNames.length > 0 ? (
            <div className="space-y-3">
              {prompt.tags && prompt.tags.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {prompt.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {assignedAgentNames.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("assignedAgents")}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {assignedAgentNames.map((name) => (
                      <Badge
                        key={name}
                        variant="outline"
                        className="gap-1 text-muted-foreground"
                      >
                        <Bot aria-hidden="true" className="size-3" />
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Version history (item 39–43) */}
          <VersionHistoryPanel
            prompt={prompt}
            user={user}
            hasWriteAccess={hasWriteAccess}
            onRestore={() => onUpdated?.()}
          />
        </div>
      </div>

      {/* Editor modal */}
      <PromptEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        prompt={prompt}
        onSuccess={() => {
          setEditorOpen(false);
          onUpdated?.();
        }}
        user={user}
      />

      {/* Delete confirm dialog (replaces the two native confirm() sites). */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("deleteTitle", { name: prompt.name })}
        description={t("deleteDescription")}
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />

      {/* Variable-fill dialog for "Use prompt" with vars. */}
      {variables.length > 0 ? (
        <VariableFillDialog
          open={variableFormOpen}
          onOpenChange={setVariableFormOpen}
          variables={variables}
          promptName={prompt.name}
          onSubmit={handleSubmitVariables}
          submitButtonText={t("copyToClipboard")}
        />
      ) : null}
    </div>
  );
}
