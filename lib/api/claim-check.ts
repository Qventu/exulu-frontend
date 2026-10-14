// Client for the claim-check endpoints (spec §4). The chat posts a finished
// answer together with the sources it already holds and gets back per-claim
// verdicts; the session route rehydrates panels after a reload.
import { request } from "@/lib/api/client";

export type ClaimCheckSource = { id: string; name?: string; content: string };

export type ClaimVerdict = "supported" | "contradicted" | "unsupported";
export type ScoreLabel = "ok" | "warn" | "alert" | "n/a";
export type SentenceState = "checked" | "no_verifiable_content" | "cannot_disambiguate" | "not_checked";

export type ClaimCheckClaim = {
  id: string;
  sentenceIndex: number;
  text: string;
  inferred: boolean;
  verdict: ClaimVerdict;
  evidence: { sourceId: string; quote: string }[];
  rationale: string;
  rechecked: boolean;
};

export type ClaimCheckSentence = {
  index: number;
  start: number;
  end: number;
  state: SentenceState;
  reason?: string;
  claimIds: string[];
};

export type ClaimCheckResult = {
  status: "ok" | "partial";
  score: {
    claims: number;
    supported: number;
    contradicted: number;
    unsupported: number;
    unsupportedShare: number;
    label: ScoreLabel;
  };
  sentences: ClaimCheckSentence[];
  claims: ClaimCheckClaim[];
  usage: { calls: number; inputTokens: number; outputTokens: number };
  timings: Record<string, number>;
  limits: { truncated: boolean; sentencesSkipped: number };
  notes: string[];
};

export type ClaimCheckRequest = {
  question: string;
  answer: string;
  sources: ClaimCheckSource[];
  agent?: string;
  session?: string;
  messageId?: string;
  locale?: string;
};

export const CLAIM_CHECK_PATH = "/claims/check";

/** Runs a check. Throws on a non-2xx so the caller can show a failed state. */
export const postClaimCheck = (body: ClaimCheckRequest): Promise<ClaimCheckResult> =>
  request(CLAIM_CHECK_PATH, "POST", body) as Promise<ClaimCheckResult>;

/**
 * Stored checks for a session, keyed by message id.
 *
 * Resolves to an empty map on failure rather than throwing: the route is
 * licence-gated and scoped to the caller (404 unlicensed, 400 malformed
 * session), and a panel that cannot be rehydrated is a missing convenience,
 * not an error worth breaking the session's load over.
 */
export async function getSessionClaimChecks(session: string): Promise<Record<string, ClaimCheckResult>> {
  try {
    const res = (await request(`${CLAIM_CHECK_PATH}/${session}`, "GET")) as
      | { checks?: Record<string, ClaimCheckResult> }
      | undefined;
    return res?.checks ?? {};
  } catch {
    return {};
  }
}
