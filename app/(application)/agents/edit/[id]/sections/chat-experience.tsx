"use client";

/**
 * Chat experience section — uniform SettingRows: item 39 (welcome message),
 * 54 (follow-up suggestions), 53 (feedback collection), 44 (default agent).
 * One pattern (fixes agents.md #10 — three competing switch-row styles).
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { SettingRow } from "@/components/primitives/setting-row";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import type { EditorSectionProps } from "./types";

export function ChatExperienceSection({ editor }: EditorSectionProps) {
  const t = useTranslations("agents");

  return (
    <section id="chat-experience" className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">
          {t("editor.sections.chatExperience")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("editor.chatExperience.description")}
        </p>
      </div>

      <Form {...editor.form}>
        <div className="space-y-3">
          {/* Welcome message — uses a setting-row-styled wrapper but with a
              full-width textarea below the label. */}
          <FormField
            control={editor.form.control}
            name="welcomemessage"
            render={({ field }) => (
              <div className="space-y-2 rounded-lg border p-4">
                <div className="space-y-0.5">
                  <label
                    htmlFor="agent-welcome-message"
                    className="text-sm font-medium"
                  >
                    {t("editor.chatExperience.welcomeLabel")}
                  </label>
                  <p className="text-sm text-muted-foreground">
                    {t("editor.chatExperience.welcomeDescription")}
                  </p>
                </div>
                <Textarea
                  id="agent-welcome-message"
                  rows={3}
                  {...field}
                  value={field.value ?? ""}
                />
              </div>
            )}
          />

          <FormField
            control={editor.form.control}
            name="suggestions_enabled"
            render={({ field }) => (
              <SettingRow
                htmlFor="agent-suggestions"
                label={t("editor.chatExperience.suggestionsLabel")}
                description={t("editor.chatExperience.suggestionsDescription")}
              >
                <Switch
                  id="agent-suggestions"
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                />
              </SettingRow>
            )}
          />

          <FormField
            control={editor.form.control}
            name="feedback"
            render={({ field }) => (
              <SettingRow
                htmlFor="agent-feedback"
                label={t("editor.chatExperience.feedbackLabel")}
                description={t("editor.chatExperience.feedbackDescription")}
              >
                <Switch
                  id="agent-feedback"
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                />
              </SettingRow>
            )}
          />

          <FormField
            control={editor.form.control}
            name="defaultagent"
            render={({ field }) => (
              <SettingRow
                htmlFor="agent-default"
                label={t("editor.chatExperience.defaultLabel")}
                description={t("editor.chatExperience.defaultDescription")}
              >
                <Switch
                  id="agent-default"
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                />
              </SettingRow>
            )}
          />

          <FormField
            control={editor.form.control}
            name="sandbox_enabled"
            render={({ field }) => (
              <SettingRow
                htmlFor="agent-sandbox"
                label={t("editor.chatExperience.sandboxLabel")}
                description={t("editor.chatExperience.sandboxDescription")}
              >
                <Switch
                  id="agent-sandbox"
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                />
              </SettingRow>
            )}
          />

          <FormField
            control={editor.form.control}
            name="max_tool_steps"
            render={({ field }) => (
              <SettingRow
                htmlFor="agent-max-tool-steps"
                label={t("editor.chatExperience.maxToolStepsLabel")}
                description={t("editor.chatExperience.maxToolStepsDescription")}
              >
                <Input
                  id="agent-max-tool-steps"
                  type="number"
                  min={0}
                  max={50}
                  className="w-24"
                  value={field.value ?? 0}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    field.onChange(Number.isFinite(n) ? Math.max(0, Math.min(50, Math.round(n))) : 0);
                  }}
                />
              </SettingRow>
            )}
          />
        </div>
      </Form>
    </section>
  );
}
