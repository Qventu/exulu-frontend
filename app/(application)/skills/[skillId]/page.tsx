/**
 * /skills/[skillId] — skill mini-IDE route (work item 2.10 / ide owner).
 *
 * Thin client wrapper: just resolves the route param and delegates to
 * <SkillEditorView/>. NO `getTranslations` here — the project's
 * `i18n/config.ts` is the named-export variant and `next-intl/server`'s
 * `getRequestConfig` is not wired, so server pages cannot call it
 * without crashing the build (same pattern as agents/edit/[id]/page.tsx
 * and prompts/[id]/page.tsx).
 *
 * `MobileTopbarAction` mounting + the editor's loading/error branches all
 * live inside <SkillEditorView/> because they depend on client data
 * (`useSkillById`).
 */

"use client";

import { use } from "react";

import { SkillEditorView } from "./components/skill-editor-view";

interface PageProps {
  params: Promise<{ skillId: string }>;
}

export default function SkillEditorPage({ params }: PageProps) {
  const { skillId } = use(params);
  return <SkillEditorView skillId={skillId} />;
}
