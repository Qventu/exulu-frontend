import { getToken, getUris, request } from "@/lib/api/client";
import type { SessionFile } from "@/lib/api/session-files";
import { isDemoMode } from "@/lib/demo/flag";

/** A project folder holds at most this many files (backend enforces it). */
export const MAX_PROJECT_FILES = 200;

/** Typed failure the UI can word precisely; everything else stays a plain Error. */
export class ProjectFilesError extends Error {
    constructor(
        public readonly code: "project_full",
        public readonly max: number,
    ) {
        super(`Project file limit of ${max} reached`);
        this.name = "ProjectFilesError";
    }
}

/**
 * The caller may not see this project's files (403), or the project is gone
 * (404). Not a failure to show: the chat simply has no project section then.
 * Kept apart from other errors so a network blip never hides the section.
 */
export class ProjectFilesAccessError extends Error {
    constructor(public readonly status: number) {
        super(`No access to the project's files (${status})`);
        this.name = "ProjectFilesAccessError";
    }
}

export type UploadSignResult =
    | { uploadUrl: string; key: string }
    | { exists: true; lastModified: string };

export interface PromoteResult {
    promoted: { key: string; name: string }[];
    rejected: { key: string; reason: string }[];
    /** Names that already exist in the project. Non-empty means NOTHING was copied. */
    clashes: string[];
}

export const projectFilesApi = {
    /** `canWrite` rides on the listing so the UI needs no second permission call.
     *  403/404 throw ProjectFilesAccessError: the caller treats them as "no
     *  project section". Uses fetch directly because the shared `request`
     *  drops the status. The demo has no project folders, so it answers
     *  like a project the visitor cannot see. */
    list: async (
        projectId: string,
    ): Promise<{ canWrite: boolean; files: SessionFile[] }> => {
        if (isDemoMode()) throw new ProjectFilesAccessError(404);
        const uris = await getUris();
        const token = await getToken();
        if (!token) throw new Error("No valid session token available.");
        const res = await fetch(`${uris.base}/projects/${projectId}/files`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
        if (res.status === 403 || res.status === 404) {
            throw new ProjectFilesAccessError(res.status);
        }
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.detail ?? res.statusText);
        return json;
    },

    /**
     * A name clash is an expected outcome the caller turns into a confirm, so
     * 409 resolves as `{ exists: true }` rather than throwing. Uses fetch
     * directly because the shared `request` drops the error body.
     */
    uploadSign: async (
        projectId: string,
        body: { filename: string; contentType: string; overwrite?: boolean },
    ): Promise<UploadSignResult> => {
        const uris = await getUris();
        const token = await getToken();
        if (!token) throw new Error("No valid session token available.");
        const res = await fetch(
            `${uris.base}/projects/${projectId}/files/upload-sign`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            },
        );
        const json = await res.json().catch(() => ({}));
        if (res.status === 409 && json?.error === "exists") {
            return { exists: true, lastModified: json.lastModified };
        }
        if (res.status === 400 && json?.error === "project_full") {
            throw new ProjectFilesError(
                "project_full",
                json.max ?? MAX_PROJECT_FILES,
            );
        }
        if (!res.ok) throw new Error(json?.detail ?? res.statusText);
        return json;
    },

    delete: async (projectId: string, key: string): Promise<void> => {
        await request(
            `/projects/${projectId}/files?key=${encodeURIComponent(key)}`,
            "DELETE",
        );
    },

    /** 409 (nothing copied, names clash) resolves with the body so the caller
     *  can confirm and retry with `overwrite`; so does a 500 that carries the
     *  per-key `rejected` list. */
    promote: async (
        projectId: string,
        body: { sessionId: string; keys: string[]; overwrite?: boolean },
    ): Promise<PromoteResult> => {
        const uris = await getUris();
        const token = await getToken();
        if (!token) throw new Error("No valid session token available.");
        const res = await fetch(
            `${uris.base}/projects/${projectId}/files/promote`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            },
        );
        const json = await res.json().catch(() => ({}));
        // 409 (clashes) and a 500 where every copy failed both carry the
        // per-key result; only a body without it (`{detail}`) is a plain failure.
        if (!res.ok && !Array.isArray(json?.promoted)) {
            throw new Error(json?.detail ?? res.statusText);
        }
        return json;
    },

    /** Async because the token comes from the session; mirrors sessionFilesApi. */
    previewPdfUrl: async (projectId: string, key: string): Promise<string> => {
        const uris = await getUris();
        const token = await getToken();
        if (!token) throw new Error("No valid session token available.");
        return `${uris.base}/projects/${projectId}/file/preview-pdf?key=${encodeURIComponent(key)}&auth=${encodeURIComponent(token)}`;
    },
};
