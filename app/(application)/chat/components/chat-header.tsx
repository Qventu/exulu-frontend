"use client";

/**
 * ChatHeader — the session screen's only header ("The Quiet Column",
 * design/pages/chat.md §3). Replaces the legacy absolutely-positioned,
 * hardcoded-background header bar (chat.tsx:836–980 — model Select, Progress
 * strip, hint text, Share popover, Save-as-Routine button; fixes U5/U12).
 *
 * Layout: h-12 border-b px-4. Order (binding contract):
 *   AppNavTrigger (leftmost, self-hides ≥md — navigation.md §5.3: left = app
 *   nav, in-page History icon = chat history) · History trigger
 *   (useChatShell().toggleHistory()) · AgentVisual size-6 + agent name (item
 *   10) · "/" · session title with inline rename (item 14 header entry) ·
 *   usage chip (item 27; text-warning ≥80%) · model-override badge (item 26
 *   trust rule) · budget chip ≥80% (item 73 chip half) · spacer · files chip
 *   (item 64 direct opener) · new-chat icon (<sm, chat.md mobile spec) ·
 *   OverflowMenu: Share (item 29) / Save as Routine (items 28+30) / Model…
 *   (item 26) / Usage (items 27/38 mobile home) / Delete session (item 15,
 *   shared ConfirmDialog). ⌘./Ctrl+. opens the menu.
 *
 * State here is header-local only (overlay flags, rename draft, RBAC draft
 * lives in SharePopover); all conversation state arrives via the single
 * `controller` prop (ChatSessionController, owner: orchestration).
 */

