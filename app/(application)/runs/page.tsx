/**
 * /runs — redirect stub. The global runs console lives on /workflows
 * underneath the routines table; scoped links land on the routine subpage's
 * anchored runs section. The URL shipped publicly, so it must keep resolving.
 * No guard: both destinations guard themselves.
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ workflow?: string }>;
}) {
  const { workflow } = await searchParams;
  redirect(
    workflow
      ? `/workflows/${encodeURIComponent(workflow)}#runs`
      : "/workflows",
  );
}
