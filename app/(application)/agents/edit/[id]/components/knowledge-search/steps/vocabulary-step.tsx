"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  selectedKbIds, type IdentifierSet, type WizardConfig,
} from "../config-schema";

export function VocabularyStep({
  draft, setDraft, contexts,
}: {
  draft: WizardConfig;
  setDraft: (updater: (prev: WizardConfig) => WizardConfig) => void;
  contexts: { id: string; name: string; description?: string }[];
}) {
  const t = useTranslations("agents");
  const enabledIds = selectedKbIds(draft, contexts.map((c) => c.id));
  const enabledKbs = contexts.filter((c) => enabledIds.includes(c.id));

  const setVocab = (patch: Partial<WizardConfig["vocabulary"]>) =>
    setDraft((prev) => ({ ...prev, vocabulary: { ...prev.vocabulary, ...patch } }));

  const updateIdentifier = (idx: number, patch: Partial<IdentifierSet>) =>
    setVocab({
      identifiers: draft.vocabulary.identifiers.map((s, i) =>
        i === idx ? { ...s, ...patch } : s,
      ),
    });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("editor.knowledge.wizard.vocabulary.intro")}
      </p>

      {/* Glossary */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {t("editor.knowledge.wizard.vocabulary.glossaryTitle")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("editor.knowledge.wizard.vocabulary.glossaryHint")}
        </p>
        {draft.vocabulary.glossary.map((g, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              className="w-40"
              placeholder={t("editor.knowledge.wizard.vocabulary.termPlaceholder")}
              value={g.term}
              onChange={(e) =>
                setVocab({
                  glossary: draft.vocabulary.glossary.map((x, i) =>
                    i === idx ? { ...x, term: e.target.value } : x,
                  ),
                })
              }
            />
            <Input
              className="flex-1"
              placeholder={t("editor.knowledge.wizard.vocabulary.meaningPlaceholder")}
              value={g.meaning}
              onChange={(e) =>
                setVocab({
                  glossary: draft.vocabulary.glossary.map((x, i) =>
                    i === idx ? { ...x, meaning: e.target.value } : x,
                  ),
                })
              }
            />
            <Button
              type="button" variant="ghost" size="icon"
              aria-label={t("editor.knowledge.wizard.vocabulary.remove")}
              onClick={() =>
                setVocab({ glossary: draft.vocabulary.glossary.filter((_, i) => i !== idx) })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button" variant="outline" size="sm"
          onClick={() => setVocab({ glossary: [...draft.vocabulary.glossary, { term: "", meaning: "" }] })}
        >
          <Plus className="mr-1 size-4" />
          {t("editor.knowledge.wizard.vocabulary.addTerm")}
        </Button>
      </div>

      {/* Identifier sets */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {t("editor.knowledge.wizard.vocabulary.identifiersTitle")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("editor.knowledge.wizard.vocabulary.identifiersHint")}
        </p>
        {draft.vocabulary.identifiers.map((set, idx) => (
          <div key={idx} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder={t("editor.knowledge.wizard.vocabulary.identifierNamePlaceholder")}
                value={set.name}
                onChange={(e) => updateIdentifier(idx, { name: e.target.value })}
              />
              <Button
                type="button" variant="ghost" size="icon"
                aria-label={t("editor.knowledge.wizard.vocabulary.remove")}
                onClick={() =>
                  setVocab({ identifiers: draft.vocabulary.identifiers.filter((_, i) => i !== idx) })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <Input
              placeholder={t("editor.knowledge.wizard.vocabulary.examplesPlaceholder")}
              value={set.examples.join(", ")}
              onChange={(e) =>
                updateIdentifier(idx, {
                  examples: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
            />
            <Select
              value={set.strategy}
              onValueChange={(v) => updateIdentifier(idx, { strategy: v as "fuzzy" | "exact" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fuzzy">
                  {t("editor.knowledge.wizard.vocabulary.strategyFuzzy")}
                </SelectItem>
                <SelectItem value="exact">
                  {t("editor.knowledge.wizard.vocabulary.strategyExact")}
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-1">
              <p className="text-xs font-medium">
                {t("editor.knowledge.wizard.vocabulary.appliesTo")}
              </p>
              <div className="flex flex-wrap gap-1">
                {enabledKbs.map((kb) => (
                  <Badge
                    key={kb.id}
                    variant={set.contexts.includes(kb.id) ? "default" : "outline"}
                    className="cursor-pointer select-none"
                    onClick={() =>
                      updateIdentifier(idx, {
                        contexts: set.contexts.includes(kb.id)
                          ? set.contexts.filter((x) => x !== kb.id)
                          : [...set.contexts, kb.id],
                      })
                    }
                  >
                    {kb.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ))}
        <Button
          type="button" variant="outline" size="sm"
          onClick={() =>
            setVocab({
              identifiers: [
                ...draft.vocabulary.identifiers,
                { name: "", description: "", examples: [], strategy: "fuzzy", contexts: [] },
              ],
            })
          }
        >
          <Plus className="mr-1 size-4" />
          {t("editor.knowledge.wizard.vocabulary.addIdentifierSet")}
        </Button>
      </div>

      {/* Style hint */}
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {t("editor.knowledge.wizard.vocabulary.styleHintTitle")}
        </p>
        <Textarea
          rows={3}
          placeholder={t("editor.knowledge.wizard.vocabulary.styleHintPlaceholder")}
          value={draft.vocabulary.styleHint}
          onChange={(e) => setVocab({ styleHint: e.target.value })}
        />
      </div>

      {/* Advanced: rewrites */}
      <Accordion type="single" collapsible>
        <AccordionItem value="rewrites" className="border-none">
          <AccordionTrigger className="py-2 text-sm">
            {t("editor.knowledge.wizard.vocabulary.rewritesTitle")}
          </AccordionTrigger>
          <AccordionContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {t("editor.knowledge.wizard.vocabulary.rewritesHint")}
            </p>
            {draft.vocabulary.rewrites.map((rw, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  placeholder={t("editor.knowledge.wizard.vocabulary.findPlaceholder")}
                  value={rw.find}
                  onChange={(e) =>
                    setVocab({
                      rewrites: draft.vocabulary.rewrites.map((x, i) =>
                        i === idx ? { ...x, find: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Input
                  placeholder={t("editor.knowledge.wizard.vocabulary.replacePlaceholder")}
                  value={rw.replace}
                  onChange={(e) =>
                    setVocab({
                      rewrites: draft.vocabulary.rewrites.map((x, i) =>
                        i === idx ? { ...x, replace: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Button
                  type="button" variant="ghost" size="icon"
                  aria-label={t("editor.knowledge.wizard.vocabulary.remove")}
                  onClick={() =>
                    setVocab({ rewrites: draft.vocabulary.rewrites.filter((_, i) => i !== idx) })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button" variant="outline" size="sm"
              onClick={() =>
                setVocab({ rewrites: [...draft.vocabulary.rewrites, { find: "", replace: "" }] })
              }
            >
              <Plus className="mr-1 size-4" />
              {t("editor.knowledge.wizard.vocabulary.addRewrite")}
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
