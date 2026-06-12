/**
 * Shared editor section prop contract (work-item contracts §4).
 * Each file in edit/[id]/sections/ exports one component receiving these.
 */

import type { Agent } from "@/types/models/agent";

import type {
  useAgentEditor,
  useEditorReferenceData,
} from "../hooks";

export interface EditorSectionProps {
  agent: Agent;
  editor: ReturnType<typeof useAgentEditor>;
  refs: ReturnType<typeof useEditorReferenceData>;
}
