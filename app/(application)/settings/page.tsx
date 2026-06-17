/**
 * /settings — personal settings (settings-config.md; primary persona P1,
 * secondary all). Deliberately NO route guard: every authenticated user owns
 * a /settings (ownership matrix, personas.md). Thin page per
 * codebase-structure §1.1 — the surface lives in components/settings-view.
 */
import { SettingsView } from "./components/settings-view";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return <SettingsView />;
}
