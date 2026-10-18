import type { ReactNode } from "react";

import { guardRoute } from "@/lib/route-guard";

export default async function ArtifactsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (await guardRoute("artifacts")) ?? children;
}
