/**
 * /users — the canonical "Users & access" surface (access.md §3).
 *
 * Server component (no getTranslations / t() — rule 5, the 7-times-bitten
 * trap). The active tab is read CLIENT-side from `?tab` inside AccessSurface;
 * this file only mounts the client wrapper inside a Suspense boundary (the
 * AccessSurface tree uses `useSearchParams`, which the Next.js App Router
 * requires to be Suspense-wrapped at the page level).
 *
 * /roles and /teams server-redirect to /users?tab=roles|teams (alias routes
 * are preserved for deep links and the existing nav-config alias array).
 * The route guard lives in layout.tsx (guardRoute('users')).
 */
import { Suspense } from "react";

import { AccessSurface } from "./components/access-surface";

export const dynamic = "force-dynamic";

export default function UsersPage() {
  return (
    <Suspense fallback={null}>
      <AccessSurface />
    </Suspense>
  );
}
