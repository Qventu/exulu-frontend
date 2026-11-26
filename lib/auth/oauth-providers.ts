/**
 * The external sign-in providers next to password and email code.
 *
 * Microsoft sign-in (Entra ID, the accounts behind Microsoft 365 and Teams)
 * uses next-auth's "azure-ad" provider, so the redirect URI to register is
 * `<FRONTEND>/api/auth/callback/azure-ad`.
 */
export const GOOGLE_PROVIDER_ID = "google";
export const MICROSOFT_PROVIDER_ID = "azure-ad";

const OAUTH_PROVIDER_IDS: readonly string[] = [GOOGLE_PROVIDER_ID, MICROSOFT_PROVIDER_ID];

export const isOAuthProvider = (provider: string | null | undefined): boolean =>
  !!provider && OAUTH_PROVIDER_IDS.includes(provider);

export type MicrosoftSettings = { clientId: string; clientSecret: string; tenantId: string };

/** Tenant values that mean "any organisation" or "any personal account". */
const SHARED_TENANTS = new Set(["common", "organizations", "consumers"]);

/**
 * Microsoft sign-in is on only with a client id, a client secret AND the id
 * of one specific tenant. The first sign-in creates the user, so a shared
 * tenant ("common" - next-auth's default when none is given) would hand an
 * account to anyone with any Microsoft login; and only in a single tenant is
 * the email claim one the organisation's own administrators control.
 */
export const microsoftSettings = (env: Record<string, string | undefined>): MicrosoftSettings | null => {
  const clientId = env.AZURE_AD_CLIENT_ID?.trim();
  const clientSecret = env.AZURE_AD_CLIENT_SECRET?.trim();
  const tenantId = env.AZURE_AD_TENANT_ID?.trim();
  if (!clientId || !clientSecret || !tenantId) return null;
  if (SHARED_TENANTS.has(tenantId.toLowerCase())) return null;
  return { clientId, clientSecret, tenantId };
};

type OAuthProfile = {
  email?: string | null;
  preferred_username?: string | null;
  given_name?: string | null;
  name?: string | null;
} | null | undefined;

/**
 * The address a provider profile identifies. Microsoft leaves the `email`
 * claim out for accounts without a mailbox; `preferred_username` is then the
 * sign-in name, which is an email address for work accounts.
 */
export const oauthEmail = (profile: OAuthProfile): string | null => {
  const email = profile?.email?.trim();
  if (email) return email;
  const username = profile?.preferred_username?.trim();
  return username && username.includes("@") ? username : null;
};

/** Name for a user created on first sign-in. */
export const oauthDisplayName = (profile: OAuthProfile): string =>
  profile?.given_name?.trim() || profile?.name?.trim() || "";
