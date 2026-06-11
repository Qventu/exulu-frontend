"use client";

/**
 * Create-project dialog (inventory 11-14; ladder rows 11-13). Route-local
 * rewrite of components/create-project-dialog.tsx:
 * - Name + Description visible; Custom instructions inside a collapsed
 *   "Advanced" section (P2's ~3-decision rule, ladder row 11);
 * - "Private — only you" reassurance under the form (ladder row 12;
 *   philosophy §9: trust signal at the moment of creation, not wallpaper);
 * - i18n'd (fixes UX 5), console.log removed (UX 14);
 * - mutation contract unchanged: CREATE_PROJECT with rights_mode "private",
 *   success toast, reset, close, navigate to the new project.
 */

import { useMutation } from "@apollo/client";
import { ChevronRight, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { cn } from "@/lib/utils";

import { CREATE_PROJECT } from "../queries";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Refresh the index list after a successful create. */
  onCreated?: () => void;
}

const EMPTY_FORM = { name: "", description: "", custom_instructions: "" };

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateProjectDialogProps) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [createProject] = useMutation(CREATE_PROJECT);

  const reset = () => {
    setForm(EMPTY_FORM);
    setAdvancedOpen(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name.trim()) {
      toast.error(t("create.nameRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const result = await createProject({
        variables: {
          input: {
            name: form.name.trim(),
            description: form.description.trim() || null,
            custom_instructions: form.custom_instructions.trim() || null,
            rights_mode: "private",
          },
        },
      });

      const newProject = result.data?.projectsCreateOne?.item;
      if (newProject) {
        toast.success(t("create.success"));
        reset();
        onOpenChange(false);
        onCreated?.();
        router.push(`/projects/${newProject.id}`);
      }
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("create.error"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("create.title")}</DialogTitle>
          <DialogDescription>{t("create.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">{t("create.nameLabel")}</Label>
            <Input
              id="project-name"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              placeholder={t("create.namePlaceholder")}
              className="text-base md:text-sm"
              required
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">
              {t("create.descriptionLabel")}
            </Label>
            <Textarea
              id="project-description"
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder={t("create.descriptionPlaceholder")}
              className="text-base md:text-sm"
              rows={3}
              disabled={submitting}
            />
          </div>

          {/* L3 within the dialog: custom instructions behind "Advanced". */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 gap-1 text-muted-foreground"
              >
                <ChevronRight
                  aria-hidden="true"
                  className={cn(
                    "size-4 transition-transform duration-200 motion-reduce:transition-none",
                    advancedOpen && "rotate-90",
                  )}
                />
                {t("create.advanced")}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="space-y-2">
                <Label htmlFor="project-instructions">
                  {t("create.instructionsLabel")}
                </Label>
                <Textarea
                  id="project-instructions"
                  value={form.custom_instructions}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      custom_instructions: event.target.value,
                    })
                  }
                  placeholder={t("create.instructionsPlaceholder")}
                  className="text-base md:text-sm"
                  rows={3}
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  {t("create.instructionsHint")}
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Trust signal at the moment of creation (philosophy §9). */}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock aria-hidden="true" className="size-3 shrink-0" />
            {t("create.privateHint")}
          </p>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={submitting}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && (
                <Loader2
                  aria-hidden="true"
                  className="mr-2 size-4 animate-spin"
                />
              )}
              {submitting ? t("create.creating") : t("create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
