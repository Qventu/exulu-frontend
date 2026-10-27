/**
 * What a chat list row can say about a conversation without opening it.
 *
 * Reads the three timestamps the backend stamps on agent_sessions (see
 * exulu/backend src/exulu/session-activity.ts). All three come from the SERVER
 * clock; `now` here is the viewer's, which is why the working window below is
 * generous rather than exact.
 *
 * The marks are session-wide, so on a shared conversation "unread" means
 * nobody has opened it yet rather than specifically you.
 */

export type SessionActivity = "working" | "unread" | null;

/**
 * How long a `generating_since` stamp is believed. A backend that restarts
 * mid-turn never clears it, and a row that claims to be working forever is
 * worse than one that goes quiet — the next turn on that session overwrites
 * the stamp anyway.
 */
export const WORKING_STALE_MS = 10 * 60 * 1000;

export type SessionActivityFields = {
  generating_since?: string | Date | null;
  last_answer_at?: string | Date | null;
  last_seen_at?: string | Date | null;
};

const asTime = (value: string | Date | null | undefined): number | null => {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(time) ? null : time;
};

export const sessionActivity = (
  session: SessionActivityFields,
  now: number = Date.now(),
): SessionActivity => {
  const generatingSince = asTime(session.generating_since);
  // A stamp from the future means the viewer's clock trails the server's, not
  // that the turn is stale — only age in the past is measured.
  if (generatingSince !== null && now - generatingSince < WORKING_STALE_MS) {
    return "working";
  }

  const answeredAt = asTime(session.last_answer_at);
  if (answeredAt === null) return null;

  const seenAt = asTime(session.last_seen_at);
  return seenAt === null || answeredAt > seenAt ? "unread" : null;
};

/** How often a chat list re-reads itself while some conversation is working. */
export const WORKING_POLL_MS = 5_000;

/**
 * Poll interval for a chat list, or 0 for "leave it alone".
 *
 * Only a turn in flight justifies polling: it is the one state that ends by
 * itself. An unread answer waits for a reader, and a stale working flag never
 * resolves — polling either would mean every open list hammering the server
 * for the rest of the session.
 */
export const listPollIntervalMs = (
  sessions: SessionActivityFields[],
  now?: number,
): number =>
  sessions.some((session) => sessionActivity(session, now) === "working")
    ? WORKING_POLL_MS
    : 0;

/** The AI SDK transport's view of this tab's own turn. */
export type ChatBusyStatus = "submitted" | "streaming" | "ready" | "error";

/**
 * True when the chat screen should watch the server for an answer it is not
 * receiving itself: the session is working, but this tab is not the one
 * driving the stream.
 *
 * That is the state a viewer returns to after leaving mid-answer — the page is
 * rendered from stored messages, the turn is finishing somewhere else, and
 * nothing would otherwise tell this tab about it.
 *
 * Streaming and submitted are excluded because the live stream is the better
 * source; a poll writing over it would fight the transport.
 */
export const shouldWatchForAnswer = (
  session: SessionActivityFields | null | undefined,
  chatStatus: ChatBusyStatus,
  now?: number,
): boolean => {
  if (!session) return false;
  if (chatStatus === "streaming" || chatStatus === "submitted") return false;
  return sessionActivity(session, now) === "working";
};

/**
 * What a list row should actually SHOW, which is not quite what the stamps
 * say: the conversation you have open is read by definition, so it never
 * carries the unread marker. Shared by the badge and by the rows that decide
 * whether the status takes the place of the timestamp, so the two can never
 * disagree about whether a row has a status.
 */
export const visibleSessionActivity = (
  session: SessionActivityFields,
  { now, isOpen = false }: { now?: number; isOpen?: boolean } = {},
): SessionActivity => {
  const activity = sessionActivity(session, now);
  return activity === "unread" && isOpen ? null : activity;
};

/**
 * A turn is already running for this conversation, so a second one must not be
 * started: it would interleave with the first on the same session.
 *
 * Two different ways that happens, and the second is the one that used to slip
 * through: this tab streaming its own turn (`status`), and a turn running on
 * the server that this tab is not receiving because the viewer came back
 * mid-answer (`catchingUp`) — where `status` is "ready" and every gate that
 * only consulted it let the message go.
 *
 * One definition rather than the condition rewritten at each gate: the
 * composer blocks a send in three independent places (the submit funnel, the
 * Enter key, the send button's disabled state), and a new reason to block has
 * to reach all three.
 */
export const turnInFlight = ({
  status,
  catchingUp,
}: {
  status: ChatBusyStatus;
  catchingUp: boolean;
}): boolean => catchingUp || status === "submitted" || status === "streaming";
