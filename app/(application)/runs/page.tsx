/**
 * /runs — global runs console (email-routines design §7.3). Thin server
 * page; the guard lives in layout.tsx. `?workflow=<id>` (used by the chat
 * run banner) pre-scopes the list to one routine.
 */
import { RunsClient } from "./runs-client";

export const dynamic = "force-dynamic";

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ workflow?: string }>;
}) {
  const { workflow } = await searchParams;
  return <RunsClient workflow={workflow} />;
}
