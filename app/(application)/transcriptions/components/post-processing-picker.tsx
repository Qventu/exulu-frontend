"use client";

/**
 * Repeatable {prompt from the library, explicitly chosen agent} rows that
 * auto-run when a transcript is ready. Shared by the meeting-bot composer and
 * the record-on-this-device composer. Starts empty; the user opts in per job.
 */
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { AgentOption, PromptOption } from "../hooks";
import type { PostProcessingPrompt } from "../types";

export interface PostProcessingPickerProps {
  rows: PostProcessingPrompt[];
  onChange: (rows: PostProcessingPrompt[]) => void;
  prompts: PromptOption[];
  agents: AgentOption[];
}

export function PostProcessingPicker({ rows, onChange, prompts, agents }: PostProcessingPickerProps) {
  const t = useTranslations("transcriptions");
  const addRow = () => onChange([...rows, { prompt_id: "", agent_id: "" }]);
  const removeRow = (index: number) => onChange(rows.filter((_, i) => i !== index));
  const updateRow = (index: number, patch: Partial<PostProcessingPrompt>) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{t("composer.postProcessing")}</Label>
        <Button type="button" variant="ghost" size="sm" onClick={addRow} className="max-md:h-11">
          <Plus aria-hidden="true" className="mr-1 size-4" />
          {t("composer.addPrompt")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("composer.postProcessingHint")}</p>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <Select value={row.prompt_id} onValueChange={(value) => updateRow(index, { prompt_id: value })}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={t("composer.selectPrompt")} />
              </SelectTrigger>
              <SelectContent>
                {prompts.map((prompt) => (
                  <SelectItem key={prompt.id} value={prompt.id}>
                    {prompt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={row.agent_id} onValueChange={(value) => updateRow(index, { agent_id: value })}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={t("composer.selectAgent")} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              aria-label={t("composer.removePrompt")}
              onClick={() => removeRow(index)}
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** True when every row is fully specified — the Start buttons gate on this. */
export function postProcessingRowsComplete(rows: PostProcessingPrompt[]): boolean {
  return rows.every((r) => r.prompt_id && r.agent_id);
}
