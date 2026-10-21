/** Above these thresholds the import runs server-side instead of in the browser. */
export const IMPORT_CLIENT_MAX_ROWS = 200;
export const IMPORT_CLIENT_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Rows the wizard peeks at for mapping and the read-only review preview of a
 * server-side import. Deliberately larger than `IMPORT_CLIENT_MAX_ROWS`, so a
 * file that stays in the browser is always sampled in full and the client
 * flow keeps working off the complete parse.
 */
export const IMPORT_SAMPLE_ROWS = 500;

export type ImportMode = "client" | "server" | "unavailable";

/**
 * Picks where an import should run. Small files stay in the browser; larger
 * ones need the server-side worker queue, which may not be provisioned for
 * this backend — in that case the import can't proceed at all.
 */
export function decideImportMode(input: {
  rows: number;
  bytes: number;
  serverAvailable: boolean;
}): ImportMode {
  const needsServer =
    input.rows > IMPORT_CLIENT_MAX_ROWS ||
    input.bytes > IMPORT_CLIENT_MAX_BYTES;
  if (!needsServer) return "client";
  return input.serverAvailable ? "server" : "unavailable";
}

/**
 * Whether this backend is entitled to and provisioned for server-side
 * imports. Mirrors `BackendConfigType` (`lib/api/config.ts`) structurally so
 * tests can pass plain objects.
 */
export function serverImportAvailable(
  config:
    | {
        entitlements?: Record<string, boolean>;
        workers?: { enabled?: boolean; redisHost?: string };
      }
    | null
    | undefined,
): boolean {
  return (
    config?.entitlements?.queues === true &&
    config?.workers?.enabled === true &&
    !!config?.workers?.redisHost
  );
}
