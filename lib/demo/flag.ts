/**
 * The demo shell is gated on NEXT_PUBLIC_DEMO_MODE rather than DEMO_MODE:
 * client components read it, and Next.js only inlines NEXT_PUBLIC_* vars
 * into the browser bundle.
 *
 * Strict equality with "true" — a deployment that sets "1" or "TRUE" should
 * fail closed rather than silently serve the demo from a customer instance.
 *
 * Note: the value parameter preserves the literal member expression
 * `process.env.NEXT_PUBLIC_DEMO_MODE`, ensuring Next.js inlines it at build time.
 * For tests, pass the string directly or undefined.
 */
export function isDemoMode(
  value: string | undefined = process.env.NEXT_PUBLIC_DEMO_MODE,
): boolean {
  return value === "true";
}
