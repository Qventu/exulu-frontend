/**
 * Stored tool credentials for the /settings Connections section (spec —
 * backend repo — 2026-07-22-tool-credentials-chat-ui-design.md §3).
 * Metadata only; values never reach the client. Mirrors the lib/my-usage.ts
 * REST-hook pattern (no react-query in this repo).
 */
import * as React from "react";

import { request } from "@/lib/api/client";

export interface StoredCredential {
  provider: string;
  authType: "oauth" | "user_credentials";
  createdAt: string;
  updatedAt: string;
}

export function parseCredentialsResponse(json: unknown): StoredCredential[] {
  if (
    !json ||
    typeof json !== "object" ||
    !Array.isArray((json as { credentials?: unknown }).credentials)
  ) {
    return [];
  }
  return (json as { credentials: StoredCredential[] }).credentials;
}

export const credentialsApi = {
  list: async (): Promise<StoredCredential[]> =>
    parseCredentialsResponse(await request("/credentials", "GET")),
  remove: async (provider: string): Promise<void> => {
    await request(`/credentials/${encodeURIComponent(provider)}`, "DELETE");
  },
};

export interface UseStoredCredentialsResult {
  data: StoredCredential[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useStoredCredentials(): UseStoredCredentialsResult {
  const [data, setData] = React.useState<StoredCredential[] | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const list = await credentialsApi.list();
        if (cancelled) return;
        setData(list);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const refetch = React.useCallback(() => setTick((n) => n + 1), []);

  return { data, loading, error, refetch };
}
