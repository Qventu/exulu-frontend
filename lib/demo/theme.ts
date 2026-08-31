import type { ThemeConfig } from "@/lib/api/config";

/**
 * The OPEN token set, served to the demo exactly as a backend would serve it.
 *
 * This is NOT a globals.css edit and NOT a `.theme-open` class. A themed
 * customer deployment already gets its tokens from GET /theme, injected as a
 * <style> block over :root and .dark by app/(application)/layout.tsx. The demo
 * has no backend to ask, so it substitutes this object at that one call site.
 * The demo therefore demonstrates the product's own tenant theming rather than
 * faking a coat of paint, and nothing here can reach another deployment.
 *
 * TWO THINGS ARE KNOWINGLY UNFINISHED.
 *
 * The font tokens do nothing. --font-sans asks for Poppins and --font-serif for
 * Playfair Display, but lib/fonts.ts declares those same variables through
 * next/font and they land on <body> via `fontVariables` — a more specific
 * selector than the :root this is injected into. So the demo does not fall back
 * to a system font, it keeps Inter and Merriweather outright. Shipping the
 * typography means adding the two families to lib/fonts.ts; nothing in this
 * file can achieve it.
 *
 * And light mode fails contrast. --primary here is #aab74a, which is 6.64:1 as
 * a button fill against --primary-foreground but 2.19:1 as text on white —
 * under the 3:1 floor for non-text, let alone AA. The codebase uses primary as
 * a FOREGROUND in about 135 places (text-primary, border-primary, ring-primary),
 * so active nav items, links and focus rings are close to illegible in light
 * mode. Dark mode is fine: #effe7c on #785d11 is 5.67:1.
 *
 * That is survivable only because the demo now forces dark (see the layout).
 * Anyone turning light mode back on, or reaching it through the theme toggle,
 * meets the problem — the fix is a darker primary for foreground use, roughly
 * `67 43% 32%`, not a tweak to this file.
 */
