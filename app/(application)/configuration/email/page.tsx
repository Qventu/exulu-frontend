/**
 * /configuration/email — email-intake platform settings (email-routines
 * design §7.5). Super-admin only: the parent /configuration layout.tsx
 * guards ALL nested segments via guardRoute("configuration"). Thin page per
 * codebase-structure §1.1; the surface lives in components/.
 */
import { EmailIntakeView } from "../components/email-intake-view";

export const dynamic = "force-dynamic";

export default function EmailIntakePage() {
  return <EmailIntakeView />;
}
