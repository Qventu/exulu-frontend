"use client";

/**
 * Scope badge — keys-token.md §3 "Scope is honest and quiet":
 * - Agents keys: plain `secondary` badge "Agents (n)".
 * - Admin keys: `outline` badge with a small filled dot in `text-foreground`
 *   (no extra purple) — full-access credentials are the risk on this page and
 *   earn the one touch of weight (philosophy §4).
 * No tooltip-only information: the allowlist lives in the detail panel (T7).
 */

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

import type { ApiKeyRow } from "../hooks";

export function ScopeBadge({ apiKey }: { apiKey: ApiKeyRow }) {
  const t = useTranslations("keys");
  const isAgentsScoped = apiKey.scope_mode === "agents";

  if (isAgentsScoped) {
    const count = Array.isArray(apiKey.agent_ids) ? apiKey.agent_ids.length : 0;
    return (
      <Badge variant="secondary" className="font-medium">
        {t("scopeAgents", { count })}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1.5 font-medium">
      <span
        aria-hidden="true"
        className="inline-block size-1.5 shrink-0 rounded-full bg-foreground"
      />
      {t("scopeAdmin")}
    </Badge>
  );
}
