"use client";

/**
 * Knowledge & memory section — item 56 (agentic retrieval enable + config,
 * tool-existence-gated) and item 52 (memory context combobox). Two SettingRow-
 * headed subsections with quiet enabled badges. Removes the `z-[9999]` escape
 * hatch on the memory popover.
 */

import { Check, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { SettingRow } from "@/components/primitives/setting-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { KnowledgeSearchSummaryCard } from "../components/knowledge-search/summary-card";
import {
  KnowledgeSearchWizard, type WizardStepId,
} from "../components/knowledge-search/wizard";
import type { ToolConfigEntry } from "../components/tool-config-fields";
import type { EditorSectionProps } from "./types";

export function KnowledgeSection({ editor, refs }: EditorSectionProps) {
  const t = useTranslations("agents");

  const agenticEnabled = editor.tools.some(
    (t) => t.id === "agentic_context_search",
  );
  const memoryEnabled = !!editor.memory;

  const selectedContext = refs.contexts.find((c) => c.id === editor.memory);

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
        <div className="space-y-3 rounded-lg border p-4">
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

      {/* Memory context (item 52) */}
      <div className="space-y-3 rounded-lg border p-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {t("editor.knowledge.memoryTitle")}{" "}
            <Badge variant="outline" className="ml-1 font-normal">
              {memoryEnabled
                ? t("editor.knowledge.enabled")
                : t("editor.knowledge.disabled")}
            </Badge>
          </p>
          <p className="text-sm text-muted-foreground">
            {t("editor.knowledge.memoryDescription")}
          </p>
        </div>

        <Popover modal>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between text-sm"
            >
              {selectedContext?.name || t("editor.knowledge.selectContext")}
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          {/* Constrain to the trigger width — Radix doesn't anchor it by
              default, which made the popover stretch the full content card. */}
          <PopoverContent
            align="start"
            className="max-h-[300px] p-0"
            style={{ width: "var(--radix-popover-trigger-width)" }}
          >
            <Command>
              <CommandInput
                placeholder={t("editor.knowledge.searchContexts")}
              />
              <CommandList>
                <CommandEmpty>
                  {t("editor.knowledge.noContexts")}
                </CommandEmpty>
                <CommandGroup>
                  <CommandItem onSelect={() => editor.setMemory("")}>
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        editor.memory === "" ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="text-muted-foreground">
                      {t("editor.knowledge.none")}
                    </span>
                  </CommandItem>
                  {refs.contexts.map((context) => (
                    <CommandItem
                      key={context.id}
                      onSelect={() => editor.setMemory(context.id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          editor.memory === context.id
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{context.name}</span>
                        {context.description && (
                          <span className="line-clamp-1 text-xs text-muted-foreground">
                            {context.description}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
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
