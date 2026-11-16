/**
 * Which folder a files component is looking at: one session's, or a project's
 * shared folder. Components take a `scope` and talk to it only through
 * `fileScopeAdapter`, so none of them branches on `kind` for transport.
 */
import {
    projectFilesApi,
    type UploadSignResult,
} from "@/lib/api/project-files";
import { sessionFilesApi, type SessionFile } from "@/lib/api/session-files";

export type FileScope =
    | { kind: "session"; sessionId: string }
    | { kind: "project"; projectId: string; name: string; canWrite: boolean };

export interface FileScopeAdapter {
    /** Writes (upload, delete) allowed. Always true for a session. */
    canWrite: boolean;
    /** Key of the in-memory change bus, unique per folder. */
    changeKey: string;
    list(): Promise<{ files: SessionFile[]; canWrite?: boolean }>;
    uploadSign(body: {
        filename: string;
        contentType: string;
        overwrite?: boolean;
    }): Promise<UploadSignResult>;
    delete(key: string): Promise<unknown>;
    previewPdfUrl(key: string): Promise<string>;
    /**
     * Runs after the bytes reached S3. Sessions push the file into the live
     * sandbox; projects have nothing to do because the backend syncs the
     * project folder at the start of every turn.
     */
    afterUpload?(key: string): Promise<unknown>;
}

export function fileScopeAdapter(scope: FileScope): FileScopeAdapter {
    if (scope.kind === "session") {
        const { sessionId } = scope;
        return {
            canWrite: true,
            changeKey: `session:${sessionId}`,
            list: () => sessionFilesApi.list(sessionId),
            uploadSign: async ({ filename, contentType }) =>
                sessionFilesApi.uploadSign(sessionId, filename, contentType),
            delete: (key) => sessionFilesApi.delete(sessionId, key),
            previewPdfUrl: (key) => sessionFilesApi.previewPdfUrl(sessionId, key),
            afterUpload: (key) => sessionFilesApi.syncToSandbox(sessionId, key),
        };
    }
    const { projectId } = scope;
    return {
        canWrite: scope.canWrite,
        changeKey: `project:${projectId}`,
        list: () => projectFilesApi.list(projectId),
        uploadSign: (body) => projectFilesApi.uploadSign(projectId, body),
        delete: (key) => projectFilesApi.delete(projectId, key),
        previewPdfUrl: (key) => projectFilesApi.previewPdfUrl(projectId, key),
    };
}
