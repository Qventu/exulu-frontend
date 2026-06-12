"use client";

/**
 * AgentAvatarGenerator — relocated from the legacy create dialog (items 9-13).
 *
 * Spec: design/pages/agents.md ladder rows 9-14 + binding contract
 * AgentAvatarGeneratorProps. Carries the 11 image styles, 4-slot determinate
 * progress grid, picker (first image auto-selected), and the OPENAI_IMAGE_
 * GENERATION_API_KEY info alert verbatim. Persistence is the caller's job —
 * Appearance section stages the URL via setImage and saves through $image on
 * UPDATE_AGENT_EDITOR.
 *
 * Path per codebase-structure §1 target tree (agents/components/avatar-
 * generator). The editor's Appearance section is the only consumer.
 *
 * Responsive: simple centered Dialog (T5 — max-w-lg fits at 390 px), one
 * overlay at a time (anti-pattern #3 modal-on-modal).
 */

import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { agentsApi, type ImageStyle } from "@/lib/api/agents";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface AgentAvatarGeneratorProps {
  agentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chosen generated image URL; persistence is the caller's job. */
  onSelect: (imageUrl: string) => void;
}

const STYLE_VALUES: ImageStyle[] = [
  "origami",
  "anime",
  "japanese_anime",
  "vaporwave",
  "lego",
  "paper_cut",
  "felt_puppet",
  "3d",
  "app_icon",
  "pixel_art",
  "isometric",
];

export function AgentAvatarGenerator({
  agentName,
  open,
  onOpenChange,
  onSelect,
}: AgentAvatarGeneratorProps) {
  const t = useTranslations("agents");
  const tCommon = useTranslations("common");

  const [style, setStyle] = React.useState<ImageStyle>("origami");
  const [generating, setGenerating] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [images, setImages] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<string | null>(null);

  // Fresh state every time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setStyle("origami");
      setGenerating(false);
      setProgress(0);
      setImages([]);
      setSelected(null);
    }
  }, [open]);

  const handleGenerate = async () => {
    setGenerating(true);
    setProgress(0);
    setImages([]);
    setSelected(null);
    try {
      const promises = Array.from({ length: 4 }, async () => {
        const response = await agentsApi.image.generate({
          name: agentName,
          description: "",
          style,
        });
        const result = await response.json();
        setProgress((prev) => prev + 1);
        return result.image as string | undefined;
      });
      const results = await Promise.all(promises);
      const filtered = results.filter(Boolean) as string[];
      setImages(filtered);
      if (filtered.length > 0) setSelected(filtered[0]);
    } catch (error) {
      console.error("Failed to generate images:", error);
      toast.error(t("createDialog.imageGenerationFailed"));
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = () => {
    if (!selected) return;
    onSelect(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("editor.appearance.generateTitle")}</DialogTitle>
          <DialogDescription>
            {t("editor.appearance.generateDescription")}
          </DialogDescription>
        </DialogHeader>

        {/* Style picker — only shown while not generating + before results. */}
        {!generating && images.length === 0 && (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="agent-avatar-style">
                {t("createDialog.imageStyle")}
              </Label>
              <Select
                value={style}
                onValueChange={(value) => setStyle(value as ImageStyle)}
              >
                <SelectTrigger id="agent-avatar-style">
                  <SelectValue
                    placeholder={t("createDialog.imageStylePlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`imageStyles.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Alert>
              <AlertDescription>
                {t("createDialog.imageInfoAlert")}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* 4-slot determinate progress grid. */}
        {generating && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm font-medium">
                {t("createDialog.generatingImages")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("createDialog.generatingProgress", { current: progress })}
              </p>
              <div className="mx-auto mt-3 h-2 w-32 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${(progress / 4) * 100}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="relative flex aspect-square items-center justify-center rounded-lg border-2 border-dashed bg-muted/30"
                >
                  {i < progress ? (
                    <Check
                      aria-hidden="true"
                      className="size-8 text-success"
                    />
                  ) : (
                    <Loader2
                      aria-hidden="true"
                      className="size-6 animate-spin text-muted-foreground"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Picker grid. */}
        {!generating && images.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {images.map((image, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setSelected(image)}
                aria-pressed={selected === image}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-lg border-2 transition-colors duration-150 motion-reduce:transition-none",
                  selected === image
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-input hover:border-primary/50",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt={`${t("editor.appearance.optionLabel")} ${index + 1}`}
                  className="h-full w-full object-cover"
                />
                {selected === image && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                    <div className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-4" aria-hidden="true" />
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          {images.length === 0 ? (
            <Button type="button" disabled={generating} onClick={handleGenerate}>
              {generating ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {t("createDialog.buttonGenerateImages")}
            </Button>
          ) : (
            <Button type="button" disabled={!selected} onClick={handleApply}>
              {t("editor.appearance.useImage")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