export const DEMO_THEME: ThemeConfig = {
  light: {
    "--card": "0 0% 100%",
    "--ring": "0 0% 63.1373%",
    "--input": "0 0% 89.8039%",
    "--muted": "0 0% 96.0784%",
    "--accent": "0 0% 96.0784%",
    "--border": "0 0% 89.8039%",
    "--radius": "0.225rem",
    "--shadow":
      "3px 3px 3px 0px hsl(0 0% 0% / 0.10), 3px 1px 2px -1px hsl(0 0% 0% / 0.10)",
    "--chart-1": "211.6364 100% 78.4314%",
    "--chart-2": "217.3404 91.2621% 59.6078%",
    "--chart-3": "221.5842 86.3248% 54.1176%",
    "--chart-4": "223.7500 78.6885% 47.8431%",
    "--chart-5": "226.4789 69.6078% 40%",
    "--popover": "0 0% 100%",
    // `deg` stripped. hsl() accepts it, but every other token here is unitless
    // and anything interpolating the channels as strings would break on it.
    "--primary": "67.24 43.2% 50.37%",
    "--sidebar": "0 0% 98.0392%",
    "--spacing": "0.25rem",
    "--shadow-x": "3px",
    "--shadow-y": "3px",
    "--font-mono": "JetBrains Mono, ui-monospace, monospace",
    "--font-sans": "Poppins, ui-sans-serif, sans-serif, system-ui",
    "--secondary": "0 0% 87.8431%",
    "--shadow-lg":
      "3px 3px 3px 0px hsl(0 0% 0% / 0.10), 3px 4px 6px -1px hsl(0 0% 0% / 0.10)",
    "--shadow-md":
      "3px 3px 3px 0px hsl(0 0% 0% / 0.10), 3px 2px 4px -1px hsl(0 0% 0% / 0.10)",
    "--shadow-sm":
      "3px 3px 3px 0px hsl(0 0% 0% / 0.10), 3px 1px 2px -1px hsl(0 0% 0% / 0.10)",
    "--shadow-xl":
      "3px 3px 3px 0px hsl(0 0% 0% / 0.10), 3px 8px 10px -1px hsl(0 0% 0% / 0.10)",
    "--shadow-xs": "3px 3px 3px 0px hsl(0 0% 0% / 0.05)",
    "--background": "0 0% 100%",
    "--font-serif": "Playfair Display, ui-serif, serif",
    "--foreground": "0 0% 13.3333%",
    "--shadow-2xl": "3px 3px 3px 0px hsl(0 0% 0% / 0.25)",
    "--shadow-2xs": "3px 3px 3px 0px hsl(0 0% 0% / 0.05)",
    "--destructive": "357.1429 100% 45.2941%",
    "--shadow-blur": "3px",
    "--shadow-color": "#000000",
    "--sidebar-ring": "0 0% 63.1373%",
    "--shadow-spread": "0px",
    "--shadow-opacity": "0.1",
    "--sidebar-accent": "66.9231 98.4848% 74.1176%",
    "--sidebar-border": "0 0% 89.8039%",
    "--card-foreground": "0 0% 13.3333%",
    "--sidebar-primary": "0 0% 9.0196%",
    "--tracking-normal": "0em",
    "--muted-foreground": "0 0% 33.3333%",
    "--accent-foreground": "0 0% 9.0196%",
    "--popover-foreground": "0 0% 13.3333%",
    "--primary-foreground": "0 0% 16.0784%",
    "--sidebar-foreground": "0 0% 3.9216%",
    "--secondary-foreground": "0 0% 13.3333%",
    "--destructive-foreground": "0 0% 100%",
    "--sidebar-accent-foreground": "0 0% 0%",
    "--sidebar-primary-foreground": "0 0% 98.0392%",
  },
  dark: {
    "--card": "0 0% 9.0196%",
    "--ring": "0 0% 45.0980%",
    "--input": "0 0% 20.3922%",
    "--muted": "0 0% 14.9020%",
    "--accent": "0 0% 25.0980%",
    "--border": "0 0% 15.6863%",
    "--radius": "0.225rem",
    "--shadow":
      "3px 3px 3px 0px hsl(0 0% 0% / 0.10), 3px 1px 2px -1px hsl(0 0% 0% / 0.10)",
    "--chart-1": "211.6364 100% 78.4314%",
    "--chart-2": "217.3404 91.2621% 59.6078%",
    "--chart-3": "221.5842 86.3248% 54.1176%",
    "--chart-4": "223.7500 78.6885% 47.8431%",
    "--chart-5": "226.4789 69.6078% 40%",
    "--popover": "0 0% 14.9020%",
    "--primary": "66.9231 98.4848% 74.1176%",
    "--sidebar": "0 0% 9.0196%",
    // The light block carries these two and the dark block did not. Copied
    // rather than left out: they are theme-invariant, and a token defined on
    // :root but absent from .dark silently keeps the light value in dark mode,
    // which is a difference nobody would think to look for.
    "--spacing": "0.25rem",
    "--tracking-normal": "0em",
    "--shadow-x": "3px",
    "--shadow-y": "3px",
    "--font-mono": "JetBrains Mono, ui-monospace, monospace",
    "--font-sans": "Poppins, ui-sans-serif, sans-serif, system-ui",
    "--secondary": "0 0% 34.1176%",
    "--shadow-lg":
      "3px 3px 3px 0px hsl(0 0% 0% / 0.10), 3px 4px 6px -1px hsl(0 0% 0% / 0.10)",
    "--shadow-md":
      "3px 3px 3px 0px hsl(0 0% 0% / 0.10), 3px 2px 4px -1px hsl(0 0% 0% / 0.10)",
    "--shadow-sm":
      "3px 3px 3px 0px hsl(0 0% 0% / 0.10), 3px 1px 2px -1px hsl(0 0% 0% / 0.10)",
    "--shadow-xl":
      "3px 3px 3px 0px hsl(0 0% 0% / 0.10), 3px 8px 10px -1px hsl(0 0% 0% / 0.10)",
    "--shadow-xs": "3px 3px 3px 0px hsl(0 0% 0% / 0.05)",
    "--background": "0 0% 7.8431%",
    "--font-serif": "Playfair Display, ui-serif, serif",
    "--foreground": "0 0% 98.0392%",
    "--shadow-2xl": "3px 3px 3px 0px hsl(0 0% 0% / 0.25)",
    "--shadow-2xs": "3px 3px 3px 0px hsl(0 0% 0% / 0.05)",
    "--destructive": "358.8387 100% 69.6078%",
    "--shadow-blur": "3px",
    "--shadow-color": "#000000",
    "--sidebar-ring": "0 0% 32.1569%",
    "--shadow-spread": "0px",
    "--shadow-opacity": "0.1",
    "--sidebar-accent": "0 0% 14.9020%",
    "--sidebar-border": "0 0% 15.6863%",
    "--card-foreground": "0 0% 98.0392%",
    "--sidebar-primary": "225.4286 84.0000% 49.0196%",
    "--muted-foreground": "0 0% 63.1373%",
    "--accent-foreground": "0 0% 98.0392%",
    "--popover-foreground": "0 0% 98.0392%",
    "--primary-foreground": "44.2718 75.1825% 26.8627%",
    "--sidebar-foreground": "0 0% 98.0392%",
    "--secondary-foreground": "0 0% 100%",
    "--destructive-foreground": "0 0% 98.0392%",
    "--sidebar-accent-foreground": "0 0% 98.0392%",
    "--sidebar-primary-foreground": "0 0% 98.0392%",
  },
};
