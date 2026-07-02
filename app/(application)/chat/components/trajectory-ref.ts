import type { UIMessage } from "ai";

export interface TrajectoryReuse {
  matchedRef: string;
  matchedQuery?: string;
  matchedAt?: string;
}

/**
 * Resolve a tool part's harness payload object. `output.result` may be an already-parsed object
 * (live client) or a JSON string (DB round-trip); trajectory fields may also sit directly on
 * `output`. Name-agnostic: never matches on the tool name. Returns null when there is no payload.
 */
function resolveResultPayload(part: unknown): Record<string, unknown> | null {
  const output = (part as { output?: unknown } | null | undefined)?.output;
  if (!output || typeof output !== "object") return null;
  const result = (output as { result?: unknown }).result;
  if (typeof result === "string") {
    try {
      return JSON.parse(result) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (result && typeof result === "object") return result as Record<string, unknown>;
  return output as Record<string, unknown>;
}

/** The trajectory saved for this run (present on non-replay answers), or null. */
export function trajectoryIdFromPart(part: unknown): string | null {
  const id = resolveResultPayload(part)?.trajectoryId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** The proven trajectory this answer reused (present only on replay), or null. */
export function trajectoryReuseFromPart(part: unknown): TrajectoryReuse | null {
  const reuse = resolveResultPayload(part)?.reuse as Partial<TrajectoryReuse> | undefined;
  const ref = reuse?.matchedRef;
  if (typeof ref !== "string" || ref.length === 0) return null;
  return {
    matchedRef: ref,
    matchedQuery: typeof reuse?.matchedQuery === "string" ? reuse.matchedQuery : undefined,
    matchedAt: typeof reuse?.matchedAt === "string" ? reuse.matchedAt : undefined,
  };
}

/**
 * The feedback target for a part: the reused (proven) trajectory if this answer replayed one,
 * otherwise the run's own saved trajectory.
 */
function trajectoryFeedbackRefFromPart(part: unknown): string | null {
  return trajectoryReuseFromPart(part)?.matchedRef ?? trajectoryIdFromPart(part);
}

/**
 * Finds the trajectory ref to send feedback to for a rated answer. Walks backward from the rated
 * message through the whole history (late feedback after follow-ups still applies to the trajectory
 * that fetched the data). Returns the first ref found; the latest within a message wins.
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
      const ref = trajectoryFeedbackRefFromPart(part);
      if (ref) lastInMessage = ref;
    }
    if (lastInMessage) return lastInMessage;
  }
  return null;
}

/** Reuse info for a single message (drives the organic indicator), or null. Latest part wins. */
export function trajectoryReuseFromMessage(message: UIMessage | undefined): TrajectoryReuse | null {
  let found: TrajectoryReuse | null = null;
  for (const part of message?.parts ?? []) {
    const reuse = trajectoryReuseFromPart(part);
    if (reuse) found = reuse;
  }
  return found;
}
