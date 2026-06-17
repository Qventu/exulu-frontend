import { getSession } from "next-auth/react";

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
