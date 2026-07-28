/**
 * Pure helpers + types for the email-trigger editor (design §3.1/§8).
 * Client-side pre-validation only — the server re-validates (length cap +
 * safe-regex) on upsertWorkflowEmailTrigger; this module keeps the form
 * honest before the round-trip. Unit-tested in trigger-config.test.ts.
 */

export const FILTER_FIELDS = [
  "from",
  "subject",
  "body",
  "attachment_name",
] as const;
export type FilterField = (typeof FILTER_FIELDS)[number];

export interface EmailTriggerFilterRule {
  field: FilterField;
  pattern: string;
}

export interface EmailTriggerConfig {
  allowed_senders: string[];
  filters: EmailTriggerFilterRule[];
  filtered_run_retention: number;
  rate_limit_per_hour: number;
  sender_rate_limit_per_hour: number;
}

/** workflowTriggers row (Plan-2 WorkflowTrigger SDL). config arrives as JSON. */
export interface WorkflowTriggerRow {
  id: string;
  workflow: string;
  type: string;
  enabled: boolean;
  /** @deprecated replaced by webhook_url + has_webhook */
  address?: string;
  /** Writer-visible webhook URL (null for read-only viewers). */
  webhook_url?: string | null;
  /** True when the trigger has a live webhook secret. */
  has_webhook?: boolean;
  /** True when a signing secret is configured for this trigger. */
  has_signing_secret?: boolean;
  /** ISO timestamp of the last inbound fire, or null. */
  last_fired_at?: string | null;
  config: unknown;
  run_as_user?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_EMAIL_TRIGGER_CONFIG: EmailTriggerConfig = {
  allowed_senders: [],
  filters: [],
  filtered_run_retention: 200,
  rate_limit_per_hour: 60,
  sender_rate_limit_per_hour: 10,
};

/** Server cap (design §8) — mirrored client-side for instant feedback. */
export const MAX_FILTER_PATTERN_LENGTH = 200;

const DOMAIN_PATTERN =
  "[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+";
const EXACT_SENDER_RE = new RegExp(`^[^\\s@*]+@${DOMAIN_PATTERN}$`);
const GLOB_SENDER_RE = new RegExp(`^\\*@${DOMAIN_PATTERN}$`);

/** Allowlist entry: exact address or `*@domain` glob (design §4.4 step 3). */
export function isValidSenderEntry(entry: string): boolean {
  const value = entry.trim().toLowerCase();
  if (value === "") return false;
  if (value.startsWith("*@")) return GLOB_SENDER_RE.test(value);
  return EXACT_SENDER_RE.test(value);
}

export type PatternValidation =
  | { ok: true }
  | { ok: false; reason: "empty" | "too_long" | "invalid" };

export function validateFilterPattern(pattern: string): PatternValidation {
  if (pattern.trim() === "") return { ok: false, reason: "empty" };
  if (pattern.length > MAX_FILTER_PATTERN_LENGTH) {
    return { ok: false, reason: "too_long" };
  }
  try {
    new RegExp(pattern);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true };
}

function clampInt(value: unknown, fallback: number, min: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.round(parsed));
}

/** Which signing-secret sub-view to render. */
export type SigningSecretView = "reveal" | "enabled" | "generate";

/**
 * Picks the signing-secret view. The one-time revealed secret takes precedence
 * over `has_signing_secret`: right after generating, the mutation returns the
 * secret AND a refetch flips `has_signing_secret` to true — without this
 * precedence the reveal is immediately replaced by the scheme-only "enabled"
 * view (the secret flickers then disappears).
 */
export function signingSecretView(
  hasSigningSecret: boolean,
  revealedSecret: string | null,
): SigningSecretView {
  if (revealedSecret) return "reveal";
  if (hasSigningSecret) return "enabled";
  return "generate";
}

/** Defensive parse of the trigger's config JSON into a fully-shaped form model. */
export function normalizeEmailTriggerConfig(
  input: unknown,
): EmailTriggerConfig {
  const raw = (input ?? {}) as Partial<
    Record<keyof EmailTriggerConfig, unknown>
  >;
  const senders = Array.isArray(raw.allowed_senders)
    ? raw.allowed_senders.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim() !== "",
      )
    : [];
  const filters = Array.isArray(raw.filters)
    ? raw.filters.filter((rule): rule is EmailTriggerFilterRule => {
        if (!rule || typeof rule !== "object") return false;
        const candidate = rule as { field?: unknown; pattern?: unknown };
        return (
          typeof candidate.pattern === "string" &&
          (FILTER_FIELDS as readonly string[]).includes(
            candidate.field as string,
          )
        );
      })
    : [];
  return {
    allowed_senders: senders,
    filters,
    filtered_run_retention: clampInt(
      raw.filtered_run_retention,
      DEFAULT_EMAIL_TRIGGER_CONFIG.filtered_run_retention,
      0,
    ),
    rate_limit_per_hour: clampInt(
      raw.rate_limit_per_hour,
      DEFAULT_EMAIL_TRIGGER_CONFIG.rate_limit_per_hour,
      1,
    ),
    sender_rate_limit_per_hour: clampInt(
      raw.sender_rate_limit_per_hour,
      DEFAULT_EMAIL_TRIGGER_CONFIG.sender_rate_limit_per_hour,
      1,
    ),
  };
}
