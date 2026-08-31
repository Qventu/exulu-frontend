import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { buildChunks, type ScriptedTurn } from "./script";

interface DemoChatTransportOptions {
  /**
   * The script to replay, or a function returning it.
   *
   * Pass the FUNCTION when the answer depends on where the tour is. This is
   * built once, when the chat controller mounts, and the mount can happen
   * before the tour has written its new position — so an array captured here
   * is whatever chapter was current at mount and stays that way for the life
   * of the transport. Chapter 3 sent its correction and got chapter 1's answer
   * about Nothalt COP back, retrieval trace and all.
   */
  turns: ScriptedTurn[] | (() => ScriptedTurn[]);
  /** Pause between chunks, in ms. Tuned for realism, not speed. */
  delayMs?: number;
  /** Injected so tests run instantly and deterministically. */
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Replays a fixed script in place of DefaultChatTransport.
 *
 * The visitor's typed text is ignored by design: the tour is scripted, and the
 * composer exists to make retrieval feel live, not to accept free input.
 */
export class DemoChatTransport implements ChatTransport<UIMessage> {
  private readonly resolveTurns: () => ScriptedTurn[];
  private readonly delayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private cursor = 0;
  /** The script the cursor is counting through, to notice a chapter change. */
  private playing: ScriptedTurn[] | null = null;

  constructor({ turns, delayMs = 18, sleep = realSleep }: DemoChatTransportOptions) {
    if (Array.isArray(turns) && turns.length === 0) {
      throw new Error("DemoChatTransport needs at least one turn to replay.");
    }
    this.resolveTurns = typeof turns === "function" ? turns : () => turns;
    this.delayMs = delayMs;
    this.sleep = sleep;
  }

  sendMessages = async (
    options: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0],
  ): Promise<ReadableStream<UIMessageChunk>> => {
    const turns = this.resolveTurns();
    if (turns.length === 0) {
      throw new Error("DemoChatTransport needs at least one turn to replay.");
    }

    // A different script means a different chapter, so start it from its own
    // first turn. Without this, arriving at chapter 3 with the cursor already
    // advanced would clamp straight to that chapter's last answer.
    if (turns !== this.playing) {
      this.playing = turns;
      this.cursor = 0;
    }

    // Clamp rather than wrap: re-answering the first question after the script
    // ends would read as a glitch, whereas repeating the last answer reads as
    // the tour simply being over.
    const turn = turns[Math.min(this.cursor, turns.length - 1)];
    this.cursor += 1;

    const chunks = buildChunks(turn);
    const { sleep, delayMs } = this;
    const signal = options?.abortSignal;

    return new ReadableStream<UIMessageChunk>({
      async start(controller) {
        for (const chunk of chunks) {
          if (signal?.aborted) break;
          controller.enqueue(chunk);
          await sleep(delayMs);
        }
        controller.close();
      },
    });
  };

  reconnectToStream = async (_options: {
    chatId: string;
  } & Record<string, unknown>): Promise<ReadableStream<UIMessageChunk> | null> => null;
}
