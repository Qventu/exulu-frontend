import { request } from "@/lib/api/client";

/** Body accepted by `POST /retrieval/trajectories/:ref/feedback` (harness route). */
export interface TrajectoryFeedbackBody {
  positive: boolean;
  message?: string;
}

/**
 * Builds the harness feedback route path for a trajectory ref.
 * The ref is `<agentId>::<uuid>`; `encodeURIComponent` keeps it intact through the single
 * Express `:ref` param (Express auto-decodes), so `::` survives as `%3A%3A`.
 */
export const trajectoryFeedbackPath = (ref: string): string =>
  `/retrieval/trajectories/${encodeURIComponent(ref)}/feedback`;

/**
 * Maps a thumbs score to the route body.
 * - positive (1) → bare `{ positive: true }`: harness fast-path, marks the trajectory
 *   replay-eligible with NO LLM call, so a good rating can never delete/rewrite a strategy.
 * - negative (0) → `{ positive: false, message }`: routed to the feedback-agent to prune/rewrite.
 */
export const buildTrajectoryFeedbackBody = (
  score: 0 | 1,
  message: string,
): TrajectoryFeedbackBody =>
  score === 1 ? { positive: true } : { positive: false, message };

/** POSTs trajectory feedback via the shared authenticated `request` helper. Throws on non-2xx. */
export const postTrajectoryFeedback = (
  ref: string,
  body: TrajectoryFeedbackBody,
): Promise<unknown> => request(trajectoryFeedbackPath(ref), "POST", body);
