/**
 * The agent panel's reuse rule for an artifact's open request (task 6,
 * project sessions from artifacts).
 *
 * A request may land in the mounted session only when both name the same
 * project, and "no project" counts as a project of its own:
 *
 * - a project's request must not land in a conversation that has no project
 *   or another one — a message for a new tender in another tender's thread;
 * - a request without one must not land in a project's conversation either:
 *   the backend's `create_project` tool refuses a session that already has a
 *   project, which is exactly what such a request is usually about to ask
 *   for.
 *
 * `undefined` and `null` are the same "none": the controller's row and the
 * protocol's optional field spell absence differently.
 */
export function needsFreshSession(
  current: string | null | undefined,
  requested: string | null | undefined,
): boolean {
  return (current ?? null) !== (requested ?? null);
}
