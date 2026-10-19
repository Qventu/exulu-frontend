/**
 * What kind of thing a shared artifact is, read from its file name and the
 * stored content type — the badge and icon on the Artifacts page, and
 * whether the viewer can show it inline (HTML apps in the sandboxed frame,
 * PDFs and images in an iframe) or has to offer a download.
 */

export type ArtifactKind =
  | "app"
  | "pdf"
  | "slides"
  | "sheet"
  | "document"
  | "image"
  | "text"
  | "data"
  | "file";

export interface ArtifactType {
  kind: ArtifactKind;
  /** messages key under `artifacts.*` for the badge label. */
  labelKey: `type${Capitalize<ArtifactKind>}`;
  /** Whether the in-shell viewer renders it inside the page rather than offering a download. */
  inline: boolean;
}

const BY_EXTENSION: Record<string, ArtifactKind> = {
  html: "app",
  htm: "app",
  pdf: "pdf",
  ppt: "slides",
  pptx: "slides",
  key: "slides",
  odp: "slides",
  xls: "sheet",
  xlsx: "sheet",
  csv: "sheet",
  ods: "sheet",
  numbers: "sheet",
  doc: "document",
  docx: "document",
  odt: "document",
  rtf: "document",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  md: "text",
  txt: "text",
  json: "data",
  xml: "data",
  yaml: "data",
  yml: "data",
};

const BY_CONTENT_TYPE: Array<[RegExp, ArtifactKind]> = [
  [/^text\/html/i, "app"],
  [/^application\/pdf/i, "pdf"],
  [/presentation|powerpoint/i, "slides"],
  [/spreadsheet|excel|csv/i, "sheet"],
  [/msword|wordprocessing|opendocument\.text/i, "document"],
  [/^image\//i, "image"],
  [/^text\/(plain|markdown)/i, "text"],
  [/json|xml|yaml/i, "data"],
];

const INLINE: ReadonlySet<ArtifactKind> = new Set(["app", "pdf", "image"]);

const label = (kind: ArtifactKind): ArtifactType["labelKey"] =>
  `type${kind.charAt(0).toUpperCase()}${kind.slice(1)}` as ArtifactType["labelKey"];

/** The extension of a file name or an S3 key, lower-cased, without the dot; "" when there is none. */
export function extensionOf(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const i = base.lastIndexOf(".");
  return i > 0 ? base.slice(i + 1).toLowerCase() : "";
}

/** The file name alone — the share's own `-_EXULU_` marker stripped, as the backend's deriveFilename does. */
export function displayFilename(filenameOrKey: string): string {
  const base = filenameOrKey.split(/[/\\]/).pop() ?? filenameOrKey;
  const marker = base.indexOf("-_EXULU_");
  return marker >= 0 ? base.slice(marker + "-_EXULU_".length) : base;
}

export function artifactType(filename: string, contentType?: string | null): ArtifactType {
  const ext = extensionOf(filename);
  let kind: ArtifactKind | undefined = BY_EXTENSION[ext];
  if (!kind && contentType) {
    kind = BY_CONTENT_TYPE.find(([re]) => re.test(contentType))?.[1];
  }
  const resolved: ArtifactKind = kind ?? "file";
  return { kind: resolved, labelKey: label(resolved), inline: INLINE.has(resolved) };
}

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html",
  htm: "text/html",
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  md: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/**
 * The content type to upload and store: the browser's when it knows one,
 * otherwise by extension, otherwise a plain octet stream. Browsers leave
 * `File.type` empty for .md and other less common extensions.
 */
export function contentTypeFor(filename: string, browserType?: string | null): string {
  if (browserType && browserType.trim()) return browserType;
  return CONTENT_TYPES[extensionOf(filename)] ?? "application/octet-stream";
}
