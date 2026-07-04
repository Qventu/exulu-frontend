// REPLACED IN TASK 4
"use client";

import type { WizardConfig } from "../config-schema";

export function RoutingStep(_props: {
  draft: WizardConfig;
  setDraft: (updater: (prev: WizardConfig) => WizardConfig) => void;
  contexts: { id: string; name: string; description?: string }[];
}) {
  return null;
}
