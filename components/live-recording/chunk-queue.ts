/**
 * Strictly sequential upload queue for live-recording chunks. One in-flight
 * send; the queue never advances past a chunk the server has not acknowledged
 * (the backend appends with a compare-and-swap on the chunk seq, so a hole
 * would strand every later chunk as out_of_order).
 *
 * Transport-agnostic: `send` is injected (fetch in the hook, a script in tests).
 */
import { classifyChunkFailure } from "./classify-chunk-failure";

export type SendResult =
  | { ok: true; text: string }
  | { ok: false; status: number | null; body?: { kind?: string } | null };

export type ChunkStatus = "pending" | "sending" | "retrying" | "sent" | "skipped" | "failed";

export type ChunkState = {
  seq: number;
  status: ChunkStatus;
  text: string | null;
  attempts: number;
};

export class QueueAbortError extends Error {
  constructor(public readonly reason: string) {
    super(`chunk queue aborted: ${reason}`);
    this.name = "QueueAbortError";
  }
}

export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_CAP_MS = 30_000;

export function backoffMs(attempt: number): number {
  return Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt);
}

type Deps<TPayload> = {
  send: (chunk: TPayload, opts: { skipped: boolean }) => Promise<SendResult>;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class ChunkQueue<TPayload extends { seq: number }> {
  private items: Array<{ payload: TPayload; state: ChunkState }> = [];
  private cursor = 0;
  private running = false;
  private aborted: QueueAbortError | null = null;
  private listeners = new Set<() => void>();
  private idleWaiters: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];
  private readonly send: Deps<TPayload>["send"];
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(deps: Deps<TPayload>) {
    this.send = deps.send;
    this.sleep = deps.sleep ?? defaultSleep;
  }

  enqueue(payload: TPayload): void {
    if (this.aborted) return;
    this.items.push({ payload, state: { seq: payload.seq, status: "pending", text: null, attempts: 0 } });
    this.notify();
    void this.pump();
  }

  /** Resolves once every enqueued chunk is sent or skipped; rejects if aborted. */
  drain(): Promise<void> {
    if (this.aborted) return Promise.reject(this.aborted);
    if (!this.running && this.cursor >= this.items.length) return Promise.resolve();
    return new Promise((resolve, reject) => this.idleWaiters.push({ resolve, reject }));
  }

  abort(reason: string): void {
    if (this.aborted) return;
    this.aborted = new QueueAbortError(reason);
    this.notify();
    this.settleWaiters();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot(): ChunkState[] {
    return this.items.map((item) => ({ ...item.state }));
  }

  pendingCount(): number {
    return this.items.filter((item) => item.state.status !== "sent" && item.state.status !== "skipped").length;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Subscribers are a UI concern; a throwing listener must never
        // affect the transport (it must not abort enqueue()/pump()).
      }
    }
  }

  private settleWaiters(): void {
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    for (const waiter of waiters) {
      if (this.aborted) waiter.reject(this.aborted);
      else waiter.resolve();
    }
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (!this.aborted && this.cursor < this.items.length) {
        const item = this.items[this.cursor];
        await this.sendUntilSettled(item);
        if (this.aborted) break;
        this.cursor += 1;
      }
    } finally {
      this.running = false;
      // Only report completion when the queue is genuinely idle (drained or
      // aborted). If sendUntilSettled ever exits some other way, resolving
      // waiters here would report success while a chunk is still unsent; the
      // next enqueue() restarts the pump from the same cursor instead.
      if (this.aborted || this.cursor >= this.items.length) {
        this.settleWaiters();
      }
    }
  }

  /**
   * Wraps the injected transport so a thrown/rejected `send` (e.g. a network
   * exception) can never escape as an unhandled rejection — it is
   * indistinguishable from `status: null`, which classifyChunkFailure
   * already treats as a transient, retry-forever failure.
   */
  private async safeSend(payload: TPayload, opts: { skipped: boolean }): Promise<SendResult> {
    try {
      return await this.send(payload, opts);
    } catch {
      return { ok: false, status: null };
    }
  }

  private async sendUntilSettled(item: { payload: TPayload; state: ChunkState }): Promise<void> {
    let attempt = 0;
    // Once a deterministic rejection (400/413/415) hits, every further
    // attempt for this seq sends the skip marker instead of the original
    // payload — resending the rejected payload would just draw the same
    // rejection forever.
    let skipMode = false;
    while (!this.aborted) {
      item.state.status = attempt === 0 ? "sending" : "retrying";
      item.state.attempts += 1;
      this.notify();
      const result = await this.safeSend(item.payload, { skipped: skipMode });
      if (this.aborted) return;
      if (result.ok) {
        item.state.status = skipMode ? "skipped" : "sent";
        item.state.text = skipMode ? "" : result.text;
        this.notify();
        return;
      }
      const failure = classifyChunkFailure(result.status, result.body);
      if (failure.kind === "abort") {
        item.state.status = "failed";
        this.abort(failure.reason);
        return;
      }
      if (failure.kind === "skip") {
        if (skipMode) {
          // The skip marker itself was deterministically rejected (e.g. the
          // server refuses even an empty placeholder). Retrying forever
          // would livelock the recording, so this chunk cannot continue.
          item.state.status = "failed";
          this.abort("skip_rejected");
          return;
        }
        // Same seq, no audio: the server stores an empty placeholder so the
        // sequence stays contiguous. Try the skip marker immediately; if it
        // fails transiently, the backoff loop below retries it (still with
        // skipped: true, via skipMode).
        skipMode = true;
        continue;
      }
      await this.sleep(backoffMs(attempt));
      attempt += 1;
    }
  }
}
