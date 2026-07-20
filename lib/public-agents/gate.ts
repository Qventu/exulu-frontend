export type PublicAgentAuthMode = "public" | "password" | "regular";

export type GateDecision =
  | "chat-anonymous"
  | "password-gate"
  | "auth-redirect"
  | "chat-authenticated";

/**
 * Server-side gate for /public/agents/[id] (spec §5.1). Persistent sessions
 * exist ONLY in regular (login) mode; public/password chat is ephemeral for
 * everyone, signed-in or not.
 */
export function decideGate(
  mode: PublicAgentAuthMode,
  hasPasswordCookie: boolean,
  isAuthenticated: boolean,
): GateDecision {
  if (mode === "password") {
    return hasPasswordCookie ? "chat-anonymous" : "password-gate";
  }
  if (mode === "regular") {
    return isAuthenticated ? "chat-authenticated" : "auth-redirect";
  }
  return "chat-anonymous";
}
