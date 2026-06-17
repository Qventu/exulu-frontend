// Server-side route guard for /models (incl. /models/create, /models/edit) —
// gate from nav-config ("models"): interim SA || role.agents:w until the
// backend ships the `models` role key (navigation.md §1.2, shell audit M4).
// Flipping the gate happens in nav-config only — this guard follows it.
// The pages are client components, so the guard lives in this server layout.
import type { ReactNode } from "react";

import { guardRoute } from "@/lib/route-guard";

export default async function ModelsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (await guardRoute("models")) ?? children;
}
