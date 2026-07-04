"use client";

/**
 * KnowledgeSearchWizard — guided configuration for the agentic_context_search
 * tool (spec §4). Sheet + hand-rolled step machine (house pattern: see
 * add-user-dialog.tsx). Edits a WizardConfig draft in memory; Finish
 * serializes to config entries via onApply. Never talks to the backend.
 */

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { ToolConfigEntry } from "../tool-config-fields";
import {
  parseWizardConfig, serializeWizardConfig, type WizardConfig,
} from "./config-schema";
import { KnowledgeBasesStep } from "./steps/knowledge-bases-step";
import { RoutingStep } from "./steps/routing-step";
import { VocabularyStep } from "./steps/vocabulary-step";
import { MemoryStep } from "./steps/memory-step";
import { BehaviorStep } from "./steps/behavior-step";
import { ReviewStep } from "./steps/review-step";

export type WizardStepId =
  | "sources" | "routing" | "vocabulary" | "memory" | "behavior" | "review";

export const WIZARD_STEPS: WizardStepId[] = [
  "sources", "routing", "vocabulary", "memory", "behavior", "review",
];

export function KnowledgeSearchWizard({
  open, onOpenChange, initialStep, entries, contexts, memoryContextId, onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStep?: WizardStepId;
  entries: ToolConfigEntry[];
  contexts: { id: string; name: string; description?: string }[];
  memoryContextId: string;
  onApply: (entries: ToolConfigEntry[]) => void;
}) {
  const t = useTranslations("agents");
  const [step, setStep] = React.useState<WizardStepId>(initialStep ?? "sources");
  const [draft, setDraftState] = React.useState<WizardConfig>(() => parseWizardConfig(entries));

  // Re-seed the draft each time the wizard opens (staged entries may have changed).
  React.useEffect(() => {
    if (open) {
      setDraftState(parseWizardConfig(entries));
      setStep(initialStep ?? "sources");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setDraft = React.useCallback(
    (updater: (prev: WizardConfig) => WizardConfig) => setDraftState((p) => updater(p)),
    [],
  );

  const stepIndex = WIZARD_STEPS.indexOf(step);
  const isLast = stepIndex === WIZARD_STEPS.length - 1;

  const finish = () => {
    onApply(serializeWizardConfig(draft));
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-2xl">
        <SheetHeader className="border-b pb-3">
          <SheetTitle>{t("editor.knowledge.wizard.title")}</SheetTitle>
          <SheetDescription>
            {t(`editor.knowledge.wizard.steps.${step}.description`)}
          </SheetDescription>
          {/* Step dots + jump navigation */}
          <div className="flex items-center gap-1 pt-1">
            {WIZARD_STEPS.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setStep(s)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs transition-colors",
                  s === step
                    ? "bg-primary text-primary-foreground"
                    : i < stepIndex
                      ? "bg-muted text-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {t(`editor.knowledge.wizard.steps.${s}.label`)}
              </button>
            ))}
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          {step === "sources" && (
            <KnowledgeBasesStep draft={draft} setDraft={setDraft} contexts={contexts} />
          )}
          {step === "routing" && (
            <RoutingStep draft={draft} setDraft={setDraft} contexts={contexts} />
          )}
          {step === "vocabulary" && (
            <VocabularyStep draft={draft} setDraft={setDraft} contexts={contexts} />
          )}
          {step === "memory" && (
            <MemoryStep draft={draft} setDraft={setDraft} memoryContextId={memoryContextId} />
          )}
          {step === "behavior" && <BehaviorStep draft={draft} setDraft={setDraft} />}
          {step === "review" && (
            <ReviewStep draft={draft} contexts={contexts} memoryContextId={memoryContextId} />
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <Button
            type="button"
            variant="ghost"
            disabled={stepIndex === 0}
            onClick={() => setStep(WIZARD_STEPS[stepIndex - 1]!)}
          >
            <ArrowLeft className="mr-1 size-4" />
            {t("editor.knowledge.wizard.back")}
          </Button>
          {isLast ? (
            <Button type="button" onClick={finish}>
              <Check className="mr-1 size-4" />
              {t("editor.knowledge.wizard.finish")}
            </Button>
          ) : (
            <Button type="button" onClick={() => setStep(WIZARD_STEPS[stepIndex + 1]!)}>
              {t("editor.knowledge.wizard.continue")}
              <ArrowRight className="ml-1 size-4" />
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
