/**
 * Parses ALLOWED_EMAIL_DOMAINS into the workforce domain list. Shared by both
 * predicates below so "which domains are internal?" has exactly one answer.
 */
function workforceDomains(allowedEmailDomainsEnv: string): string[] {
  const allowed = allowedEmailDomainsEnv
    .split(",")
    // Lowercase each domain so a cased env value (e.g. "Acme.COM") still matches
    // the already-lowercased email suffix below.
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  allowed.push("exulu.com", "qventu.com");
  return allowed;
}

/**
 * The workforce email-domain allowlist (ALLOWED_EMAIL_DOMAINS). Self-registered
 * external users are exempt — the allowlist governs internal accounts only
 * (public-agents spec §4.3). Called from the next-auth signIn callback AFTER
 * the existing-user lookup so the caller can pass the user's type.
 */
export function isEmailDomainAllowed(
  email: string,
  allowedEmailDomainsEnv: string | undefined,
  existingUserType: string | null | undefined,
): boolean {
  if (!allowedEmailDomainsEnv) return true;
  if (existingUserType === "external") return true;
  return workforceDomains(allowedEmailDomainsEnv).some((domain) =>
    email.toLowerCase().endsWith(`@${domain}`),
  );
}

/**
 * True when the address belongs to a workforce domain, i.e. it identifies
 * someone who signs in through the internal /login rather than public signup.
 *
 * Public registration must refuse these addresses. A `type='external'` row is
 * not a harmless duplicate: `serverSideAuthCheck` resolves users by email
 * alone, and `app/(application)/layout.tsx` bounces every external user out of
 * the internal shell. So one external row minted for a colleague's work
 * address permanently shadows their internal account — they get redirected to
 * /public/agents forever, including via Google SSO, with no self-service way
 * out. That is precisely how daniel@qventu.com locked itself out.
 *
 * Deliberately NOT the negation of isEmailDomainAllowed: an unset env means
 * "no domain policy" there (everything allowed), whereas here it must mean
 * "no domain is reserved" (nothing blocked). Negating it would reject every
 * public registration on installs that never set the variable.
 */
export function isWorkforceEmail(
  email: string,
  allowedEmailDomainsEnv: string | undefined,
): boolean {
  if (!allowedEmailDomainsEnv) return false;
  const normalized = email.trim().toLowerCase();
  return workforceDomains(allowedEmailDomainsEnv).some((domain) =>
    normalized.endsWith(`@${domain}`),
  );
}
