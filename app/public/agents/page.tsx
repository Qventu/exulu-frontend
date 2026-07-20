import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { fetchPublicAgents } from "@/lib/api/public-agents";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CenteredNote } from "./components/centered-note";

export const dynamic = "force-dynamic";

export default async function PublicAgentsPage() {
  const t = await getTranslations("publicAgents");
  const agents = await fetchPublicAgents();

  if (agents === null) {
    return (
      <CenteredNote
        title={t("misconfigured.title")}
        description={t("misconfigured.description")}
      />
    );
  }
  if (agents.length === 0) {
    return (
      <CenteredNote title={t("empty.title")} description={t("empty.description")} />
    );
  }
  if (agents.length === 1) {
    redirect(`/public/agents/${encodeURIComponent(agents[0].id)}`);
  }

  return (
    <main className="mx-auto w-full max-w-4xl grow px-4 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("listTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("listDescription")}</p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            href={`/public/agents/${encodeURIComponent(agent.id)}`}
            className="group focus-visible:outline-none"
          >
            <Card className="h-full transition-colors group-hover:border-primary/50 group-focus-visible:ring-2 group-focus-visible:ring-ring">
              <CardContent className="flex items-start gap-4 p-4">
                {/* agent.image is an S3 key; resolving it requires an
                    authenticated presigned-URL endpoint (getPresignedUrl)
                    which is unavailable on unauthenticated public pages.
                    Use the initial-letter avatar as a safe fallback. */}
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-medium">
                  {agent.name.charAt(0)}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium">{agent.name}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {agent.description}
                  </p>
                  {agent.guest_auth_mode !== "public" ? (
                    <Badge variant="outline">
                      {agent.guest_auth_mode === "password" ? "🔒" : "👤"}
                    </Badge>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
