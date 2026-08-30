import { getSession } from "next-auth/react";

import { isDemoMode } from "@/lib/demo/flag";

/**
 * Shared plumbing for the REST api modules in lib/api/*.
 *
 * - getUris(): resolves the backend base URL (env var on the server, the
 *   /api/config endpoint in the browser).
 * - getToken(): the next-auth session JWT.
 * - request(): the ONE authenticated JSON request helper shared by the
 *   skills / session-files / budgets domain modules.
 */

export const getUris = async () => {
    // Server-side: use environment variable directly
    if (typeof window === 'undefined') {
        const backend = process.env.BACKEND;
        if (!backend) {
            throw new Error("No backend set.")
        }
        return {
            files: backend,
            base: backend
        }
    }

    // Client-side: fetch from API
    const context = await fetch("/api/config").then(res => res.json());
    if (!context.backend) {
        throw new Error("No backend set.")
    }
    return {
        files: context.backend,
        base: context.backend
    }
}

export const getToken = async () => {
    const session = await getSession()
    // @ts-ignore
    return session?.user?.jwt;
}

/**
 * Authenticated JSON request against the backend. Throws with the backend's
 * `detail` message (falling back to statusText) on non-2xx responses;
 * resolves `null` for 204 No Content.
 */
export const request = async (path: string, method: string, body?: object) => {
    // The guided demo answers GraphQL from fixtures on both transports, but
    // REST was never covered -- these went straight to a backend that is not
    // running and failed with ERR_CONNECTION_REFUSED.
    //
    // It only surfaced once the chat chapters moved onto the product's real
    // route. The demo-only page they used to render on mounted a cut-down
    // provider tree that never reached the session-files or follow-up
    // suggestion calls; the real SessionScreen fires both on mount, and the
    // components waiting on them sit unresolved directly above the composer.
    //
    // Empty rather than a rejection: every caller is an optional enrichment --
    // attachments, suggestions -- and the demo genuinely has none of them. A
    // thrown error would put a failure state on screen for something a visitor
    // was never meant to notice.
    if (isDemoMode()) return null;

    const uris = await getUris();
    const token = await getToken();
    if (!token) throw new Error("No valid session token available.");
    const res = await fetch(`${uris.base}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
        const detail = await res
            .json()
            .then((j) => j.detail ?? res.statusText)
            .catch(() => res.statusText);
        throw new Error(detail);
    }
    if (res.status === 204) return null;
    return res.json();
};
