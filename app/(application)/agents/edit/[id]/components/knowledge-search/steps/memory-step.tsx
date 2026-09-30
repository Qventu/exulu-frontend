"use client";

/**
 * MemoryStep — now a pointer, not a config surface. Memory settings (the
 * agent-level recall switch, per-answer limit, sharing rules, and the three
 * knowledge-search memory toggles this step used to own) moved to the
 * Knowledge & memory section's memory base card (Task 14, memory-section.tsx).
 * "memory" stays in WIZARD_STEPS so `?wizard=memory` deep links still resolve
 * — they just land here, with a button back to the real controls.
 */

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export function MemoryStep({ onOpenSection }: { onOpenSection: () => void }) {
  const t = useTranslations("agents");
  return (
    <div className="space-y-2 rounded-md border p-4">
      <p className="text-sm">{t("editor.memory.wizardMoved")}</p>
      <Button variant="outline" size="sm" onClick={onOpenSection}>
        {t("editor.memory.wizardOpen")}
      </Button>
    </div>
  );
}
