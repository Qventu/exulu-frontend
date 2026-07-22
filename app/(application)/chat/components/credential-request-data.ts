/**
 * Pure logic for the in-chat credential form (spec — backend repo —
 * docs/superpowers/specs/2026-07-22-tool-credentials-chat-ui-design.md §2).
 * Extracted per the repo's pure-module test convention: detection of auth
 * short-circuit payloads on tool parts, the submitUrl origin rule (§2.3),
 * and submit-response mapping. No React, no fetch.
 */
import type { DynamicToolUIPart } from "ai";

export interface CredentialField {
  name: string;
  label: string;
  type: "text" | "password";
  placeholder?: string;
  help?: string;
}

export interface CredentialRequestPayload {
  provider: string;
  fields: CredentialField[];
  submitUrl: string;
  nonce: string;
}

export interface OauthRequestPayload {
  authorizationUrl: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Auth short-circuits only ever surface on the FINAL tool output. */
export function extractCredentialRequest(
  part: DynamicToolUIPart,
): CredentialRequestPayload | null {
  if (part.state !== "output-available") return null;
  const output = (part as { output?: unknown }).output;
  if (!isRecord(output) || !isRecord(output.credentialRequest)) return null;
  const cr = output.credentialRequest;
  if (
    typeof cr.provider !== "string" ||
    typeof cr.submitUrl !== "string" ||
    typeof cr.nonce !== "string" ||
    !Array.isArray(cr.fields)
  ) {
    return null;
  }
  return cr as unknown as CredentialRequestPayload;
}

export function extractOauthRequest(part: DynamicToolUIPart): OauthRequestPayload | null {
  if (part.state !== "output-available") return null;
  const output = (part as { output?: unknown }).output;
  if (!isRecord(output) || !isRecord(output.oauth)) return null;
  const url = output.oauth.authorizationUrl;
  return typeof url === "string" && url.length > 0 ? { authorizationUrl: url } : null;
}

/**
 * Security rule (spec §2.3): submitUrl arrives via a tool result — model/
 * tool-influenced data. The session JWT and the secrets may only ever be
 * POSTed to the configured backend origin.
 */
export function isAllowedSubmitUrl(
  submitUrl: string,
  configBackend: string | undefined | null,
): boolean {
  if (!configBackend) return false;
  try {
    return new URL(submitUrl).origin === new URL(configBackend).origin;
  } catch {
    return false;
  }
}

export type SubmitOutcome =
  | { kind: "success" }
  | { kind: "expired" }
  | { kind: "error"; message: string };

export function mapSubmitResponse(
  status: number,
  body: { ok?: boolean; error?: string } | null,
): SubmitOutcome {
  if (status === 200 && body?.ok) return { kind: "success" };
  const error = body?.error ?? `HTTP ${status}`;
  if (status === 401 && /expired/i.test(error)) return { kind: "expired" };
  return { kind: "error", message: error };
}

/**
 * Durable submitted-state per tool call (localStorage, the stable-key
 * convention of pre-approved-tool-calls-*). Component-local state alone is
 * not enough: the card can remount mid-stream, and after a refresh the
 * historical part would re-render a stale form over an expired nonce.
 */
const SUBMITTED_KEY_PREFIX = "credential-submitted-";

export function readCredentialSubmitted(toolCallId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SUBMITTED_KEY_PREFIX + toolCallId) === "1";
  } catch {
    return false;
  }
}

export function markCredentialSubmitted(toolCallId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SUBMITTED_KEY_PREFIX + toolCallId, "1");
  } catch {
    // localStorage unavailable — success state simply won't persist.
  }
}
