import { describe, expect, it } from "vitest";
import {
  MICROSOFT_PROVIDER_ID,
  isOAuthProvider,
  microsoftSettings,
  oauthDisplayName,
  oauthEmail,
} from "@/lib/auth/oauth-providers";

describe("microsoftSettings", () => {
  const full = {
    AZURE_AD_CLIENT_ID: "client",
    AZURE_AD_CLIENT_SECRET: "secret",
    AZURE_AD_TENANT_ID: "11111111-2222-3333-4444-555555555555",
  };

  it("returns the settings when client, secret and tenant are all set", () => {
    expect(microsoftSettings(full)).toEqual({
      clientId: "client",
      clientSecret: "secret",
      tenantId: "11111111-2222-3333-4444-555555555555",
    });
  });

  it.each(["AZURE_AD_CLIENT_ID", "AZURE_AD_CLIENT_SECRET", "AZURE_AD_TENANT_ID"])(
    "is off when %s is missing or blank",
    (key) => {
      expect(microsoftSettings({ ...full, [key]: undefined })).toBeNull();
      expect(microsoftSettings({ ...full, [key]: "  " })).toBeNull();
    },
  );

  it.each(["common", "organizations", "consumers", "Common"])(
    "is off for the shared tenant %s, which would admit accounts of any organisation",
    (tenant) => {
      expect(microsoftSettings({ ...full, AZURE_AD_TENANT_ID: tenant })).toBeNull();
    },
  );
});

describe("isOAuthProvider", () => {
  it("knows Google and Microsoft and nothing else", () => {
    expect(isOAuthProvider("google")).toBe(true);
    expect(isOAuthProvider(MICROSOFT_PROVIDER_ID)).toBe(true);
    expect(isOAuthProvider("credentials")).toBe(false);
    expect(isOAuthProvider("email")).toBe(false);
    expect(isOAuthProvider(undefined)).toBe(false);
  });
});

describe("oauthEmail", () => {
  it("uses the email claim", () => {
    expect(oauthEmail({ email: "Anna@Acme.com", preferred_username: "a.b@acme.onmicrosoft.com" })).toBe("Anna@Acme.com");
  });
  it("falls back to the sign-in name when Microsoft sends no email claim", () => {
    expect(oauthEmail({ preferred_username: "anna@acme.com" })).toBe("anna@acme.com");
  });
  it("returns null when neither is an email address", () => {
    expect(oauthEmail({ preferred_username: "anna" })).toBeNull();
    expect(oauthEmail({})).toBeNull();
    expect(oauthEmail(undefined)).toBeNull();
  });
});

describe("oauthDisplayName", () => {
  it("prefers the given name and falls back to the full name", () => {
    expect(oauthDisplayName({ given_name: "Anna", name: "Anna Beispiel" })).toBe("Anna");
    expect(oauthDisplayName({ name: "Anna Beispiel" })).toBe("Anna Beispiel");
    expect(oauthDisplayName({})).toBe("");
  });
});
