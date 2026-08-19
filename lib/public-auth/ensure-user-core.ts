const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EnsureUserValidation =
  | {
      ok: true;
      email: string;
      password: string | null;
      firstname: string;
      lastname: string;
      marketingConsent: boolean;
      consentVersion: string;
      source: string;
    }
  | { ok: false; status: number; error: string };

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Validates/normalizes the ensure-user body (spec §4.2, extended for lead
 * capture per lead-capture spec §6). Pure.
 *
 * Two callers with different shapes:
 *   - the EU AI Act chatbot sends names and consent flags,
 *   - the Exulu public-agents pages send only email (+ optional password).
 * The lead fields are therefore optional in the type system and only enforced
 * once `processing_consent` appears. Requiring them unconditionally would
 * break the public-agents login, which this change does not touch.
 */
export function validateEnsureUserInput(body: unknown): EnsureUserValidation {
  const b = body as Record<string, unknown> | null;

  const rawEmail = str(b?.email).toLowerCase();
  if (!rawEmail || !EMAIL_RE.test(rawEmail)) {
    return { ok: false, status: 400, error: "A valid email is required." };
  }

  let password: string | null = null;
  if (b?.password !== undefined && b?.password !== null) {
    if (typeof b.password !== "string" || b.password.length < 8) {
      return {
        ok: false,
        status: 400,
        error: "Password must be at least 8 characters.",
      };
    }
    password = b.password;
  }

  // Lead-capture shape: recognised by the presence of the processing-consent
  // key. Its absence means the legacy caller, which stores no lead data.
  const istLead = b !== null && "processing_consent" in b;

  if (!istLead) {
    return {
      ok: true,
      email: rawEmail,
      password,
      firstname: "",
      lastname: "",
      marketingConsent: false,
      consentVersion: "",
      source: "",
    };
  }

  if (b?.processing_consent !== true) {
    // Not a formality: without this consent there is no lawful basis to store
    // the row at all.
    return {
      ok: false,
      status: 400,
      error: "Consent to processing is required.",
    };
  }

  const firstname = str(b?.firstname);
  const lastname = str(b?.lastname);
  if (!firstname || !lastname) {
    return { ok: false, status: 400, error: "First and last name are required." };
  }

  return {
    ok: true,
    email: rawEmail,
    password,
    firstname,
    lastname,
    marketingConsent: b?.marketing_consent === true,
    consentVersion: str(b?.consent_version),
    source: str(b?.source),
  };
}
