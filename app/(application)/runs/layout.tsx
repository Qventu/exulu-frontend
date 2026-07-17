// Server-side route guard for /runs — same predicate as the flag-gated nav
// entry (workflows:read). Guarded with an INLINE requirement (not the nav id)
// because the nav entry only exists while ROUTINES_RUNS_V2_SUPPORTED is true,
// and guardRoute("runs") would throw on the id while the flag is off.
import type { ReactNode } from "react";

import { guardRoute } from "@/lib/route-guard";

export default async function RunsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (await guardRoute({ area: "workflows", level: "read" })) ?? children;
}
