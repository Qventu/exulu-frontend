import { getToken, getUris, request } from "@/lib/api/client";

export const skillsApi = {
    /** Create SKILL.md and initialise S3 folder after skillsCreateOne. */
    init: async (skillId: string, name: string, description: string) =>
        request(`/skills/${skillId}/init`, "POST", { name, description }),

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

    /**
     * Download every file in a skill version as a .zip blob (folder structure
     * preserved, plus a version.txt). Lets users take a skill into other tools.
     */
    download: async (skillId: string, version?: number, format?: "zip" | "skill"): Promise<Blob> => {
        const uris = await getUris();
        const token = await getToken();
        if (!token) throw new Error("No valid session token available.");
        const params = new URLSearchParams();
        if (version != null) params.set("version", String(version));
        if (format) params.set("format", format);
        const qs = params.toString();
        const res = await fetch(`${uris.base}/skills/${skillId}/download${qs ? `?${qs}` : ""}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(await res.text());
        return res.blob();
    },

    /** Get a presigned PUT URL for uploading a file at an exact path. */
    sign: async (skillId: string, filePath: string, contentType: string) =>
        request(`/skills/${skillId}/sign`, "POST", { filePath, contentType }),

    /**
     * Get a presigned PUT URL for uploading a skill bundle (zip or single
     * SKILL.md) to a per-user staging area. After Uppy finishes the upload,
     * call `initFromUpload(skillId, stagingKey, isZip)` to extract.
     */
    uploadSign: async (
        skillId: string,
        extension: ".zip" | ".md" | ".skill",
        contentType: string,
    ): Promise<{ uploadUrl: string; stagingKey: string }> =>
        request(`/skills/${skillId}/upload-sign`, "POST", { extension, contentType }),

    /**
     * Extract a previously-staged skill bundle into skills/<skillId>/v1/.
     * Triggered after Uppy reports the staging upload succeeded.
     */
    initFromUpload: async (
        skillId: string,
        stagingKey: string,
        isZip: boolean,
    ): Promise<{ version: number; filesCount: number }> =>
        request(`/skills/${skillId}/init-from-upload`, "POST", { stagingKey, isZip }),

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
        request(`/skills/${skillId}/version`, "POST", { label }),

    /** Rename/move a file within the current version. */
    rename: async (skillId: string, sourceKey: string, destPath: string) =>
        request(`/skills/${skillId}/rename`, "POST", { sourceKey, destPath }),

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
