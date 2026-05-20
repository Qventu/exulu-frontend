/**
 * File-extension → renderer category for the session files preview pane.
 * Keeps the routing logic out of the preview pane component so it can be
 * tested independently and reused for the file row's icon.
 */
export type PreviewCategory =
    | "text"
    | "code"
    | "image"
    | "pdf"
    | "office"
    | "unknown";

const TEXT_EXTS = new Set([".md", ".txt", ".csv"]);
const CODE_EXTS = new Set([
    ".py",
    ".js",
    ".ts",
    ".tsx",
    ".jsx",
    ".json",
    ".yaml",
    ".yml",
    ".sh",
    ".html",
    ".css",
    ".xml",
    ".toml",
]);
const IMAGE_EXTS = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".svg",
]);
const OFFICE_EXTS = new Set([
    ".docx",
    ".xlsx",
    ".pptx",
    ".odt",
    ".ods",
    ".odp",
]);

export function getPreviewCategory(filename: string): PreviewCategory {
    const dot = filename.lastIndexOf(".");
    if (dot < 0) return "unknown";
    const ext = filename.slice(dot).toLowerCase();
    if (TEXT_EXTS.has(ext)) return "text";
    if (CODE_EXTS.has(ext)) return "code";
    if (IMAGE_EXTS.has(ext)) return "image";
    if (ext === ".pdf") return "pdf";
    if (OFFICE_EXTS.has(ext)) return "office";
    return "unknown";
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatRelativeTime(iso: string): string {
    const date = new Date(iso);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSec = Math.round(diffMs / 1000);
    if (diffSec < 60) return "just now";
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.round(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    return date.toLocaleDateString();
}

/**
 * Reasonable per-file upload cap. Matches the skill-bundle cap; bigger files
 * can use a dedicated upload tool. Enforced client-side; the backend's
 * presigned PUT URL itself doesn't gate by size.
 */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
