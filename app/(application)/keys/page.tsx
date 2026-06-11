/**
 * /keys — org API keys (keys-token.md; primary persona P3, secondary P4).
 * Thin server component: the server-side RBAC guard (SA || role.api:w) lives
 * in this route's layout.tsx via guardRoute("keys"); the page just composes
 * the client surface.
 */
import { KeysView } from "./components/keys-view";

export const dynamic = "force-dynamic";

export default function KeysPage() {
  return <KeysView />;
}
