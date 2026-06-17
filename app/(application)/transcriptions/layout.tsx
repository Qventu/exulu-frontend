// Server-side route guard for /transcriptions — gate from nav-config
// ("transcripts"): all users AND config.transcription.enabled (navigation.md
// §1.2/§1.3 rule 5: nav-hidden must imply route-guarded — with the flag off
// the entry is hidden for everyone, so the URL must deny too). The page is a
// client component, so the guard lives in this server layout and renders
// AccessDenied instead of children when the feature is switched off.
import type { ReactNode } from "react";

import { guardRoute } from "@/lib/route-guard";

export default async function TranscriptionsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (await guardRoute("transcripts")) ?? children;
}
