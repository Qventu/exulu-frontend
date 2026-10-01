"use client";

/**
 * Knowledge base and agents section (settings design doc §5; fix round 1,
 * critical). Lists agents whose retrieval config includes `transcriptions`
 * and whether each may only read it or also write to it, plus a link into
 * Knowledge for the `transcriptions` context. Data/derivation lives in
 * `./knowledge.ts` — this file is render-only.
 */
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { AgentKnowledgeRow } from "./knowledge";

export interface KnowledgeSectionProps {
  agents: AgentKnowledgeRow[];
  loading: boolean;
  error?: Error;
}

export function KnowledgeSection({ agents, loading, error }: KnowledgeSectionProps) {
  const t = useTranslations("transcriptions");

  return (
    <>
      <p className="text-xs text-muted-foreground">{t("settings.knowledge.description")}</p>

      {error ? (
        <p className="text-sm text-destructive">{t("settings.knowledge.loadError")}</p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">{t("settings.knowledge.loading")}</p>
      ) : agents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("settings.knowledge.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {agents.map((agent) => (
            <li
              key={agent.id}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
            >
              <span className="truncate text-sm font-medium">{agent.name}</span>
              <Badge variant={agent.access === "write" ? "secondary" : "outline"}>
                {agent.access === "write"
                  ? t("settings.knowledge.canWrite")
                  : t("settings.knowledge.canRead")}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="outline" size="sm" className="self-start" asChild>
        <Link href="/data/transcriptions">
          <ExternalLink aria-hidden="true" className="mr-2 size-4" />
          {t("settings.knowledge.openInKnowledge")}
        </Link>
      </Button>
    </>
  );
}
