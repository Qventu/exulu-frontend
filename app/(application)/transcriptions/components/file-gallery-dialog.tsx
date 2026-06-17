"use client";

/**
 * Responsive host for the file gallery (inventory items 18–27).
 *
 * - `< md`: full-screen bottom Sheet (`h-[90dvh]`, safe-area padded) per
 *   responsive.md T5, with a ≥44px close button in its header and the
 *   upload section first (the phone job is "upload what I just recorded").
 * - `≥ md`: centered Dialog capped at `max-h-[85dvh]`.
 *
 * Both hosts are flex columns: the gallery body scrolls internally and the
 * confirm action sits in the gallery's sticky footer, so it can never land
 * off-screen (the old `sm:max-w-[900px]`-with-no-max-height overflow from
 * the mobile audit).
 *
 * The gallery itself is the route-local FileGallery (see file-gallery.tsx —
 * local stub of the FilePicker widget with the page-doc card-action fixes).
 */
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

import { AUDIO_FILE_TYPES } from "../types";
import { FileGallery } from "./file-gallery";

export interface FileGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the chosen S3 key (selection limit is 1). */
  onSelect: (s3Key: string) => void;
}

export function FileGalleryDialog({
  open,
  onOpenChange,
  onSelect,
}: FileGalleryDialogProps) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();

  const handleConfirm = (keys: string[]) => {
    if (keys.length > 0) onSelect(keys[0]);
    onOpenChange(false);
  };

  const gallery = (
    <FileGallery
      id="transcriptions-upload"
      selectionLimit={1}
      allowedFileTypes={[...AUDIO_FILE_TYPES]}
      dependencies={[]}
      onConfirm={handleConfirm}
    />
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-[90dvh] flex-col gap-0 rounded-t-lg pb-[max(1rem,env(safe-area-inset-bottom))] [&>button]:hidden"
        >
          <SheetHeader className="shrink-0 text-left">
            <div className="flex items-start justify-between gap-2">
              <SheetTitle>{t("gallery.title")}</SheetTitle>
              {/* The stock sheet close is a ~16px target; replace it with a
                  44px one (responsive.md §2 touch targets). */}
              <SheetClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="-mr-2 -mt-2 size-11 shrink-0"
                  aria-label={tCommon("close")}
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </SheetClose>
            </div>
            <SheetDescription>{t("gallery.description")}</SheetDescription>
          </SheetHeader>
          {gallery}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-[900px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("gallery.title")}</DialogTitle>
          <DialogDescription>{t("gallery.description")}</DialogDescription>
        </DialogHeader>
        {gallery}
      </DialogContent>
    </Dialog>
  );
}
