/**
 * Attach the chat's pre-approved tool list to an outgoing request body.
 *
 * Why this exists, because the bug it fixes is invisible from the call site:
 * the server decides `needsApproval` once per request, from the `approvedTools`
 * it receives, and freezes that decision for every step of the turn. The chat
 * hook reads the list from localStorage only in `sendMessage` and in the
 * question_ask answer path — but after the user answers an approval prompt the
 * AI SDK re-submits **by itself** (`sendAutomaticallyWhen:
 * lastAssistantMessageIsCompleteWithApprovalResponses`) with no body override.
 * The list is therefore absent from exactly the requests that follow a click on
 * "Allow for this chat", the server re-gates every tool, and the next step asks
 * again — which is what a user experiences as the button doing nothing.
 *
 * Calling this from `prepareSendMessagesRequest` fixes it where it cannot be
 * missed: that callback runs for *every* request the transport makes, automatic
 * resumes included.
 *
 * Two deliberate non-behaviours:
 *  - a list the caller already supplied is never overwritten; `sendMessage`
 *    reads storage itself and its value is authoritative for that request;
 *  - an explicitly empty list is a decision ("nothing is pre-approved", e.g.
 *    after a revoke), not a gap, so it is left alone rather than refilled.
 */
export function withApprovedTools(
  body: Record<string, unknown> | undefined,
  sessionId: string | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(body ?? {}) };
  if (!sessionId) return out;
  if ("approvedTools" in out) return out;

  try {
    const raw = window.localStorage.getItem(`pre-approved-tool-calls-${sessionId}`);
    if (!raw) return out;
    const parsed: unknown = JSON.parse(raw);
    // Only a non-empty array is worth sending; anything else (a corrupt value,
    // an empty list) leaves the request as it was. A throw here would cost the
    // user their message, where a missing list only costs another prompt.
    if (Array.isArray(parsed) && parsed.length > 0) out.approvedTools = raw;
  } catch {
    return out;
  }
  return out;
}
