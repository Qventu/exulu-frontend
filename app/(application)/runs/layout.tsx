// Server-side route guard for /runs — same predicate as the nav entry
// (workflows:read). Guarded with an INLINE requirement for flexibility.
import type { ReactNode } from "react";

import { guardRoute } from "@/lib/route-guard";

export default async function RunsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (await guardRoute({ area: "workflows", level: "read" })) ?? children;
}
