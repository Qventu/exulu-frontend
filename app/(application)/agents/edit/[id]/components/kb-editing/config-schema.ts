/**
 * config-schema.ts — parse / serialize layer for the "Knowledge base editing"
 * block: the knowledge_base_editor entry in agent.tools (2-entry contract:
 * knowledge_bases json + skip_approval boolean). Mirrors the backend parser in
 * backend/src/templates/tools/kb-editor-config.ts. Never throws — malformed
 * config degrades to "no writable knowledge bases".
 */

import { z } from "zod";

import type { AgentTool } from "@/types/models/agent";

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

export const serializeKbEditingConfig = (config: KbEditingConfig): ToolConfigEntry[] => [
  { name: "knowledge_bases", variable: JSON.stringify(config.knowledgeBases), type: "json" },
  { name: "skip_approval", variable: config.skipApproval ? "true" : "false", type: "boolean" },
];

export const makeKbEditorTool = (config: KbEditingConfig): AgentTool => ({
  id: KB_EDITOR_TOOL_ID,
  type: "function",
  name: "Knowledge base editor",
  config: serializeKbEditingConfig(config) as AgentTool["config"],
});
