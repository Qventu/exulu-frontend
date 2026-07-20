import type { UIMessage } from "ai";

const KEY_PREFIX = "exulu_public_chat_";
const MAX_MESSAGES = 50;

const storage = (): Storage | null =>
  typeof localStorage === "undefined" ? null : localStorage;

/** Best-effort browser persistence for anonymous transcripts (spec §5.4). */
export function loadTranscript(agentId: string): UIMessage[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(KEY_PREFIX + agentId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveTranscript(agentId: string, messages: UIMessage[]): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(
      KEY_PREFIX + agentId,
      JSON.stringify(messages.slice(-MAX_MESSAGES)),
    );
  } catch {
    // Quota exceeded etc. — transcripts are best-effort.
  }
}

export function clearTranscript(agentId: string): void {
  storage()?.removeItem(KEY_PREFIX + agentId);
}
