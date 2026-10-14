export type FooterControl = "back" | "next" | "cta";

/**
 * Which buttons the docked panel's footer shows.
 *
 * A CTA takes Next's place; the last step without one shows only Back. The
 * footer used to render Next unconditionally, and on the closing step that
 * button called `next()` with nowhere to go.
 */
export function footerControls({
  hasCta,
  isLast,
}: {
  hasCta: boolean;
  isLast: boolean;
}): FooterControl[] {
  if (hasCta) return ["back", "cta"];
  return isLast ? ["back"] : ["back", "next"];
}
