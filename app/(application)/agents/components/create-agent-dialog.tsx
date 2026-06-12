"use client";

/**
 * CreateAgentDialog — "an agent in ~3 decisions" (work item 2.8, agents.md
 * create flow; binding contract `CreateAgentDialogProps`).
 *
 * Exactly three fields: Name (required, autofocus, INLINE field error — not a
 * generic toast, item 16), Model (AgentModelSelector with autoSelectDefault —
 * decision 2 is a confirmation, not a hunt, item 8), Instructions (optional
 * textarea). One primary button: "Create agent" → useCreateAgent (CREATE →
 * chained SET_AGENT_INSTRUCTIONS, item 15) → navigate to /agents/edit/{id}.
 *
 * Creation NEVER blocks on image generation (fixes agents.md review #8) —
 * avatar generation (items 9-13) is relocated to the editor's Appearance
 * section (agent-avatar-generator.tsx, editor-owned). Capability fallback
 * (contracts §5): if introspection proves AGENT_IMAGE_UPDATE_SUPPORTED=false,
 * the integrator wires the collapsed "Add an avatar" disclosure here, feeding
 * the generator's output to CREATE_AGENT's existing $image — the flag and the
 * generator are editor-owned, so the wiring cannot land from this side
 * (cross-owner import rule: index imports nothing of the editor's).
 *
 * The monogram preview (item 14) updates live with the name. Responsive: a
 * simple centered dialog (T5 — it fits), with max-h + internal scroll so the
 * on-screen keyboard never traps the submit action (V4).
 */

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";

import { useCreateAgent } from "../hooks";
import { AgentModelSelector } from "./agent-model-selector";

export interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAgentDialog({
  open,
  onOpenChange,
}: CreateAgentDialogProps) {
  const t = useTranslations("agents");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { create, creating } = useCreateAgent();

  const [name, setName] = React.useState("");
  const [model, setModel] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [nameTouched, setNameTouched] = React.useState(false);

  // Fresh state every time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setName("");
      setModel("");
      setInstructions("");
      setNameTouched(false);
    }
  }, [open]);

  const nameError = name.trim().length === 0;

  const handleSubmit = async () => {
    setNameTouched(true);
    if (nameError || creating) return;
    try {
      const id = await create({
        name: name.trim(),
        model: model || undefined,
        instructions: instructions.trim() || undefined,
      });
      onOpenChange(false);
      router.push(`/agents/edit/${id}`);
    } catch (error) {
      // Failure toast (item 16) — single toast system (sonner).
      toast.error(t("createDialog.createFailed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && creating) return; // don't lose an in-flight create
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[85dvh] flex-col gap-4 overflow-y-auto sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>{t("createDialog.title")}</DialogTitle>
          <DialogDescription>{t("createDialog.subtitle")}</DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          {/* Decision 1 — Name (item 6), with live monogram preview (item 14). */}
          <div className="flex items-end gap-3">
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-lg font-semibold text-primary"
            >
              {name.trim().charAt(0).toUpperCase() || "A"}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Label htmlFor="agent-name">{tCommon("name")}</Label>
              <Input
                id="agent-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => setNameTouched(true)}
                autoFocus
                autoComplete="off"
                className="text-base sm:text-sm"
                aria-invalid={nameTouched && nameError}
                aria-describedby={
                  nameTouched && nameError ? "agent-name-error" : undefined
                }
              />
            </div>
          </div>
          {nameTouched && nameError ? (
            <p
              id="agent-name-error"
              role="alert"
              className="-mt-2 text-xs text-destructive"
            >
              {t("createDialog.nameRequired")}
            </p>
          ) : null}

          {/* Decision 2 — Model (item 8), pre-selected via autoSelectDefault. */}
          <div className="flex flex-col gap-2">
            <Label asChild>
              <span>{t("createDialog.modelLabel")}</span>
            </Label>
            <AgentModelSelector
              value={model || undefined}
              onSelect={setModel}
              autoSelectDefault
            />
          </div>

          {/* Decision 3 — Instructions (optional). */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="agent-instructions">
              {t("createDialog.instructionsLabel")}{" "}
              <span className="font-normal text-muted-foreground">
                ({t("createDialog.optional")})
              </span>
            </Label>
            <Textarea
              id="agent-instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder={t("createDialog.instructionsPlaceholder")}
              rows={4}
              className="text-base sm:text-sm"
            />
          </div>

          <DialogFooter className="mt-2 gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={creating}
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            {/* ONE primary action (item 15). */}
            <Button type="submit" disabled={creating} aria-busy={creating}>
              {creating ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="mr-2 size-4 animate-spin"
                  />
                  {t("createDialog.creating")}
                </>
              ) : (
                <>
                  <Plus aria-hidden="true" className="mr-2 size-4" />
                  {t("createDialog.buttonCreate")}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