import {
  Cpu,
  FolderOpen,
  Gauge,
  History,
  ListChecks,
  Plus,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

import { UserContext } from "@/app/(application)/authenticated";
import AgentVisual from "@/components/lottie";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import {
  OverflowMenu,
  type OverflowMenuItem,
} from "@/components/primitives/overflow-menu";
import { SaveWorkflowModal } from "@/components/save-workflow-modal";
import { AppNavTrigger } from "@/components/shell/app-nav-trigger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { computeBudgetProjection, type BudgetInfo } from "@/lib/budget";
import { cn } from "@/lib/utils";

import {
  useAvailableModels,
  useSessionMutations,
  type ChatSessionController,
} from "../hooks";
import { useChatShell } from "./chat-shell";
import { ModelOverrideDialog } from "./model-override-dialog";
import { SharePopover } from "./share-popover";
import { UsageDialog, UsagePopover } from "./usage-popover";

export interface ChatHeaderProps {
  controller: ChatSessionController;
}

/** Quiet chip recipe shared by the usage / budget / files chips. */
const CHIP =
  "items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors duration-300 hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none";

export function ChatHeader({ controller }: ChatHeaderProps) {
  const t = useTranslations("chat");
  const router = useRouter();
  const { toggleHistory } = useChatShell();
  const { user } = React.useContext(UserContext);
  const {
    agent,
    session,
    writeAccess,
    tokenCounts,
    modelOverride,
    setModelOverride,
  } = controller;
  const { renameSession, deleteSession, renaming } = useSessionMutations(
    agent.id,
  );
  const { models } = useAvailableModels();

  // ── Header-local overlay state ────────────────────────────────────────────
  const [shareOpen, setShareOpen] = React.useState(false);
  const [modelOpen, setModelOpen] = React.useState(false);
  const [usageOpen, setUsageOpen] = React.useState(false);
  const [routineOpen, setRoutineOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  // ── Inline rename (item 14, header entry) ────────────────────────────────
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState("");
  // Optimistic title shown after a successful rename until the session
  // object refreshes; reset on session switch.
  const [titleOverride, setTitleOverride] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTitleOverride(null);
    setEditingTitle(false);
  }, [session?.id]);

  const displayTitle = titleOverride ?? session?.title ?? "";

  const startEditing = () => {
    if (!session || !writeAccess) return;
    setTitleDraft(displayTitle);
    setEditingTitle(true);
  };

  const commitRename = async () => {
    setEditingTitle(false);
    const next = titleDraft.trim();
    if (!session || !next || next === displayTitle) return;
    const previous = titleOverride;
    setTitleOverride(next);
    const ok = await renameSession(session.id, next);
    if (!ok) setTitleOverride(previous);
  };

  // ── Model override (item 26) ──────────────────────────────────────────────
  const overrideActive = !!modelOverride && modelOverride !== agent.model;
  const resolveModelName = (id: string | null | undefined): string => {
    if (!id) return agent.modelName || "";
    const match = models.find((m) => m.id === id);
    if (match) return match.name;
    return id === agent.model ? agent.modelName || id : id;
  };
  const currentModelName = overrideActive
    ? resolveModelName(modelOverride)
    : agent.modelName || resolveModelName(agent.model);

  // ── Usage chip (item 27; detail = items 27/38 via UsagePopover) ──────────
  const maxContext =
    typeof agent.maxContextLength === "number" && agent.maxContextLength > 0
      ? agent.maxContextLength
      : null;
  const usagePct = maxContext
    ? Math.round((tokenCounts.totalTokens / maxContext) * 100)
    : null;
  const usageWarning = usagePct !== null && usagePct >= 80;
  const compactTokens = new Intl.NumberFormat("en-US", {
    notation: "compact",
  }).format(tokenCounts.totalTokens);
  const showUsageChip = usagePct !== null && tokenCounts.totalTokens > 0;

  // ── Budget chip ≥80% (item 73, chip half — blocking half is composer's) ──
  const budget: BudgetInfo | null =
    (user?.budget as BudgetInfo | null | undefined) ?? null;
  const budgetProjection = budget ? computeBudgetProjection(budget) : null;
  const budgetPct = budgetProjection
    ? Math.round(budgetProjection.percentUsed)
    : 0;
  const showBudgetChip = !!budgetProjection && budgetProjection.percentUsed >= 80;
  const budgetOver = !!budgetProjection?.overBudget;

  // ── Files chip (item 64 direct opener) ───────────────────────────────────
  // chat.md row 64: the chip appears only when files exist. count === null
  // means "not resolved yet" (list in flight, or it failed) — render nothing
  // rather than a label-only chip that flashes in and out on zero-file
  // sessions. The files panel stays reachable via ＋ → "Session files".
  const filesCount = controller.sessionFilesCount;
  const showFilesChip = !!session && filesCount !== null && filesCount > 0;

  // ── Save as Routine gate (items 28/30): ≥1 user + ≥1 assistant message ───
  const canSaveRoutine = React.useMemo(() => {
    const msgs = controller.messages || [];
    return (
      msgs.some((m) => m.role === "user") &&
      msgs.some((m) => m.role === "assistant")
    );
  }, [controller.messages]);

  // ── ⋯ menu + ⌘./Ctrl+. shortcut ──────────────────────────────────────────
  const menuTriggerRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ".") {
        event.preventDefault();
        menuTriggerRef.current?.click();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const menuItems: OverflowMenuItem[] = [];
  if (writeAccess && session) {
    menuItems.push({
      label: t("header.menuShare"),
      icon: Share2,
      onSelect: () => setShareOpen(true),
    });
  }
  menuItems.push({
    // Item 28: the legacy standing hint text lives on as this entry's
    // dialog description (SaveWorkflowModal already carries it).
    label: t("header.menuSaveAsRoutine"),
    icon: ListChecks,
    disabled: !canSaveRoutine,
    // Item 30: disabled menu items get no pointer events, so the "why" is a
    // muted sub-line instead of a tooltip.
    description: canSaveRoutine ? undefined : t("header.menuSaveAsRoutineHint"),
    onSelect: () => setRoutineOpen(true),
  });
  menuItems.push({
    label: currentModelName
      ? t("header.menuModelWithName", { name: currentModelName })
      : t("header.menuModel"),
    icon: Cpu,
    onSelect: () => setModelOpen(true),
  });
  menuItems.push({
    label: t("header.menuUsage"),
    icon: Gauge,
    onSelect: () => setUsageOpen(true),
  });
  if (writeAccess && session) {
    menuItems.push({
      label: t("header.menuDelete"),
      icon: Trash2,
      destructive: true,
      onSelect: () => setDeleteOpen(true),
    });
  }

  return (
    <TooltipProvider delayDuration={300}>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
        {/* App navigation (leftmost; self-hides ≥md) — navigation.md §5.3. */}
        <AppNavTrigger />

        {/* In-page history trigger — History icon, never ☰. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("header.toggleHistory")}
              onClick={toggleHistory}
              className="size-11 shrink-0 md:size-8"
            >
              <History className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t("header.toggleHistory")}
          </TooltipContent>
        </Tooltip>

        {/* Identity + title cluster (item 10 / item 14) */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <AgentVisual
            agent={agent}
            status={controller.status}
            className="size-6 shrink-0"
          />
          <span className="max-w-24 shrink-0 truncate text-sm font-medium sm:max-w-48">
            {agent.name}
          </span>
          <span className="shrink-0 text-muted-foreground" aria-hidden="true">
            /
          </span>

          {editingTitle && session ? (
            <Input
              autoFocus
              value={titleDraft}
              disabled={renaming}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={() => void commitRename()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void commitRename();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setEditingTitle(false);
                }
              }}
              aria-label={t("header.renameLabel")}
              className="h-8 w-full max-w-xs border-none bg-transparent px-1 text-base shadow-none focus-visible:ring-1 md:text-sm"
            />
          ) : session ? (
            writeAccess ? (
              <button
                type="button"
                onClick={startEditing}
                aria-label={t("header.renameTitled", {
                  title: displayTitle || t("header.untitled"),
                })}
                className="min-h-11 min-w-0 truncate rounded-md px-1 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:min-h-8"
              >
                {displayTitle || t("header.untitled")}
              </button>
            ) : (
              <span className="min-w-0 truncate text-sm">
                {displayTitle || t("header.untitled")}
              </span>
            )
          ) : (
            <span className="min-w-0 truncate text-sm text-muted-foreground">
              {t("header.newChat")}
            </span>
          )}

          {/* Usage chip (item 27) — folds into ⋯ → Usage below sm. */}
          {showUsageChip ? (
            <UsagePopover
              tokenCounts={tokenCounts}
              maxContextLength={maxContext}
              budget={budget}
            >
              <button
                type="button"
                aria-label={t("header.usageAria", { percent: usagePct ?? 0 })}
                className={cn(
                  CHIP,
                  "hidden shrink-0 sm:inline-flex",
                  usageWarning && "border-warning text-warning",
                )}
              >
                {usagePct}% · {compactTokens}
              </button>
            </UsagePopover>
          ) : null}

          {/* Model-override badge (item 26) — never hidden once engaged. */}
          {overrideActive ? (
            <Badge
              variant="outline"
              className="flex max-w-40 shrink-0 items-center gap-1 text-xs font-normal text-muted-foreground"
            >
              <span className="truncate">
                {t("header.modelOverride", {
                  name: resolveModelName(modelOverride),
                })}
              </span>
              <button
                type="button"
                aria-label={t("header.clearModelOverride")}
                onClick={() => setModelOverride(null)}
                className="-mr-1.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </Badge>
          ) : null}

          {/* Budget chip — only at ≥80% (item 73, chip half). */}
          {showBudgetChip ? (
            <UsagePopover
              tokenCounts={tokenCounts}
              maxContextLength={maxContext}
              budget={budget}
            >
              <button
                type="button"
                aria-label={t("header.budgetAria", { percent: budgetPct })}
                className={cn(
                  CHIP,
                  "hidden shrink-0 sm:inline-flex",
                  budgetOver
                    ? "border-destructive text-destructive"
                    : "border-warning text-warning",
                )}
              >
                {t("header.budgetChip", { percent: budgetPct })}
              </button>
            </UsagePopover>
          ) : null}
        </div>

        {/* Right cluster */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Files chip (item 64 direct opener) */}
          {showFilesChip ? (
            <button
              type="button"
              onClick={() => void controller.setFilesPanelOpen(true)}
              aria-label={t("header.filesAria")}
              className={cn(CHIP, "hidden sm:inline-flex")}
            >
              <FolderOpen className="size-3" aria-hidden="true" />
              {t("header.filesChip", { count: filesCount ?? 0 })}
            </button>
          ) : null}

          {/* New chat (<sm header entry, chat.md mobile spec; rail owns ≥sm). */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("header.newChat")}
                onClick={() => router.push(`/chat/${agent.id}/new`)}
                className="size-11 sm:hidden"
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("header.newChat")}</TooltipContent>
          </Tooltip>

          {/* ⋯ menu — ⌘./Ctrl+. opens it (chat.md risk 4 mitigation). */}
          <OverflowMenu
            ref={menuTriggerRef}
            items={menuItems}
            label={t("header.menuLabel")}
            className="size-11 md:size-8"
          />
        </div>
      </header>

      {/* ── Header-owned overlays (one at a time; menu closes before opening) ── */}

      {session ? (
        <SharePopover
          session={session}
          creatorEmail={controller.creatorEmail}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      ) : null}

      <ModelOverrideDialog
        open={modelOpen}
        onOpenChange={setModelOpen}
        agent={agent}
        value={modelOverride}
        onChange={setModelOverride}
      />

      <UsageDialog
        open={usageOpen}
        onOpenChange={setUsageOpen}
        tokenCounts={tokenCounts}
        maxContextLength={maxContext}
        budget={budget}
      />

      {/* Item 30 — contents unchanged; modal got the API-frozen T5 pass. */}
      <SaveWorkflowModal
        isOpen={routineOpen}
        onClose={() => setRoutineOpen(false)}
        messages={controller.messages || []}
        agentId={agent.id}
        sessionTitle={displayTitle || t("header.newChat")}
      />

      {/* Item 15 (header entry) — shared ConfirmDialog, then back to /new. */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("header.deleteTitle")}
        description={t("header.deleteDescription", {
          title: displayTitle || t("header.untitled"),
        })}
        confirmLabel={t("header.deleteConfirm")}
        onConfirm={async () => {
          if (!session) return;
          const ok = await deleteSession(session.id);
          if (!ok) {
            // Rejection keeps the dialog open (ConfirmDialog contract).
            throw new Error("delete-failed");
          }
          router.push(`/chat/${agent.id}/new`);
        }}
      />
    </TooltipProvider>
  );
}
