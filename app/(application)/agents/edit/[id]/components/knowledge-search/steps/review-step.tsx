"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";

import { buildSummary, selectedKbIds, type WizardConfig } from "../config-schema";

export function ReviewStep({
  draft, contexts, memoryContextId,
}: {
  draft: WizardConfig;
  contexts: { id: string; name: string; description?: string }[];
  memoryContextId: string;
}) {
  const t = useTranslations("agents");
  const allIds = contexts.map((c) => c.id);
  const summary = buildSummary(draft, allIds);
  const enabled = selectedKbIds(draft, allIds);
  const nameOf = (id: string) => contexts.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("editor.knowledge.wizard.review.intro")}
      </p>

      <div className="space-y-1 rounded-md border p-3">
        <p className="text-sm font-medium">
          {t("editor.knowledge.wizard.review.sourcesTitle", { count: summary.kbCount })}
        </p>
        <div className="flex flex-wrap gap-1">
          {enabled.map((id) => (
            <Badge key={id} variant="secondary">
              {nameOf(id)}
              <span className="ml-1 text-muted-foreground">
                {t(`editor.knowledge.wizard.sources.kinds.${draft.knowledgeBases[id]?.kind ?? "documents"}.label`)}
              </span>
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-1 rounded-md border p-3">
        <p className="text-sm font-medium">
          {t("editor.knowledge.wizard.review.routingTitle", { count: summary.ruleCount })}
        </p>
        {draft.routing.rules.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("editor.knowledge.wizard.routing.defaultNote")}
          </p>
        ) : (
          draft.routing.rules.map((r) => (
            <p key={r.id} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{r.label || r.id}</span>
              {" → "}{r.main.map(nameOf).join(", ")}
              {r.fallback.length > 0 && ` (${t("editor.knowledge.wizard.review.fallback")}: ${r.fallback.map(nameOf).join(", ")})`}
            </p>
          ))
        )}
      </div>

      <div className="space-y-1 rounded-md border p-3">
        <p className="text-sm font-medium">{t("editor.knowledge.wizard.review.vocabularyTitle")}</p>
        <p className="text-xs text-muted-foreground">
          {t("editor.knowledge.wizard.review.vocabularyLine", {
            glossary: draft.vocabulary.glossary.length,
            identifiers: draft.vocabulary.identifiers.length,
            rewrites: draft.vocabulary.rewrites.length,
          })}
        </p>
      </div>

      <div className="space-y-1 rounded-md border p-3">
        <p className="text-sm font-medium">{t("editor.knowledge.wizard.review.memoryTitle")}</p>
        <p className="text-xs text-muted-foreground">
          {!memoryContextId
            ? t("editor.knowledge.wizard.memory.noMemoryTitle")
            : draft.memory.enabled
              ? t("editor.knowledge.wizard.review.memoryOn")
              : t("editor.knowledge.wizard.review.memoryOff")}
        </p>
      </div>

      <div className="space-y-1 rounded-md border p-3">
        <p className="text-sm font-medium">{t("editor.knowledge.wizard.review.behaviorTitle")}</p>
        <p className="text-xs text-muted-foreground">
          {t("editor.knowledge.wizard.review.behaviorLine", {
            topK: draft.tuning.topK,
            percent: Math.round(draft.tuning.fallbackThreshold * 100),
            reranker: summary.rerankerLabel || t("editor.knowledge.wizard.review.noReranker"),
          })}
        </p>
      </div>
    </div>
  );
}
