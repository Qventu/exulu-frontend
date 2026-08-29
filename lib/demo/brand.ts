/**
 * How the guided demo names itself.
 *
 * The tour is campaign collateral for the elevator vertical, published under
 * the OPEN brand. A lead reaches it from a whitepaper headed "OPEN IMP. KI für
 * die Aufzugsbranche", so the demo has to answer to the same name — three
 * different product names across the PDF, the tour copy and the app header was
 * the most damaging inconsistency in the campaign and the cheapest to fix.
 *
 * Demo-scoped on purpose. `navigation.brand.productName` in the message
 * catalogue is shared by every deployment, and nothing says Newlift's or
 * ALGI's own installations should start calling themselves OPEN. The same
 * argument applies to the theme, which arrives the same way — see
 * app/(application)/layout.tsx, where demo mode substitutes the backend's
 * /theme response rather than editing globals.css.
 *
 * ASSETS ARE NOT HERE YET. logoLight/logoDark point at files that do not exist
 * in public/ — components/logo.tsx hides an image that fails to load, so the
 * header degrades to the wordmark rather than to a broken-image block. Drop the
 * real marks at these paths and they appear; no code change needed.
 */
export const DEMO_BRAND = {
  productName: "OPEN IMP",
  /** Rail-mode monogram. Two characters — the tile is 24px. */
  mark: "O",
  logoLight: "/demo/brand/logo_light.png",
  logoDark: "/demo/brand/logo_dark.png",
  favicon: "/demo/brand/favicon.png",
} as const;
