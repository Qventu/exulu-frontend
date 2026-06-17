"use client";

/**
 * Data hook for /token — token acquisition is unchanged (keys-token.md ladder
 * row 24: next-auth session JWT via lib/api/client#getToken), plus the
 * client-side `exp` decode that powers the expiry chip (fixes U12).
 */

import { useSession } from "next-auth/react";
import * as React from "react";

import { getToken } from "@/lib/api/client";

/** Minimal base64url JWT payload decode — no jwt lib needed. */
export function decodeJwtExpiry(token: string): Date | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(normalized));
    return typeof claims.exp === "number" ? new Date(claims.exp * 1000) : null;
  } catch {
    return null;
  }
}

/**
 * Expiry of an EXISTING token only. The no-token case ("Unavailable",
 * keys-token.md ladder row 27) is deliberately not a chip state: when there
 * is no token the whole card is replaced by the EmptyState error variant
 * (token-view), which carries that red signal — a chip for it could never
 * render and would be dead code.
 */
export type TokenExpiryState =
  | { kind: "noExpiry" }
  | { kind: "expired" }
  | { kind: "soon"; minutes: number }
  | { kind: "ok"; hours: number };

export function usePersonalToken() {
  const { status } = useSession();
  const [token, setToken] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    const fetchToken = async () => {
      if (status === "authenticated") {
        try {
          const currentToken = await getToken();
          if (!cancelled) setToken(currentToken ?? null);
        } catch (error) {
          console.error("Failed to get token:", error);
          if (!cancelled) setToken(null);
        }
      }
      if (status !== "loading" && !cancelled) setLoading(false);
    };
    fetchToken();
    return () => {
      cancelled = true;
    };
  }, [status]);

  // Re-evaluate the expiry once a minute so the chip stays honest without a
  // visibly ticking countdown (keys-token.md §3 motion: the chip is static).
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const expiresAt = React.useMemo(
    () => (token ? decodeJwtExpiry(token) : null),
    [token],
  );

  const expiry = React.useMemo<TokenExpiryState>(() => {
    if (!expiresAt) return { kind: "noExpiry" };
    const remainingMs = expiresAt.getTime() - now;
    if (remainingMs <= 0) return { kind: "expired" };
    if (remainingMs < 60 * 60 * 1000) {
      return { kind: "soon", minutes: Math.max(1, Math.ceil(remainingMs / 60_000)) };
    }
    return { kind: "ok", hours: Math.round(remainingMs / 3_600_000) };
  }, [expiresAt, now]);

  return { status, token, loading, expiry };
}
