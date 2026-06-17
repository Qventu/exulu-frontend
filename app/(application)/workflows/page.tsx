/**
 * /workflows — Routines (work item 2.12).
 *
 * Thin client wrapper: the RBAC guard lives in `layout.tsx`
 * (guardRoute("routines"), server). The Suspense boundary is required because
 * RoutinesClient mounts ListDetail, which reads useSearchParams.
 *
 * SERVER-SIDE i18n TRAP (5th-time-this-bites pattern): this file MUST NOT
 * call getTranslations / t() from next-intl/server — all UI copy lives in
 * <RoutinesClient />.
 */
import { Suspense } from "react";

import { RoutinesClient } from "./routines-client";
import Loading from "./loading";

export const dynamic = "force-dynamic";

export default function RoutinesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <RoutinesClient />
    </Suspense>
  );
}
