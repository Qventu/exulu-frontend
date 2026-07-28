export interface QueueOption {
  name: string;
}

/**
 * Returns the available queues, guaranteeing the currently-selected queue is
 * present as an option even when it is not (or no longer) registered — mirrors
 * the Basics agent select, so an unregistered stored value stays visible and
 * changeable rather than rendering a blank trigger.
 */
export function mergeQueueOptions(
  available: QueueOption[],
  current?: string | null,
): QueueOption[] {
  if (!current || available.some((q) => q.name === current)) {
    return available;
  }
  return [{ name: current }, ...available];
}
