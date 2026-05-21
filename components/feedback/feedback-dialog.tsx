"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FeedbackChoice } from "./feedback-choice";
import { FeedbackChat } from "./feedback-chat";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function FeedbackDialog({ open, onOpenChange }: Props) {
  const t = useTranslations();
  const [view, setView] = useState<"choice" | "chat">("choice");
  const [kind, setKind] = useState<"bug" | "feature" | null>(null);
  const [sessionId, setSessionId] = useState<string>("");

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {view === "choice" ? (
          <FeedbackChoice onSelect={handleChoice} />
        ) : (
          <FeedbackChat
            kind={kind!}
            sessionId={sessionId}
            onBack={() => setView("choice")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
