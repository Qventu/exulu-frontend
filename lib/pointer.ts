/**
 * Pointer-capability test, used to decide whether focusing a field on mount is
 * a courtesy or a trap.
 *
 * On a device with a physical keyboard, focusing an input on mount saves a
 * click. On iOS it does the opposite: programmatic focus never raises the
 * software keyboard (only a real user gesture does), so the field ends up
 * focused with no keyboard — and the user's first tap then lands on an
 * ALREADY-focused field, which iOS answers with the Paste/AutoFill edit menu
 * instead of the keyboard. Gating autofocus on a fine pointer keeps the
 * desktop convenience without the mobile dead end.
 */

interface MatchMediaHost {
  matchMedia?: (query: string) => { matches: boolean };
}

export function hasFinePointer(win: MatchMediaHost | null | undefined): boolean {
  if (!win || typeof win.matchMedia !== "function") return false;
  try {
    return win.matchMedia("(pointer: fine)").matches;
  } catch {
    // Ancient or exotic engines without the pointer media feature: treat as
    // touch, i.e. do not autofocus. The cost is one extra tap on desktop.
    return false;
  }
}
