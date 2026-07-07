// Set-equality over pinned-item gids ("ctx" or "ctx/item"). Used for the
// active-preset dirty check in the chat composer. Pure module.

export function sameItemSet(a: string[], b: string[]): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size !== setB.size) return false;
  for (const gid of setA) {
    if (!setB.has(gid)) return false;
  }
  return true;
}
