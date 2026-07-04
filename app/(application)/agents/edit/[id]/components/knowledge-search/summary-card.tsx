"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";

import type { ToolConfigEntry } from "../tool-config-fields";
import { buildSummary, parseWizardConfig } from "./config-schema";
import type { WizardStepId } from "./wizard";

export function KnowledgeSearchSummaryCard({
  entries, contexts, onEdit,
}: {
  entries: ToolConfigEntry[];
  contexts: { id: string; name: string; description?: string }[];
  onEdit: (step: WizardStepId) => void;
}) {
  const t = useTranslations("agents");
  const cfg = parseWizardConfig(entries);
  const s = buildSummary(cfg, contexts.map((c) => c.id));

  const parts = [
    t("editor.knowledge.summary.kbs", { count: s.kbCount }),
    t("editor.knowledge.summary.rules", { count: s.ruleCount }),
    s.memoryOn
      ? t("editor.knowledge.summary.memoryOn")
      : t("editor.knowledge.summary.memoryOff"),
    s.rerankerLabel
      ? t("editor.knowledge.summary.reranker", { name: s.rerankerLabel })
      : t("editor.knowledge.summary.noReranker"),
  ];

  const areas: { step: WizardStepId; key: string }[] = [
    { step: "sources", key: "editSources" },
    { step: "routing", key: "editRouting" },
    { step: "vocabulary", key: "editVocabulary" },
    { step: "behavior", key: "editBehavior" },
  ];

  return (
    <div className="space-y-3 border-t pt-3">
      <p className="text-sm text-muted-foreground">{parts.join(" · ")}</p>
      <div className="flex flex-wrap gap-2">
        {areas.map((a) => (
          <Button
            key={a.step}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(a.step)}
          >
            {t(`editor.knowledge.summary.${a.key}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}
