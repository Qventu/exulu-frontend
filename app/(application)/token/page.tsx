/**
 * /token — personal API token (keys-token.md; primary persona P4).
 *
 * Deliberately NO route guard: the page only reveals the caller's own session
 * JWT (no privilege escalation), so the route stays URL-accessible to every
 * authenticated user while the nav entry is RBAC-trimmed into the Develop
 * group (keys-token.md §2 ownership-matrix note / ladder rows 22–23).
 */
import { TokenView } from "./components/token-view";

export const dynamic = "force-dynamic";

export default function TokenPage() {
  return <TokenView />;
}
