"use client";

/**
 * Knowledge & memory section — item 56 (agentic retrieval enable + config,
 * tool-existence-gated) and item 52 (memory context combobox). Two SettingRow-
 * headed subsections with quiet enabled badges. Removes the `z-[9999]` escape
 * hatch on the memory popover.
 */

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

import { KnowledgeSearchSummaryCard } from "../components/knowledge-search/summary-card";
import {
  KnowledgeSearchWizard, WIZARD_STEPS, type WizardStepId,
} from "../components/knowledge-search/wizard";
import { MemorySection } from "../components/memory-section";
import type { ToolConfigEntry } from "../components/tool-config-fields";
import type { EditorSectionProps } from "./types";

export function KnowledgeSection({ agent, editor, refs }: EditorSectionProps) {
  const t = useTranslations("agents");

  const agenticEnabled = editor.tools.some(
    (t) => t.id === "agentic_context_search",
  );

  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [wizardStep, setWizardStep] = React.useState<WizardStepId>("sources");

  const agenticEntries =
    (editor.tools.find((t) => t.id === "agentic_context_search")
      ?.config as ToolConfigEntry[]) || [];

  const applyAgenticConfig = (entries: ToolConfigEntry[]) => {
    editor.setTools(
      editor.tools.map((t) =>
        t.id === "agentic_context_search" ? { ...t, config: entries as any } : t,
      ),
    );
  };

  const openWizard = (step: WizardStepId) => {
    setWizardStep(step);
    setWizardOpen(true);
  };

  // Deep link: /agents/edit/<id>?wizard=<step> opens the retrieval wizard on
  // that step. Lets a link point at one setting — "your routing rules are
  // here" — instead of at the page plus instructions for finding it.
  // Read once on mount rather than watched, so closing the drawer does not
  // immediately reopen it while the param is still in the URL.
  const searchParams = useSearchParams();
  const requestedStep = searchParams.get("wizard");
  React.useEffect(() => {
    if (!requestedStep) return;
    if (!WIZARD_STEPS.includes(requestedStep as WizardStepId)) return;
    // The setters, not openWizard: they are stable, so the dependency list is
    // honestly complete rather than silenced.
    setWizardStep(requestedStep as WizardStepId);
    setWizardOpen(true);
  }, [requestedStep]);

  // Enabling stages the tool immediately (with empty config values → backend defaults)
  // and then opens the wizard. Closing the wizard without Apply keeps the tool enabled;
  // the switch — not the wizard — is the undo for enablement.
  const toggleAgentic = (enabled: boolean) => {
    if (!refs.agenticRetrievalTool) return;
    if (enabled) {
      editor.setTools([
        ...editor.tools,
        {
          id: refs.agenticRetrievalTool.id,
          type: refs.agenticRetrievalTool.type as any,
          name: refs.agenticRetrievalTool.name,
          config:
            refs.agenticRetrievalTool.config?.map((c) => ({
              name: c.name,
              variable: "",
              type: c.type as any,
            })) || [],
        },
      ]);
      openWizard("sources");
    } else {
      editor.setTools(
        editor.tools.filter((t) => t.id !== "agentic_context_search"),
      );
    }
  };

  return (
    <section id="knowledge" className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">
          {t("editor.sections.knowledge")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("editor.knowledge.description")}
        </p>
      </div>

      {/* Agentic retrieval (item 56) — tool-existence-gated */}
      {refs.agenticRetrievalTool && (
        <div
          className="space-y-3 rounded-lg border p-4"
          data-demo-id="agent-agentic-retrieval"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {t("editor.knowledge.agenticTitle")}{" "}
                <Badge variant="outline" className="ml-1 font-normal">
                  {agenticEnabled
                    ? t("editor.knowledge.enabled")
                    : t("editor.knowledge.disabled")}
                </Badge>
              </p>
              <p className="text-sm text-muted-foreground">
                {t("editor.knowledge.agenticDescription")}
              </p>
            </div>
            <Switch
              checked={agenticEnabled}
              onCheckedChange={toggleAgentic}
              aria-label={t("editor.knowledge.agenticTitle")}
            />
          </div>

          {agenticEnabled && (
            <KnowledgeSearchSummaryCard
              entries={agenticEntries}
              contexts={refs.contexts}
              onEdit={openWizard}
            />
          )}
        </div>
      )}

      {/* Memory base — Workbench (Task 14) */}
      <MemorySection agent={agent} editor={editor} refs={refs} />

      <KnowledgeSearchWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initialStep={wizardStep}
        entries={agenticEntries}
        contexts={refs.contexts}
        memoryContextId={editor.memory}
        onApply={applyAgenticConfig}
      />
    </section>
  );
}
