/**
 * Next.js server-startup hook (runs once per server boot, nodejs runtime).
 * Warns loudly when the backend hands out presigned S3 URLs on an origin
 * the frontend's CSP does not allow — see lib/csp-consistency.ts.
 */

import { evaluateS3CspConfig } from "./lib/csp-consistency";

const RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 10_000;

async function checkS3CspConfig(): Promise<void> {
    const backend = process.env.BACKEND;
    if (!backend) return;

    // The backend may still be booting when the frontend starts (orchestrated
    // deploys bring both up together), so retry a few times before giving up.
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        try {
            const res = await fetch(`${backend}/config`, {
                signal: AbortSignal.timeout(5_000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const config = await res.json();
            const warning = evaluateS3CspConfig(
                config?.fileUploads?.s3endpoint,
                process.env.COMPANION_S3_ENDPOINT,
            );
            if (warning) {
                console.warn(`\n[EXULU][CSP] ⚠️  MISCONFIGURATION: ${warning}\n`);
            }
            return;
        } catch {
            if (attempt === RETRY_ATTEMPTS) {
                console.warn(
                    `[EXULU][CSP] Could not reach ${backend}/config after ` +
                    `${RETRY_ATTEMPTS} attempts; skipped the COMPANION_S3_ENDPOINT ` +
                    "consistency check.",
                );
                return;
            }
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
    }
}

export async function register() {
    // Only run in the nodejs server runtime (not edge, not the browser).
    if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;
    // Fire and forget — never delay server startup on this check.
    void checkS3CspConfig();
}
