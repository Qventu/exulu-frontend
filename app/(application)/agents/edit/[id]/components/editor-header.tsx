"use client";

/**
 * EditorHeader — the agent workbench header.
 *
 * - Breadcrumb "Agents / {name}" via PageHeader (guarded via confirmIfDirty —
 *   fixes silent Back, item 31). Breadcrumb is rendered as a <Link>, so the
 *   SaveBar's capture-phase click guard intercepts it natively.
 * - Leading slot = agent avatar (item 34, PageHeader 'leading' prop).
 * - Inline Active switch + StatusDot (item 43 at L1) sits as a meta row.
 * - Actions (right): "Test in chat" outline → /chat/{id}/new (item 42),
 *   Save primary disabled-until-dirty (item 30), OverflowMenu: Duplicate
 *   (33), Copy ID (35), Copy slug, Delete destructive → ConfirmDialog (32).
 * - <sm condensed (PageHeader stacks; OverflowMenu absorbs everything except
 *   Save).
 */

import {
  Bot,
  Copy,
  Files,
  Hash,
  Loader2,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import AgentVisual from "@/components/lottie";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { OverflowMenu } from "@/components/primitives/overflow-menu";
import { PageHeader } from "@/components/primitives/page-header";
import { StatusDot } from "@/components/primitives/status-dot";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { Agent } from "@/types/models/agent";

import type { UseAgentEditor } from "../hooks";

interface EditorHeaderProps {
  agent: Agent;
  editor: UseAgentEditor;
  /** Guarded programmatic navigation from the SaveBar companion hook. */
  confirmIfDirty: (proceed: () => void) => void;
}

export function EditorHeader({
  agent,
  editor,
  confirmIfDirty,
}: EditorHeaderProps) {
  const t = useTranslations("agents");
  const tCommon = useTranslations("common");
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const active = !!editor.form.watch("active");
  const confirmationText = t("deleteDialog.confirmationText");

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(agent.id);
      toast.success(tCommon("copied"));
    } catch {
      toast.error(tCommon("copyFailed"));
    }
  };

  const copySlug = async () => {
    if (!agent.slug) return;
    // Mirror the Developer section's slug field — copy the routable path,
    // not the bare slug (2026-06-12 QA: the bare slug is ambiguous; the
    // path is what fits straight into a URL/curl).
    const path = `agents/${agent.slug}/run/${agent.id}`;
    try {
      await navigator.clipboard.writeText(path);
      toast.success(tCommon("copied"));
    } catch {
      toast.error(tCommon("copyFailed"));
    }
  };

  const overflowItems = [
    {
      label: t("editor.header.duplicate"),
      icon: Files,
      // Guard against silent navigation to the new copy when there are
      // unsaved edits (parity with Test in chat and Back; minor from the
      // 2.8 review).
      onSelect: () =>
        confirmIfDirty(() => {
          void editor.duplicate();
        }),
    },
    {
      label: t("editor.header.copyId"),
      icon: Copy,
      onSelect: () => void copyId(),
    },
    ...(agent.slug
      ? [
          {
            label: t("editor.header.copySlug"),
            icon: Hash,
            onSelect: () => void copySlug(),
          },
        ]
      : []),
    {
      label: t("editor.header.delete"),
      icon: Trash2,
      destructive: true,
      onSelect: () => setDeleteOpen(true),
    },
  ];

  const action = (
    <div className="flex flex-wrap items-center gap-2">
      {/* Active switch + status dot at L1 (item 43) */}
      <div className="hidden items-center gap-2 rounded-md border px-3 py-1.5 sm:flex">
        <StatusDot status={active ? "success" : "muted"} />
        <span className="text-sm">
          {active ? tCommon("active") : tCommon("inactive")}
        </span>
        <Switch
          checked={active}
          onCheckedChange={(value) =>
            editor.form.setValue("active", value, { shouldDirty: true })
          }
          aria-label={t("editor.header.activeAria")}
        />
      </div>

      {/* Test in chat (item 42) */}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          confirmIfDirty(() => {
            window.location.assign(`/chat/${agent.id}/new`);
          })
        }
      >
        <MessageSquare className="mr-2 size-4" />
        {t("editor.header.testInChat")}
      </Button>

      {/*
        Save (item 30). When the form is dirty the SaveBar mounts at the
        viewport bottom with its own primary Save (review #5: ONE purple
        primary per screen). Demote this header Save to outline while the
        SaveBar is visible so we don't paint two purple buttons at once —
        the redundant safety stays (header Save remains keyboard-reachable
        and clickable), just not as the focal CTA.
      */}
      <Button
        type="button"
        variant={editor.dirty ? "outline" : "default"}
        onClick={() => void editor.save()}
        disabled={!editor.dirty || editor.saving}
        aria-busy={editor.saving}
      >
        {editor.saving && <Loader2 className="mr-2 size-4 animate-spin" />}
        {tCommon("save")}
      </Button>

      <OverflowMenu items={overflowItems} />
    </div>
  );

  // Compact <sm meta row: status dot + switch, matches the "absorb into
  // overflow" responsive contract. Activation stays at L1 below sm.
  const meta = (
    <div className="flex items-center gap-2 sm:hidden">
      <StatusDot status={active ? "success" : "muted"} />
      <span className="text-sm">
        {active ? tCommon("active") : tCommon("inactive")}
      </span>
      <Switch
        checked={active}
        onCheckedChange={(value) =>
          editor.form.setValue("active", value, { shouldDirty: true })
        }
        aria-label={t("editor.header.activeAria")}
      />
    </div>
  );

  return (
    <>
      <PageHeader
        breadcrumb={{ label: t("title"), href: "/agents" }}
        title={agent.name ?? ""}
        action={action}
        meta={meta}
        leading={
          editor.image ? (
            <div className="size-10 overflow-hidden rounded-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={editor.image}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover"
              />
            </div>
          ) : agent.animation_idle ? (
            <div className="size-10">
              <AgentVisual agent={agent} status="ready" />
            </div>
          ) : (
            <div
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground"
            >
              {(agent.name ?? "A").charAt(0).toUpperCase()}
            </div>
          )
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("deleteDialog.title")}
        variant="destructive"
        confirmLabel={t("deleteDialog.buttonDelete")}
        typeToConfirm={confirmationText}
        onConfirm={async () => {
          await editor.remove();
        }}
      />
    </>
  );
}
