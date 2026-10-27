/**
 * "Something about a conversation's activity just changed" — broadcast from
 * the chat screen to whatever chat lists happen to be mounted.
 *
 * The lists cannot discover these changes on their own: they fetch once on
 * mount, and polling them continuously to catch a state that usually changes
 * in the SAME tab would be waste. The chat screen already knows the moment a
 * turn starts, ends, or is marked read, so it says so and the lists re-read.
 *
 * Module-level rather than React context because the publisher (the chat
 * screen) and the subscribers (history rail, history sheet, search page) sit
 * in different branches of the tree, and a context would have to be threaded
 * through every one of them.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export const subscribeToSessionActivity = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const notifySessionActivityChanged = (): void => {
  // A copy, so a listener unsubscribing during the sweep cannot skip another,
  // and a try/catch each: one list failing to refetch must not stop the others.
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // A refetch is decoration; never let it break the turn that triggered it.
    }
  }
};
