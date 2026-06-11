import { getToken, getUris, request } from "@/lib/api/client";

export interface SessionFile {
    key: string;
    name: string;
    size: number;
    lastModified: string;
    contentType: string;
    presignedUrl: string;
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

    /** Delete a file from the session's S3 folder. */
    delete: async (sessionId: string, key: string): Promise<{ deleted: true }> =>
        request(
            `/sessions/${sessionId}/files?key=${encodeURIComponent(key)}`,
            "DELETE",
        ),

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
