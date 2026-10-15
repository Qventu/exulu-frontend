import { describe, expect, it } from "vitest";

import { CONTEXTS } from "./fixtures/contexts";
import {
  contextDisplayName,
  EMPTY_STATES,
  KNOWLEDGE_LIBRARY,
  SEARCHING_LABEL,
  TOOL_STATUS_LABELS,
  toolLabel,
} from "./overlays";

describe("contextDisplayName", () => {
  it("returns the fixture's German name for every demo context", () => {
    for (const c of CONTEXTS) expect(contextDisplayName(c.id)).toBe(c.name);
    expect(contextDisplayName("software_documentation_context")).toBe("Software-Dokumentation");
  });

  it("humanises an id it does not know instead of leaking underscores", () => {
    expect(contextDisplayName("some_other_context")).toBe("Some other context");
  });
});

describe("toolLabel", () => {
  it("names the two tools the tour shows", () => {
    expect(toolLabel("Context_Search")).toBe("Wissenssuche");
    expect(toolLabel("Create_Newton_Memory_Item")).toBe("Gedächtnis-Eintrag gespeichert");
  });

  it("names the two tools chapter 9's stored session shows", () => {
    expect(toolLabel("Send_Email_Reply")).toBe("E-Mail-Versand");
    expect(toolLabel("Create_Agent_Memory_Memory_Item")).toBe("Gedächtnis-Eintrag gespeichert");
  });

  it("humanises an unknown tool name", () => {
    expect(toolLabel("Send_Email")).toBe("Send Email");
  });
});

describe("the German tables", () => {
  const sie = (s: string) => !/\b(du|dein|deine|deinem|deinen|deiner)\b/i.test(s);

  it("cover every tool state", () => {
    expect(Object.keys(TOOL_STATUS_LABELS).sort()).toEqual([
      "approval-requested", "approval-responded", "input-available", "input-streaming",
      "output-available", "output-denied", "output-error",
    ]);
  });

  it("are Sie-form, non-empty, and end empty-state descriptions with a sentence", () => {
    for (const s of Object.values(TOOL_STATUS_LABELS)) { expect(s).toBeTruthy(); expect(sie(s)).toBe(true); }
    for (const e of Object.values(EMPTY_STATES)) {
      expect(e.title).toBeTruthy();
      expect(e.description.trim().endsWith(".")).toBe(true);
      expect(sie(e.title) && sie(e.description)).toBe(true);
    }
    expect(sie(KNOWLEDGE_LIBRARY.description) && sie(KNOWLEDGE_LIBRARY.hint)).toBe(true);
  });
});

describe("SEARCHING_LABEL", () => {
  it("is a German, Sie-form phrase ending in an ellipsis", () => {
    expect(SEARCHING_LABEL).toMatch(/^Durchsucht .* …$/);
    expect(SEARCHING_LABEL).not.toMatch(/\b(du|dein)\b/i);
  });
});
