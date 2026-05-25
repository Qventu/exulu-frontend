// Preprocess assistant-message text for TTS playback.
//
// Reading raw markdown out loud is rough: code blocks become "back tick npm
// install back tick", bullets become "asterisk", URLs get spelled out, etc.
// This strips formatting and replaces fenced code blocks with a spoken
// placeholder so listeners know something was skipped. Truncates at the
// 4000-char cap that the backend enforces (OpenAI TTS limit is 4096).
//
// Design doc: docs/superpowers/specs/2026-05-25-text-to-speech-design.md

export const MAX_TTS_CHARS = 4000;
// Target chunk size for streaming-style playback: small enough that the first
// chunk returns quickly (time-to-first-audio ~2-3s for tts-1) but large enough
// to keep total TTS call count reasonable. Hard cap is a safety net for
// pathologically long sentences without intermediate punctuation.
export const TTS_CHUNK_TARGET_CHARS = 300;
export const TTS_CHUNK_MAX_CHARS = 500;
// Max number of TTS requests in flight at once. Sliding window — as soon as
// one completes another starts. Protects backend / upstream provider on very
// long messages.
export const TTS_MAX_CONCURRENT = 5;

export function preprocessForTTS(raw: string): { text: string; truncated: boolean } {
  let s = raw;
  // Fenced code blocks → spoken placeholder.
  s = s.replace(/```[\s\S]*?```/g, " (code omitted) ");
  // Inline code: keep contents, drop backticks.
  s = s.replace(/`([^`]+)`/g, "$1");
  // Markdown links: keep label, drop URL.
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Images: drop entirely.
  s = s.replace(/!\[[^\]]*\]\([^)]+\)/g, " ");
  // Bold / italic markers.
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");
  // Headings.
  s = s.replace(/^#{1,6}\s+/gm, "");
  // Blockquotes.
  s = s.replace(/^>\s?/gm, "");
  // Bulleted + ordered list markers.
  s = s.replace(/^[\s]*[-*+]\s+/gm, "");
  s = s.replace(/^[\s]*\d+\.\s+/gm, "");
  // Horizontal rules.
  s = s.replace(/^\s*[-*_]{3,}\s*$/gm, "");
  // Collapse whitespace.
  s = s.replace(/\s+/g, " ").trim();

  if (s.length > MAX_TTS_CHARS) {
    return { text: s.slice(0, MAX_TTS_CHARS), truncated: true };
  }
  return { text: s, truncated: false };
}

// Split preprocessed TTS text into chunks suitable for parallel streaming
// playback. Splits on sentence boundaries (. ! ?), accumulating sentences until
// the chunk reaches TTS_CHUNK_TARGET_CHARS, then starts a new chunk. A single
// very long sentence that exceeds TTS_CHUNK_MAX_CHARS is hard-split at commas
// as a fallback. Never produces empty chunks; returns [text] verbatim if no
// sentence boundaries are found.
export function chunkForTTS(text: string): string[] {
  const sentences =
    text.match(/[^.!?\n]+[.!?]+(?:\s+|$)|[^.!?\n]+\n+|[^.!?\n]+$/g) ?? [text];

  const chunks: string[] = [];
  let current = "";
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (current.length === 0) {
      current = s;
    } else if (current.length + 1 + s.length <= TTS_CHUNK_TARGET_CHARS) {
      current += " " + s;
    } else {
      chunks.push(current);
      current = s;
    }
  }
  if (current) chunks.push(current);

  // Hard-split any oversize chunks at commas as a safety net.
  const final: string[] = [];
  for (const c of chunks) {
    if (c.length <= TTS_CHUNK_MAX_CHARS) {
      final.push(c);
      continue;
    }
    const parts = c.split(/,\s+/);
    let buf = "";
    for (const p of parts) {
      const candidate = buf ? `${buf}, ${p}` : p;
      if (candidate.length > TTS_CHUNK_TARGET_CHARS && buf) {
        final.push(buf);
        buf = p;
      } else {
        buf = candidate;
      }
    }
    if (buf) final.push(buf);
  }
  return final.length ? final : [text];
}
