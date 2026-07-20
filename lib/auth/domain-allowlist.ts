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
  const allowed = allowedEmailDomainsEnv
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  allowed.push("exulu.com", "qventu.com");
  return allowed.some((domain) => email.endsWith(`@${domain}`));
}
