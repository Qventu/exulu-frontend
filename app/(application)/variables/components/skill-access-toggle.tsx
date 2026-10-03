"use client";

/**
 * SkillAccessToggle — controlled presentational toggle for a variable's
 * `allow_skill_access` grant (feat/skill-env-isolation, Task 7).
 *
 * Extracted out of the create/edit forms (rather than duplicated in both)
 * because the label + explanatory copy is one piece of microcopy that both
 * pages must render identically, and this is the one place in the component
 * that is cheap to unit-test — see the dispatch correction on task-7-brief.md
 * for why a shared `VariableForm` component does not exist here.
 *
 * Purely presentational: no mutation, no query, no translations state beyond
 * the two message keys. The parent owns `checked` and reacts to
 * `onCheckedChange`.
 */

import { useTranslations } from "next-intl";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface SkillAccessToggleProps {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  /** Disable the control (e.g. while a mutation is in flight). */
  disabled?: boolean;
}

export function SkillAccessToggle({
  checked,
  onCheckedChange,
  disabled,
}: SkillAccessToggleProps) {
  const t = useTranslations("variables");

  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-input p-3">
      <div className="space-y-1">
        <Label htmlFor="allow-skill-access">
          {t("form.allowSkillAccess")}
        </Label>
        <p className="text-sm text-muted-foreground">
          {t("form.allowSkillAccessDescription")}
        </p>
      </div>
      <Switch
        id="allow-skill-access"
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="mt-0.5"
      />
    </div>
  );
}
