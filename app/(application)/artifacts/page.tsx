/**
 * /artifacts — Artifacts. Thin client wrapper: the RBAC guard lives in
 * `layout.tsx` (guardRoute("artifacts"), server); all copy lives in
 * <ArtifactsClient /> (no server-side next-intl here).
 */
import { Suspense } from "react";

import { ArtifactsClient } from "./artifacts-client";
import Loading from "./loading";

export const dynamic = "force-dynamic";

export default function ArtifactsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ArtifactsClient />
    </Suspense>
  );
}
