"use client";

/**
 * Steps section — read-only preview of the conversation that backs this
 * routine, with a single primary action to open the wide Steps Sheet
 * (StepsEditorSheet) for the full editor experience.
 *
 * Why a Sheet, not inline: the Conversation/Composer needs horizontal room
 * the inline column (`max-w-3xl`) does not give it; the agents workbench
 * uses the same pattern for surfaces that overflow the column (review of
 * /agents/edit/[id] §Tools, §Instructions).
 *
 * Also surfaces the routine's `variables` list — variables are derived
 * backend-side from `{var}` placeholders in steps_json, so this is the most
 * natural place to render them (replaces the killed Overview section).
 */

import { Pencil, Eye, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import type { UIMessage } from "ai";

import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";
import { MessageRenderer } from "@/components/message-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { Routine } from "../../types";

export interface StepsSectionProps {
  routine: Routine;
  stepsJson: UIMessage[];
  canWrite: boolean;
  onOpenSheet: () => void;
}

export function StepsSection({
  routine,
  stepsJson,
  canWrite,
  onOpenSheet,
}: StepsSectionProps) {
  const t = useTranslations("routines");
  const variables = routine.variables ?? [];

  const count = stepsJson.length;

  return (
    <section id="steps" className="scroll-mt-20 space-y-4" tabIndex={-1}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">{t("editor.sections.steps")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("steps.preview.heading", { count })}
          </p>
        </div>
        {/* `outline` for both read and write so only Run is purple at rest;
            when the page becomes dirty only Run + SaveBar's Save are purple —
            never three primaries on screen at once (audit rule). */}
        <Button onClick={onOpenSheet} variant="outline">
          {canWrite ? (
            <Pencil aria-hidden="true" className="mr-2 size-4" />
          ) : (
            <Eye aria-hidden="true" className="mr-2 size-4" />
          )}
          {canWrite ? t("steps.editAction") : t("steps.viewAction")}
        </Button>
      </div>

      {count === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 text-center">
          <Sparkles
            aria-hidden="true"
            className="mb-3 size-10 text-muted-foreground/50"
          />
          <h4 className="text-sm font-medium">{t("steps.preview.empty")}</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("editor.steps.emptyDescription")}
          </p>
        </div>
      ) : (
        /* @ts-ignore — Conversation/ConversationContent accept className/children. */
        <Conversation className="max-h-[400px] overflow-y-auto rounded-lg border bg-muted/30">
          {/* @ts-ignore */}
          <ConversationContent className="px-4 py-4">
            <MessageRenderer
              messages={stepsJson}
              config={{
                marginTopFirstMessage: "mt-0",
                customAssistantClassnames:
                  "px-4 py-4 border-l-2 border-primary/30",
              }}
              status="ready"
              showActions={false}
              showEdit={false}
              showRemove={false}
              showTokens={false}
              writeAccess={false}
            />
          </ConversationContent>
        </Conversation>
      )}

      {/* Variables — derived backend-side from {var} placeholders in
          steps_json. Lives here (instead of a separate Overview section)
          because it's the relationship to the steps that makes it readable. */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-medium text-muted-foreground">
          {t("overview.variables")}
        </h4>
        {variables.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {variables.map((variable) => (
              <Badge
                key={variable}
                variant="secondary"
                className="font-mono text-xs"
              >
                {variable}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("overview.noVariables")}
          </p>
        )}
      </div>
    </section>
  );
}
