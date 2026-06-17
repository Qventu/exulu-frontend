"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FeedbackChoice } from "./feedback-choice";
import { FeedbackChat } from "./feedback-chat";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

// Inline <sm matchMedia hook. Mirrors useIsMobile's useSyncExternalStore
// pattern so the first post-hydration render is correct (SSR snapshot:
// desktop / false). Out of scope to introduce a shared primitive for this
// single consumer (chat.md U6 mobile / responsive.md V1+V3).
const SM_QUERY = "(max-width: 639px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(SM_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function useIsBelowSm() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(SM_QUERY).matches,
    () => false,
  );
}

export function FeedbackDialog({ open, onOpenChange }: Props) {
  const t = useTranslations();
  const [view, setView] = useState<"choice" | "chat">("choice");
  const [kind, setKind] = useState<"bug" | "feature" | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const isMobile = useIsBelowSm();

  useEffect(() => {
    if (!open) {
      setView("choice");
      setKind(null);
      setSessionId("");
    }
  }, [open]);

  const handleChoice = (k: "bug" | "feature") => {
    setKind(k);
    setSessionId(crypto.randomUUID());
    setView("chat");
  };

  const title =
    view === "choice"
      ? t("feedback.title")
      : kind === "bug"
        ? t("feedback.bugTitle")
        : t("feedback.featureTitle");

  const body =
    view === "choice" ? (
      <FeedbackChoice onSelect={handleChoice} />
    ) : (
      <FeedbackChat
        kind={kind!}
        sessionId={sessionId}
        onBack={() => setView("choice")}
      />
    );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-[100dvh] max-h-[100dvh] w-full flex-col gap-0 rounded-none p-0 pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="shrink-0 px-6 pb-2 pt-6 text-left">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
