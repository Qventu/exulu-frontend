import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { buildChunks, type ScriptedTurn } from "./script";

interface DemoChatTransportOptions {
  turns: ScriptedTurn[];
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
  private readonly turns: ScriptedTurn[];
  private readonly delayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private cursor = 0;

  constructor({ turns, delayMs = 18, sleep = realSleep }: DemoChatTransportOptions) {
    if (turns.length === 0) {
      throw new Error("DemoChatTransport needs at least one turn to replay.");
    }
    this.turns = turns;
    this.delayMs = delayMs;
    this.sleep = sleep;
  }

  sendMessages = async (
    options: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0],
  ): Promise<ReadableStream<UIMessageChunk>> => {
    // Clamp rather than wrap: re-answering the first question after the script
    // ends would read as a glitch, whereas repeating the last answer reads as
    // the tour simply being over.
    const turn = this.turns[Math.min(this.cursor, this.turns.length - 1)];
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
