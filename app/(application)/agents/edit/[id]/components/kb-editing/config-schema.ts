/**
 * config-schema.ts — parse layer for the knowledge_base_editor entry in
 * agent.tools (2-entry contract: knowledge_bases json + skip_approval
 * boolean). Mirrors the backend parser in
 * backend/src/templates/tools/kb-editor-config.ts. Never throws — malformed
 * config degrades to "no writable knowledge bases".
 */

import { z } from "zod";

import type { ToolConfigEntry } from "../tool-config-fields";

export const KB_EDITOR_TOOL_ID = "knowledge_base_editor";

export type KbWritePermission = { create: boolean; update: boolean };

export type KbEditingConfig = {
  knowledgeBases: Record<string, KbWritePermission>;
  skipApproval: boolean;
};

const permissionSchema = z.object({
  create: z.boolean().catch(false).default(false),
  update: z.boolean().catch(false).default(false),
});

export const parseKbEditingConfig = (
  entries: ToolConfigEntry[] | undefined,
): KbEditingConfig => {
  const result: KbEditingConfig = { knowledgeBases: {}, skipApproval: false };
  if (!Array.isArray(entries)) return result;

  const byName = new Map(entries.map((e) => [e?.name, e] as const));

  let kbsRaw: unknown = byName.get("knowledge_bases")?.variable;
  if (typeof kbsRaw === "string" && kbsRaw) {
    try {
      kbsRaw = JSON.parse(kbsRaw);
    } catch {
      kbsRaw = {};
    }
  }
  if (kbsRaw && typeof kbsRaw === "object" && !Array.isArray(kbsRaw)) {
    for (const [id, value] of Object.entries(kbsRaw as Record<string, unknown>)) {
      const parsed = permissionSchema.safeParse(value);
      if (parsed.success && (parsed.data.create || parsed.data.update)) {
        result.knowledgeBases[id] = parsed.data;
      }
    }
  }

  const skipRaw = byName.get("skip_approval")?.variable;
  result.skipApproval = skipRaw === true || skipRaw === "true";

  return result;
};

// Writes go through the Tools section's per-entry update path (one config
// entry per call); the enable toggle stages entries from the picker tool's
// declared config. The 2-entry contract (knowledge_bases json + skip_approval
// boolean) is defined by createKbEditorPickerTool in the backend.
