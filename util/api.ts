import { getSession } from "next-auth/react";

export type ImageStyle = "origami" | "anime" | "japanese_anime" | "vaporwave" | "lego" | "paper_cut" | "felt_puppet" | "3d" | "app_icon" | "pixel_art" | "isometric";

const getUris = async () => {
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

export type BackendConfigType = {
    fileUploads?: {
        s3endpoint: string;
    }
    workers?: {
        redisHost: string;
        enabled: boolean;
    }
}

export type ThemeConfig = {
    light?: Record<string, string>;
    dark?: Record<string, string>;
}

export const config = {
    backend: async (): Promise<Response> => {
        const uris = await getUris();
        const url = `${uris.base}/config`
        return fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        })
    },
    theme: async (): Promise<ThemeConfig> => {
        try {
            const token = await getToken();
            const uris = await getUris();
            const res = await fetch(`${uris.base}/theme`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
            })
            console.log("[EXULU] res", res)
            if (!res.ok) {
                console.error("[EXULU] Error fetching theme config:", res.statusText)
                throw new Error("Failed to fetch theme config.")
            }
            const json = await res.json();
            return json.theme;
        } catch (error) {
            console.error("Error fetching theme config:", error);
            return { light: {}, dark: {} };
        }
    }
}

export const agents = {
    image: {
        generate: async (parameters: {
            name: string,
            description: string,
            style?: ImageStyle
        }): Promise<any> => {

            const uris = await getUris();
            const url = `${uris.base}/generate/agent/image`;
            const token = await getToken()

            if (!token) {
                throw new Error("No valid session token available.")
            }

            return fetch(url, {
                method: "POST",
                body: JSON.stringify(parameters),
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });
        }
    }
}

export type S3FileListOutput = {
    "$metadata": {
        "httpStatusCode": number,
        "attempts": number,
        "totalRetryDelay": number
    },
    "Contents": {
        "Key": string,
        "LastModified": string,
        "ETag": string,
        "Size": number
    }[]
    "IsTruncated": boolean,
    "NextContinuationToken": string,
    "KeyCount": number,
    "MaxKeys": number,
    "Name": string,
    "Prefix": string
}

export type S3ObjectOutput = {
    "$metadata": {
        "httpStatusCode": number,
        "attempts": number,
        "totalRetryDelay": number
    },
    "AcceptRanges": "bytes",
    "LastModified": string,
    "ContentLength": number,
    "ChecksumCRC32C": string,
    "ETag": string,
    "CacheControl": string,
    "ContentType": string,
    "Expires": string,
    "ExpiresString": string
}

export const files = {
    object: async (key: string): Promise<S3ObjectOutput> => {
        const uris = await getUris();
        let url = `${uris.files}/s3/object`;
        const token = await getToken()
        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify({ key }),
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
        return response.json();
    },
    list: async ({ search, continuationToken, global }: { search?: string, continuationToken?: string, global?: boolean }): Promise<S3FileListOutput> => {
        const uris = await getUris();
        let url = `${uris.files}/s3/list`;
        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }

        if (search) {
            url += `?search=${search}`;
        }

        if (continuationToken) {
            url += `?continuationToken=${continuationToken}`;
        }

        console.log("[EXULU] global", global)

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...(global && { Global: "true" }),
            },

        });
        return response.json();
    },
    // Key is the base s3 key of the file
    // if only the key is provided only the
    // user that uploaded the file, a super
    // admin or api user can access and 
    // download the file. If an item ID is
    // provided, the RBAC rights associated
    // with the item are checked and used.
    // The item must be provided as a GID
    // with the context id as the prefix before
    // the first slash.
    download: async (key: string) => {

        const uris = await getUris();
        let url = `${uris.files}/s3/download?key=${encodeURIComponent(key)}`;

        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }

        return fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
    },
    delete: async (key: string) => {

        const uris = await getUris();
        let url = `${uris.files}/s3/delete?key=${key}`;
        const token = await getToken()

        if (!token) {
            throw new Error("No valid session token available.")
        }

        return fetch(url, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
    }
}

// ─── Skills File Management API ───────────────────────────────────────────────

const skillsRequest = async (path: string, method: string, body?: object) => {
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
        const detail = await res.json().then((j) => j.detail ?? res.statusText).catch(() => res.statusText);
        throw new Error(detail);
    }
    return res.json();
};

