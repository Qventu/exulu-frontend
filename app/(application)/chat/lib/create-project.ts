import type { UIMessage } from "ai";

export const CREATE_PROJECT_PART_TYPE = "tool-create_project";

const PROJECT_LINK = /\/projects\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(?![0-9a-z-])/i;

/**
 * toolCallIds of create_project calls that have finished successfully: final
 * (not preliminary) output-available. Errors and denials are not included.
 */
export function createProjectCallIds(messages: UIMessage[]): string[] {
  const ids: string[] = [];
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      const p = part as { type?: string; state?: string; preliminary?: boolean; toolCallId?: string };
      if (p.type !== CREATE_PROJECT_PART_TYPE) continue;
      if (p.state !== "output-available" || p.preliminary) continue;
      if (typeof p.toolCallId === "string") ids.push(p.toolCallId);
    }
  }
  return ids;
}

/** What the approval card shows: the project's name and the files to move. */
export function describeCreateProjectInput(input: unknown): { name: string; files: string[] } {
  const rec = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const name = typeof rec.name === "string" ? rec.name : "";
  const files = Array.isArray(rec.files) ? rec.files.filter((f): f is string => typeof f === "string") : [];
  return { name, files };
}

/** The project id of the relative `/projects/<id>` link inside a create_project output, if any. */
export function projectIdOf(output: unknown): string | null {
  const text =
    typeof output === "string"
      ? output
      : output && typeof output === "object" && typeof (output as { result?: unknown }).result === "string"
        ? (output as { result: string }).result
        : "";
  return text.match(PROJECT_LINK)?.[1] ?? null;
}
