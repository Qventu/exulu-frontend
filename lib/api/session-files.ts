import { getToken, getUris, request } from "@/lib/api/client";

export interface SessionFile {
    key: string;
    name: string;
    size: number;
    lastModified: string;
    contentType: string;
    presignedUrl: string;
}

/** One key the adopt endpoint copied in. `key` is the DESTINATION key
 *  (inside this session's own prefix) — distinct from a rejection's `key`,
 *  which is the raw string the caller sent (see AdoptRejected). */
export interface AdoptedFile {
    key: string;
    name: string;
}

/** One key the adopt endpoint refused. `key` is the RAW string the caller
 *  sent, unchanged — the identity a caller mapping results back to what it
 *  asked for will recognise, even though it is not what the server would
 *  have copied to. */
export interface AdoptRejected {
    key: string;
    reason: string;
}

export interface AdoptFilesResult {
    adopted: AdoptedFile[];
    rejected: AdoptRejected[];
}

export const sessionFilesApi = {
    /** List files in this session's S3 folder. */
    list: async (sessionId: string): Promise<{ files: SessionFile[] }> =>
        request(`/sessions/${sessionId}/files`, "GET"),

    /**
     * Get a presigned PUT URL for uploading a file into the session's S3
     * folder. After uploading, call syncToSandbox so the agent can see the
     * file on the next turn.
     */
    uploadSign: async (
        sessionId: string,
        filename: string,
        contentType: string,
    ): Promise<{ uploadUrl: string; key: string }> =>
        request(`/sessions/${sessionId}/files/upload-sign`, "POST", {
            filename,
            contentType,
        }),

    /**
     * Push an already-uploaded file into the live skill sandbox so the
     * agent's next readFile / bash sees it without waiting for a restart.
     * No-op if the sandbox isn't currently materialized.
     */
    syncToSandbox: async (
        sessionId: string,
        key: string,
    ): Promise<{ written: boolean; localPath?: string }> =>
        request(`/sessions/${sessionId}/files/sync-to-sandbox`, "POST", {
            key,
        }),

    /**
     * Re-install the session agent's enabled skills into the live sandbox —
     * the skill card's "Reload skills" after a skill was created or updated.
     */
    reloadSkills: async (sessionId: string): Promise<{ refreshed: number; sandbox: boolean }> =>
        request(`/sessions/${sessionId}/skills/reload`, "POST", {}),

    /** Delete a file from the session's S3 folder. */
    delete: async (sessionId: string, key: string): Promise<{ deleted: true }> =>
        request(
            `/sessions/${sessionId}/files?key=${encodeURIComponent(key)}`,
            "DELETE",
        ),

    /**
     * Copy the caller's own already-uploaded S3 objects into this session's
     * file prefix — how an artifact-panel attach (bytes uploaded with the
     * VIEWER's token, not the session's) becomes a session file the agent's
     * sandbox can see. All-or-nothing on the server: a rejected key means
     * NOTHING was copied. `request` throws on the resulting 403/400/500, so a
     * caller only needs to know the adopt failed as a whole — the body's
     * `rejected` detail is for server-side diagnostics, not reconstructed
     * here, since `request`'s generic error path only surfaces `detail`
     * (absent on this endpoint's error bodies) or the status text.
     */
    adopt: async (
        sessionId: string,
        keys: string[],
    ): Promise<AdoptFilesResult> =>
        request(`/sessions/${sessionId}/files/adopt`, "POST", { keys }),

    /**
     * URL the frontend embeds in an <iframe> to preview an Office binary
     * as PDF. The backend renders via LibreOffice on demand, caches by
     * source ETag. Token is appended as a query param so the iframe can
     * load it directly (no JS bearer header).
     */
    previewPdfUrl: async (sessionId: string, key: string): Promise<string> => {
        const uris = await getUris();
        const token = await getToken();
        if (!token) throw new Error("No valid session token available.");
        return `${uris.base}/sessions/${sessionId}/file/preview-pdf?key=${encodeURIComponent(key)}&auth=${encodeURIComponent(token)}`;
    },

    /**
     * Upload a single file directly to S3 via a presigned PUT URL. Returns
     * once S3 acknowledges. Use this from the upload zone after calling
     * uploadSign.
     */
    putToSignedUrl: async (
        uploadUrl: string,
        file: File,
        contentType: string,
    ): Promise<void> => {
        const res = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: file,
        });
        if (!res.ok) {
            throw new Error(`S3 upload failed: ${res.status} ${res.statusText}`);
        }
    },
};
