"use client";

/**
 * Client half of the /public/agents listing. The server page fetches the
 * agents and redirects; ALL translated copy renders here because server
 * pages must not call getTranslations (i18n/config.ts intentionally has no
 * next-intl server pathway — the house rule documented across
 * app/(application) pages).
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Lock, UserRound } from "lucide-react";

import type { PublicAgentMeta } from "@/lib/api/public-agents";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function PublicAgentsGrid({ agents }: { agents: PublicAgentMeta[] }) {
  const t = useTranslations("publicAgents");

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
                    (() => {
                      const label =
                        agent.guest_auth_mode === "password"
                          ? t("badgePassword")
                          : t("badgeLogin");
                      return (
                        <Badge variant="outline" aria-label={label} title={label}>
                          {agent.guest_auth_mode === "password" ? (
                            <Lock className="size-3" aria-hidden="true" />
                          ) : (
                            <UserRound className="size-3" aria-hidden="true" />
                          )}
                        </Badge>
                      );
                    })()
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
