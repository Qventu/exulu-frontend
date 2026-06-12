"use client";

/**
 * EditorView — agent workbench client root.
 *
 * - EditorHeader (PageHeader with breadcrumb / leading avatar / Active +
 *   actions).
 * - Body grid `lg:grid-cols-[200px_1fr] gap-8` (single column below lg — the
 *   legacy `grid-flow-col` 390 px bug dies by construction, review #1).
 * - SectionNav (sticky rail ≥lg / chip row <lg) wired to useScrollSpy.
 * - Sections rendered in ladder order within `max-w-3xl space-y-12`.
 * - SaveBar + useUnsavedChangesGuard (handles Back, hard nav, programmatic
 *   nav and the delete dialog has its own ConfirmDialog inside the header).
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { PageShell } from "@/components/primitives/page-shell";
import {
  SaveBar,
  useUnsavedChangesGuard,
} from "@/components/primitives/save-bar";
import { SectionNav } from "@/components/primitives/section-nav";
import { Separator } from "@/components/ui/separator";
import type { Agent } from "@/types/models/agent";

import {
  useAgentEditor,
  useEditorReferenceData,
  useScrollSpy,
} from "../hooks";
import { AccessSection } from "../sections/access";
import { AppearanceSection } from "../sections/appearance";
import { BasicsSection } from "../sections/basics";
import { ChatExperienceSection } from "../sections/chat-experience";
import { DeveloperSection } from "../sections/developer";
import { InstructionsSection } from "../sections/instructions";
import { KnowledgeSection } from "../sections/knowledge";
import { SafetySection } from "../sections/safety";
import { ToolsSection } from "../sections/tools";
import { EditorHeader } from "./editor-header";

const SECTION_IDS = [
  "basics",
  "instructions",
  "tools",
  "knowledge",
  "chat-experience",
  "access",
  "safety",
  "appearance",
  "developer",
] as const;

export function EditorView({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");

  const editor = useAgentEditor(agent);
  const refs = useEditorReferenceData(agent.id);
  const activeId = useScrollSpy(SECTION_IDS as unknown as string[]);
  const { confirmIfDirty, guardDialog } = useUnsavedChangesGuard(editor.dirty);

  const sections = React.useMemo(
    () =>
      SECTION_IDS.map((id) => ({
        id,
        label: t(`editor.sections.${camel(id)}` as any),
      })),
    [t],
  );

  const handleSelect = React.useCallback((id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    // Move focus to the section heading for keyboard / screen-reader users.
    target.setAttribute("tabindex", "-1");
    (target as HTMLElement).focus({ preventScroll: true });
  }, []);

  const sectionProps = { agent, editor, refs };

  return (
    <PageShell variant="content">
      <EditorHeader
        agent={agent}
        editor={editor}
        confirmIfDirty={confirmIfDirty}
      />
      <Separator />

      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        <SectionNav
          sections={sections}
          activeId={activeId}
          onSelect={handleSelect}
        />

        <div className="min-w-0">
          <div className="mx-auto max-w-3xl space-y-12">
            <BasicsSection {...sectionProps} />
            <InstructionsSection {...sectionProps} />
            <ToolsSection {...sectionProps} />
            <KnowledgeSection {...sectionProps} />
            <ChatExperienceSection {...sectionProps} />
            <AccessSection {...sectionProps} />
            <SafetySection {...sectionProps} />
            <AppearanceSection {...sectionProps} />
            <DeveloperSection {...sectionProps} />
          </div>
        </div>
      </div>

      <SaveBar
        dirty={editor.dirty}
        saving={editor.saving}
        onSave={() => editor.save()}
        onDiscard={() => editor.discard()}
        summary={t("editor.unsavedChanges")}
      />

      {guardDialog}
    </PageShell>
  );
}

function camel(id: string): string {
  return id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
