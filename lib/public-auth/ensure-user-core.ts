const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EnsureUserValidation =
  | { ok: true; email: string; password: string | null }
  | { ok: false; status: number; error: string };

/** Validates/normalizes the ensure-user body (spec §4.2). Pure. */
export function validateEnsureUserInput(body: unknown): EnsureUserValidation {
  const b = body as { email?: unknown; password?: unknown } | null;
  const rawEmail = typeof b?.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!rawEmail || !EMAIL_RE.test(rawEmail)) {
    return { ok: false, status: 400, error: "A valid email is required." };
  }
  if (b?.password !== undefined && b?.password !== null) {
    if (typeof b.password !== "string" || b.password.length < 8) {
      return { ok: false, status: 400, error: "Password must be at least 8 characters." };
    }
    return { ok: true, email: rawEmail, password: b.password };
  }
  return { ok: true, email: rawEmail, password: null };
}
