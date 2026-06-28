import type { UIMessage } from "ai";

/**
 * Extracts a harness trajectory ref from a single message part, or null.
 *
 * Name-agnostic by design: does NOT match on the tool name (`knowledge_search`), since the
 * retrieval tool may be renamed or moved into the library. Reads any part's `output` (covering
 * `tool-*` and `dynamic-tool` shapes). The harness wraps its payload as `{ result: "<json>" }`;
 * parse that, falling back to treating `output` itself as the payload, then read `trajectoryId`.
 */
export function trajectoryIdFromPart(part: unknown): string | null {
  const output = (part as { output?: unknown } | null | undefined)?.output;
  if (!output || typeof output !== "object") return null;
  let payload: { trajectoryId?: unknown } = output as {
    trajectoryId?: unknown;
  };
  const result = (output as { result?: unknown }).result;
  if (typeof result === "string") {
    try {
      payload = JSON.parse(result);
    } catch {
      return null;
    }
  }
  const id = payload?.trajectoryId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Finds the trajectory ref that fetched the data for a rated answer.
 *
 * Walks backward from the rated message through the whole history (across user messages — late
 * feedback after follow-ups is still valid for the trajectory used in an earlier turn). Returns the
 * first trajectoryId found (closest / most recent); if a single message made several retrieval
 * calls, the latest one within that message wins. Returns null when no part at-or-before the rated
 * message carries a trajectoryId.
 */
export function findTrajectoryRefForFeedback(
  messages: UIMessage[] | undefined,
  ratedMessageId: string,
): string | null {
  if (!messages) return null;
  const idx = messages.findIndex((m) => m.id === ratedMessageId);
  if (idx < 0) return null;
  for (let i = idx; i >= 0; i--) {
    let lastInMessage: string | null = null;
    for (const part of messages[i]?.parts ?? []) {
      const id = trajectoryIdFromPart(part);
      if (id) lastInMessage = id;
    }
    if (lastInMessage) return lastInMessage;
  }
  return null;
}
