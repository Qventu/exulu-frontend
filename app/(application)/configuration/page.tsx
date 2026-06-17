/**
 * /configuration — platform theming, nav label "Theme" (settings-config.md;
 * primary persona P3). Thin page per codebase-structure §1.1: the
 * super_admin route guard (fixes settings-config.md U1) lives in this
 * route's layout.tsx via guardRoute("configuration") — same predicate as the
 * nav entry, denied accounts get the shared AccessDenied. The surface lives
 * in components/theme-studio.
 */
import { ThemeStudio } from "./components/theme-studio";

export const dynamic = "force-dynamic";

export default function ConfigurationPage() {
  return <ThemeStudio />;
}
