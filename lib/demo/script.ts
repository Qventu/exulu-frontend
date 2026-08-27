import type { UIMessageChunk } from "ai";

export interface ScriptedToolCall {
  toolCallId: string;
  toolName: string;
  input: unknown;
  output: unknown;
}

export interface ScriptedSource {
  sourceId: string;
  url: string;
  title: string;
}

export interface ScriptedTurn {
  /** Also used as the text-block id, so all text chunks correlate. */
  id: string;
  toolCalls: ScriptedToolCall[];
  text: string;
  sources: ScriptedSource[];
}

/** One delta per word, keeping surrounding whitespace so deltas rejoin exactly. */
function splitIntoDeltas(text: string): string[] {
  // \s*\S+\s* captures leading whitespace, the word, and trailing whitespace so
  // that deltas rejoin to reproduce the input exactly — including leading spaces.
  // A text that is entirely whitespace has no \S+ anchor, so return it as-is.
  return text.match(/\s*\S+\s*/g) ?? (text.length > 0 ? [text] : []);
}

/**
 * Order matters: tool calls resolve before the assistant speaks, and sources
 * land after the text. That is the sequence the product's own renderer
 * expects, and the sequence that makes retrieval legible on screen.
 */
export function buildChunks(turn: ScriptedTurn): UIMessageChunk[] {
  const chunks: UIMessageChunk[] = [];

  for (const call of turn.toolCalls) {
    chunks.push({
      type: "tool-input-available",
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      input: call.input,
    });
    chunks.push({
      type: "tool-output-available",
      toolCallId: call.toolCallId,
      output: call.output,
    });
  }

  chunks.push({ type: "text-start", id: turn.id });
  for (const delta of splitIntoDeltas(turn.text)) {
    chunks.push({ type: "text-delta", id: turn.id, delta });
  }
  chunks.push({ type: "text-end", id: turn.id });

  for (const source of turn.sources) {
    chunks.push({
      type: "source-url",
      sourceId: source.sourceId,
      url: source.url,
      title: source.title,
    });
  }

  return chunks;
}
