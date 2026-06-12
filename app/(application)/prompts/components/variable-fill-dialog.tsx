"use client";

/**
 * VariableFillDialog — local copy of the chat composer's PromptVariableForm
 * pattern, used by /prompts "Use prompt" when the prompt has variables.
 *
 * The cross-feature original at `app/(application)/chat/components/
 * prompt-variable-form.tsx` cannot be imported from /prompts under the
 * tier-boundary lint (codebase-structure §1.2). Per the graduation rule
 * (§1.1) the second consumer would promote it to
 * `components/widgets/prompt-variable-form.tsx` — that promotion is
 * registered for a future work item (codebase-structure §2.4 lists
 * PromptVariableForm under widgets), not this one. Until then, both
 * surfaces ship the same shape locally; identical UX, no divergence in
 * behavior to flag.
 *
 * Behavior preserved verbatim from the legacy:
 * - Per-variable Input, names Title-Cased via `formatVariableName`.
 * - Submit disabled until every field has non-whitespace input.
 * - Configurable submit label (consumer passes the "copy/insert" copy).
 */

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatVariableName } from "@/lib/prompts/format-variable-name";

interface VariableFillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variables: string[];
  promptName: string;
  onSubmit: (values: Record<string, string>) => void | Promise<void>;
  submitButtonText: string;
}

export function VariableFillDialog({
  open,
  onOpenChange,
  variables,
  promptName,
  onSubmit,
  submitButtonText,
}: VariableFillDialogProps) {
  const t = useTranslations("prompts");
  const tCommon = useTranslations("common");
  // Reset whenever the variables array identity changes by keying the
  // controlled-state hook off it (compared to JSON shape so a fresh array
  // with the same names doesn't trigger). This avoids the setState-in-effect
  // anti-pattern the legacy form had (react-hooks/set-state-in-effect).
  const variablesKey = variables.join("|");
  const [seedKey, setSeedKey] = useState(variablesKey);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(variables.map((v) => [v, ""])),
  );
  if (seedKey !== variablesKey) {
    setSeedKey(variablesKey);
    setValues(Object.fromEntries(variables.map((v) => [v, ""])));
  }

  const allFilled = variables.every((v) => values[v]?.trim());

  const handleSubmit = async () => {
    await onSubmit(values);
    setValues({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("variables.title")}</DialogTitle>
          <DialogDescription>
            {t("variables.description", { name: promptName })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {variables.map((variable) => (
            <div key={variable} className="space-y-2">
              <Label htmlFor={`var-${variable}`}>
                {formatVariableName(variable)}
              </Label>
              <Input
                id={`var-${variable}`}
                value={values[variable] ?? ""}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    [variable]: event.target.value,
                  }))
                }
                placeholder={t("variables.placeholder", {
                  name: formatVariableName(variable).toLowerCase(),
                })}
                className="text-base sm:text-sm"
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!allFilled}
          >
            {submitButtonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
