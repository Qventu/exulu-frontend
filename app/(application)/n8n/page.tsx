import { guardRoute } from "@/lib/route-guard";

export default async function N8nPage() {

  // Route guard for /n8n (Automation) — gate from nav-config ("automation"):
  // (SA || role.workflows:r+) AND config.n8n.enabled (navigation.md §1.2).
  // When N8N_URL is unset the config flag is off and the guard renders the
  // shared AccessDenied (replaces the old hardcoded "N8n is not configured").
  const denied = await guardRoute("automation");
  if (denied) return denied;

  const n8n = {
    url: process.env.N8N_URL || "",
  }

  return (
    <div className="h-screen w-full flex flex-col">
      <iframe
        src={n8n.url}
        className="w-full h-full border-0"
        title="n8n Workflow Automation"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
