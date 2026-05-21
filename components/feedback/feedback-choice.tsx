"use client";

import { Bug, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  onSelect: (kind: "bug" | "feature") => void;
};

export function FeedbackChoice({ onSelect }: Props) {
  const t = useTranslations();
  return (
    <div className="flex-1 px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-4 content-center">
      <button
        type="button"
        onClick={() => onSelect("feature")}
        className="group flex flex-col items-start gap-3 rounded-lg border bg-card p-6 text-left transition-colors hover:border-primary hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Lightbulb
          className="h-6 w-6 text-primary"
          strokeWidth={1.5}
        />
        <div className="space-y-1">
          <div className="text-lg font-semibold">
            {t("feedback.choiceFeature.title")}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("feedback.choiceFeature.desc")}
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={() => onSelect("bug")}
        className="group flex flex-col items-start gap-3 rounded-lg border bg-card p-6 text-left transition-colors hover:border-primary hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Bug
          className="h-6 w-6 text-primary"
          strokeWidth={1.5}
        />
        <div className="space-y-1">
          <div className="text-lg font-semibold">
            {t("feedback.choiceBug.title")}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("feedback.choiceBug.desc")}
          </p>
        </div>
      </button>
    </div>
  );
}
