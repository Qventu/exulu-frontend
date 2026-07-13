/**
 * Startup consistency check between the backend's S3 configuration and the
 * frontend's COMPANION_S3_ENDPOINT. The CSP built in proxy.ts only allows
 * connect-src/img-src/frame-src to the origin from COMPANION_S3_ENDPOINT —
 * if that var is missing (or points elsewhere) while the backend hands out
 * presigned S3 URLs, every browser upload is silently blocked by CSP and
 * file previews break. This misconfiguration has bitten a production
 * deployment before, so instrumentation.ts surfaces it loudly at boot.
 */

function origin(url: string | undefined): string | null {
    if (!url) return null;
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
}

/**
 * Pure comparison of the backend's configured S3 endpoint vs the frontend's
 * COMPANION_S3_ENDPOINT. Returns a warning message, or null if consistent.
 */
export function evaluateS3CspConfig(
    backendS3Endpoint: string | undefined,
    frontendS3Endpoint: string | undefined,
): string | null {
    const backendOrigin = origin(backendS3Endpoint);
    // Backend has no S3 uploads configured — nothing the CSP needs to allow.
    if (!backendOrigin) return null;

    const frontendOrigin = origin(frontendS3Endpoint);
    if (!frontendOrigin) {
        return (
            `The backend serves presigned S3 upload URLs on ${backendOrigin}, ` +
            "but COMPANION_S3_ENDPOINT is not set in the frontend environment. " +
            "The Content-Security-Policy will not include that origin, so the " +
            "browser will block every file upload (connect-src) and file " +
            `preview (img-src/frame-src). Set COMPANION_S3_ENDPOINT=${backendOrigin} ` +
            "in the frontend environment and restart."
        );
    }
    if (frontendOrigin !== backendOrigin) {
        return (
            `COMPANION_S3_ENDPOINT resolves to ${frontendOrigin}, but the ` +
            `backend serves presigned S3 URLs on ${backendOrigin}. The ` +
            "Content-Security-Policy allows the wrong origin, so browser " +
            "uploads and file previews will be blocked. Align " +
            "COMPANION_S3_ENDPOINT with the backend's COMPANION_S3_ENDPOINT."
        );
    }
    return null;
}
