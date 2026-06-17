"use client";

/**
 * Instructions section — item 41 custom instructions (hero), item 40 system
 * instructions (collapsed read-only disclosure when set by developer), items
 * 48/49/50 prompt templates (assigned list + Manage → PromptBrowserSheet +
 * create-prompt).
 */

import { Plus, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

// Cross-feature reuse preserved from the legacy form.tsx (PromptCard +
// PromptEditorModal). agents.md §4 Dependencies marks these as "reused as-is —
// coordinate any redesign of those with design/pages/prompts.md"; promoting
// them to components/widgets/ is explicitly scoped to the prompts redesign
// (codebase-structure §1 graduation rule), not this work item.
import { PromptCard } from "@/app/(application)/prompts/components/prompt-card";
import { UserContext } from "@/app/(application)/authenticated";
import { FormSection } from "@/components/primitives/form-section";
import { MarkdownEditor } from "@/components/primitives/markdown-editor";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { usePrompts } from "@/hooks/use-prompts";

import { PromptBrowserSheet } from "../components/prompt-browser-sheet";
import type { EditorSectionProps } from "./types";

export function InstructionsSection({ agent, editor }: EditorSectionProps) {
  const t = useTranslations("agents");
  const { user } = React.useContext(UserContext);
  const [browserOpen, setBrowserOpen] = React.useState(false);

  // Prompts assigned to this agent (server-filter via assigned_agents:contains).
  const { data, loading, refetch } = usePrompts({
    page: 1,
    limit: 100,
    filters: [{ assigned_agents: { contains: agent.id } }],
  });
  const agentPrompts = data?.prompt_libraryPagination?.items || [];

  return (
    <section id="instructions" className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">
          {t("editor.sections.instructions")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("editor.instructions.description")}
        </p>
      </div>

      <Form {...editor.form}>
        <FormField
          control={editor.form.control}
          name="instructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t("editor.instructions.customLabel")}
              </FormLabel>
              <FormDescription>
                {t("editor.instructions.customDescription")}
              </FormDescription>
              <FormControl>
                {/* Markdown editor — instructions support headings/lists/code,
                    so the plain textarea was lying about its inputs. The
                    primitive lazy-loads MDEditor to keep SSR clean and
                    follows resolvedTheme automatically. */}
                <MarkdownEditor
                  value={field.value ?? ""}
                  onChange={(v) =>
                    field.onChange(v ?? "")
                  }
                  height={360}
                  preview="edit"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>

      {/* System instructions (read-only) — only when set by a developer. */}
      {agent.systemInstructions && (
        <FormSection
          title={t("editor.instructions.systemTitle")}
          description={t("editor.instructions.systemDescription")}
          collapsible
        >
          <Textarea
            disabled
            rows={6}
            value={agent.systemInstructions}
            className="font-mono text-sm"
          />
        </FormSection>
      )}

      {/* Prompt templates (items 48/49/50). */}
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {t("editor.instructions.promptsTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("editor.instructions.promptsDescription", {
                count: agentPrompts.length,
              })}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBrowserOpen(true)}
          >
            <Settings className="mr-2 size-4" />
            {t("editor.instructions.manage")}
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">
            {t("editor.instructions.loadingPrompts")}
          </p>
        ) : agentPrompts.length === 0 ? (
          <div className="rounded-md border-2 border-dashed py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t("editor.instructions.noPromptsAssigned")}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {agentPrompts.map((prompt: any) => (
              <PromptCard
                key={prompt.id}
                minimal
                prompt={prompt}
                user={user}
                onUpdate={refetch}
              />
            ))}
          </div>
        )}
      </div>

      <PromptBrowserSheet
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        agentId={agent.id}
        agentName={agent.name ?? ""}
        user={user}
        onUpdate={refetch}
      />
    </section>
  );
}
