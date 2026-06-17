/**
 * /skills — P2 skills-library surface (work item 2.10; skills.md primary
 * persona P2, secondary P4).
 *
 * Thin client wrapper: the RBAC guard lives in layout.tsx (guardRoute("skills")
 * — server component, unchanged). The Suspense boundary is required because
 * SkillsView mounts ListDetail, which reads useSearchParams (list-detail.tsx
 * JSDoc rule).
 *
 * SERVER-SIDE i18n TRAP (brief rule 5): this file must NOT call
 * getTranslations from next-intl/server — the project's i18n/config.ts has no
 * default export, so server-side translation crashes the build. UI copy lives
 * in the client surface (SkillsView).
 */
import { Suspense } from "react";

import { SkillsView } from "./components/skills-view";
import Loading from "./loading";

export const dynamic = "force-dynamic";

export default function SkillsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SkillsView />
    </Suspense>
  );
}
