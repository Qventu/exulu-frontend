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
 * ASSETS NOW LIVE at these paths, under public/demo/brand/. Landing them was
 * not the drop-in swap this comment used to promise: components/logo.tsx used
 * to render a monogram tile in demo mode rather than an <img> — because a
 * missing image fails as a grey alt-text block, and a monogram cannot fail to
 * load — so a code change was needed too. It now renders logoLight/logoDark
 * directly, with onError hiding either one that fails to load.
 */
export const DEMO_BRAND = {
  productName: "OPEN IMP",
  /** Rail-mode monogram. Two characters — the tile is 24px. */
  mark: "O",
  logoLight: "/demo/brand/logo_light.png",
  logoDark: "/demo/brand/logo_dark.png",
  favicon: "/demo/brand/favicon.png",
} as const;
