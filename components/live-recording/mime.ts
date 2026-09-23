/** MediaRecorder container choice + matching file extension (pure; tested). */
export const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/mp4"] as const;

export function pickMimeType(isTypeSupported: (type: string) => boolean): string {
  return MIME_CANDIDATES.find((type) => isTypeSupported(type)) ?? "";
}

export function extensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}
