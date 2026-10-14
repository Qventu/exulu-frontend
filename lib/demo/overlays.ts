import { CONTEXTS } from "./fixtures/contexts";

/**
 * Demo-only German for product surfaces the tour visits.
 *
 * The product renders backend identifiers and developer copy in a few
 * places a prospect sees: context ids as citation labels, tool names as
 * card titles, English status badges, and du-form empty states addressed
 * to the developer who defines contexts in code. None of that belongs in
 * the shared message catalogues (every deployment would carry it), so it
 * lives here and is read through `isDemoMode()` at the call site.
 *
 * Every string is Sie-form and drafted for sign-off (plan 2026-10-14
 * demo-tour-overlays, "Copy for sign-off").
 */

const CONTEXT_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  CONTEXTS.map((c) => [c.id, c.name]),
);

/** "software_documentation_context" → "Software-Dokumentation"; unknown ids are humanised. */
export function contextDisplayName(id: string): string {
  return CONTEXT_DISPLAY_NAMES[id] ?? humanise(id);
}

export const TOOL_LABELS: Record<string, string> = {
  Context_Search: "Wissenssuche",
  Create_Newton_Memory_Item: "Gedächtnis-Eintrag gespeichert",
};

/** The tool card's title: a known label, or the name with underscores spaced. */
export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, " ");
}

export type ToolState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

/** components/ai-elements/tool.tsx hardcodes these in English; the demo shows German. */
export const TOOL_STATUS_LABELS: Record<ToolState, string> = {
  "input-streaming": "Wartet",
  "input-available": "Läuft",
  "approval-requested": "Freigabe erforderlich",
  "approval-responded": "Beantwortet",
  "output-available": "Abgeschlossen",
  "output-error": "Fehler",
  "output-denied": "Abgelehnt",
};

/** The two empty states a Weiter-only visitor meets: struktur.0 and aufnahme.0. */
export const EMPTY_STATES = {
  knowledgeLibrary: {
    title: "Noch keine Wissensbasis angelegt",
    description:
      "Jede Wissensart bekommt ihre eigene Basis mit eigenen Regeln. Im nächsten Schritt werden die ersten angelegt.",
  },
  knowledgeItems: {
    title: "Noch keine Dokumente in dieser Wissensbasis",
    description:
      "Dokumente kommen aus Ihren Ablagen — per Freigabe, Laufwerk oder Anbindung. Im nächsten Schritt läuft die Aufnahme.",
  },
} as const;

/** /data's page header: the product addresses a developer; the tour addresses a buyer. */
export const KNOWLEDGE_LIBRARY = {
  description: "Die Wissensbasen, aus denen Ihre Assistenten antworten.",
  hint: "Jede Basis hat eigene Regeln für Aufnahme, Suche und Zugriff.",
} as const;

function humanise(id: string): string {
  const words = id.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