export const skillsApi = {
    /** Create SKILL.md and initialise S3 folder after skillsCreateOne. */
    init: async (skillId: string, name: string, description: string) =>
        skillsRequest(`/skills/${skillId}/init`, "POST", { name, description }),

    /** Fetch the virtual file tree for a skill version. */
    files: async (skillId: string, version?: number) => {
        const uris = await getUris();
        const token = await getToken();
        if (!token) throw new Error("No valid session token available.");
        const params = version != null ? `?version=${version}` : "";
        const res = await fetch(`${uris.base}/skills/${skillId}/files${params}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    /** Get a presigned PUT URL for uploading a file at an exact path. */
    sign: async (skillId: string, filePath: string, contentType: string) =>
        skillsRequest(`/skills/${skillId}/sign`, "POST", { filePath, contentType }),

    /**
     * Get a presigned PUT URL for uploading a skill bundle (zip or single
     * SKILL.md) to a per-user staging area. After Uppy finishes the upload,
     * call `initFromUpload(skillId, stagingKey, isZip)` to extract.
     */
    uploadSign: async (
        skillId: string,
        extension: ".zip" | ".md",
        contentType: string,
    ): Promise<{ uploadUrl: string; stagingKey: string }> =>
        skillsRequest(`/skills/${skillId}/upload-sign`, "POST", { extension, contentType }),

    /**
     * Extract a previously-staged skill bundle into skills/<skillId>/v1/.
     * Triggered after Uppy reports the staging upload succeeded.
     */
    initFromUpload: async (
        skillId: string,
        stagingKey: string,
        isZip: boolean,
    ): Promise<{ version: number; filesCount: number }> =>
        skillsRequest(`/skills/${skillId}/init-from-upload`, "POST", { stagingKey, isZip }),

    /** Get a presigned GET URL (+ optional inline content) for reading a file. */
    file: async (skillId: string, key: string) => {
        const uris = await getUris();
        const token = await getToken();
        if (!token) throw new Error("No valid session token available.");
        const res = await fetch(
            `${uris.base}/skills/${skillId}/file?key=${encodeURIComponent(key)}`,
            { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<{ url: string; content?: string; key: string }>;
    },

    /** Delete a single file (key) or an entire folder (prefix). */
    deleteFile: async (skillId: string, params: { key?: string; prefix?: string }) => {
        const uris = await getUris();
        const token = await getToken();
        if (!token) throw new Error("No valid session token available.");
        const qs = params.key
            ? `?key=${encodeURIComponent(params.key)}`
            : `?prefix=${encodeURIComponent(params.prefix ?? "")}`;
        const res = await fetch(`${uris.base}/skills/${skillId}/file${qs}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<{ deleted: number }>;
    },

    /** Snapshot the current version into the next version slot. */
    saveVersion: async (skillId: string, label?: string) =>
        skillsRequest(`/skills/${skillId}/version`, "POST", { label }),

    /** Rename/move a file within the current version. */
    rename: async (skillId: string, sourceKey: string, destPath: string) =>
        skillsRequest(`/skills/${skillId}/rename`, "POST", { sourceKey, destPath }),

    /** Compare two versions, returns per-file diffs. */
    diff: async (skillId: string, fromVersion: number, toVersion: number) => {
        const uris = await getUris();
        const token = await getToken();
        if (!token) throw new Error("No valid session token available.");
        const res = await fetch(
            `${uris.base}/skills/${skillId}/diff?fromVersion=${fromVersion}&toVersion=${toVersion}`,
            { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    /** Upload file content directly to S3 via a presigned URL. */
    uploadContent: async (presignedUrl: string, content: string, contentType: string) => {
        const res = await fetch(presignedUrl, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: content,
        });
        if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
    },
};

export interface SessionFile {
    key: string;
    name: string;
    size: number;
    lastModified: string;
    contentType: string;
    presignedUrl: string;
}

/**
 * Generic request helper for /sessions/* routes. Mirrors skillsRequest so
 * error handling, auth, and content-type are consistent across the two
 * REST surfaces.
 */
const sessionsRequest = async (path: string, method: string, body?: object) => {
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
    return res.json();
};

export const sessionFilesApi = {
    /** List files in this session's S3 folder. */
    list: async (sessionId: string): Promise<{ files: SessionFile[] }> =>
        sessionsRequest(`/sessions/${sessionId}/files`, "GET"),

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
        sessionsRequest(`/sessions/${sessionId}/files/upload-sign`, "POST", {
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
        sessionsRequest(`/sessions/${sessionId}/files/sync-to-sandbox`, "POST", {
            key,
        }),

    /** Delete a file from the session's S3 folder. */
    delete: async (sessionId: string, key: string): Promise<{ deleted: true }> => {
        const uris = await getUris();
        const token = await getToken();
        if (!token) throw new Error("No valid session token available.");
        const res = await fetch(
            `${uris.base}/sessions/${sessionId}/files?key=${encodeURIComponent(key)}`,
            {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            },
        );
        if (!res.ok) {
            const detail = await res
                .json()
                .then((j) => j.detail ?? res.statusText)
                .catch(() => res.statusText);
            throw new Error(detail);
        }
        return res.json();
    },

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
