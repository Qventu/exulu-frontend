"use client";

/**
 * AgentDetailPanel — the evolved L2 agent details surface (work item 2.8,
 * inventory items 22-28a; binding contract `AgentDetailPanelProps`).
 *
 * CONTENT-ONLY: no Sheet wrapper. Consumers supply the container —
 * the index mounts it inside ListDetail's detail slot (sheet presentation),
 * the editor's sub-agent drill-down mounts it in its own Sheet (item 61),
 * replacing the legacy AgentDetailsSheet (whose fixed w-[400px] overflowed a
 * 390px viewport and whose Safety section was blind — agents.md reviews
 * #2/#16 + mobile audit).
 *
 * Sections: identity (image/monogram, name, StatusDot, model badge),
 * description, capability tiles (semantic tokens, never bg-gray-500 — fixes
 * #14; MIME lists in tap-friendly Popovers, responsive.md T7), enabled tools
 * with count badge, Safety (REAL firewall read via GET_AGENT_DETAIL, item 27),
 * Access (real rights_mode labels, no fake "Open" — fixes #16), footer:
 * "Open in chat" → /chat/{id}/new (link, NO session creation) + "Edit agent"
 * → /agents/edit/{id}. Loading renders a panel-shaped skeleton mirroring this
 * layout (item 28a — no centered spinner, philosophy §6).
 */

import { useQuery } from "@apollo/client";
import {
  FileText,
  Image as ImageIcon,
  MessageCircle,
  Pencil,
  Shield,
  Text,
  Users,
  Video,
  Volume2,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";

import { EmptyState } from "@/components/primitives/empty-state";
import { StatusDot } from "@/components/primitives/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/models/agent";
import type { ExuluTool } from "@/types/models/tool";

import {
  AGENT_FIREWALL_SUPPORTED,
  GET_AGENT_DETAIL,
  GET_AGENT_DETAIL_TOOLS,
} from "../queries";

export interface AgentDetailPanelProps {
  agentId: string;
  /** Gate for the "Edit agent" footer action (index passes the RBAC write
   * predicate; the editor passes true). */
  canEdit: boolean;
  /** The editor's nested drill-down hides the Open-in-chat/Edit footer. */
  hideActions?: boolean;
}

const SCANNER_KEYS = [
  "promptGuard",
  "codeShield",
  "agentAlignment",
  "hiddenAscii",
  "piiDetection",
] as const;

type FirewallShape = {
  enabled?: boolean;
  scanners?: Partial<Record<(typeof SCANNER_KEYS)[number], boolean>>;
};

/** The firewall column is a JSON scalar — tolerate both object and string. */
function parseFirewall(value: unknown): FirewallShape | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as FirewallShape;
    } catch {
      return undefined;
    }
  }
  if (typeof value === "object") return value as FirewallShape;
  return undefined;
}

const RIGHTS_MODES = ["private", "users", "roles", "teams", "public"] as const;

export function AgentDetailPanel({
  agentId,
  canEdit,
  hideActions = false,
}: AgentDetailPanelProps) {
  const t = useTranslations("agents");
  const tCommon = useTranslations("common");

  const {
    data: agentData,
    loading: agentLoading,
    error: agentError,
    refetch: refetchAgent,
  } = useQuery<{ agentById: Agent }>(GET_AGENT_DETAIL, {
    variables: { id: agentId },
    fetchPolicy: "cache-first",
    nextFetchPolicy: "network-only",
  });

  const {
    data: toolsData,
    loading: toolsLoading,
    error: toolsError,
    refetch: refetchTools,
  } = useQuery<{ tools: { items: ExuluTool[] } }>(GET_AGENT_DETAIL_TOOLS, {
    fetchPolicy: "cache-first",
    nextFetchPolicy: "network-only",
  });

  const agent = agentData?.agentById;
  const allTools = toolsData?.tools?.items;

  if (agentError || toolsError) {
    return (
      <EmptyState
        variant="error"
        title={tCommon("somethingWentWrong")}
        description={(agentError ?? toolsError)?.message}
        action={{
          label: tCommon("retry"),
          onClick: () => {
            if (agentError) void refetchAgent();
            if (toolsError) void refetchTools();
          },
        }}
      />
    );
  }

  if (agentLoading || toolsLoading || !agent || !allTools) {
    return <PanelSkeleton />;
  }

  // agent.tools may arrive as a legacy string[] (form.tsx:239-242) — normalize.
  const enabledToolIds = new Set(
    (agent.tools ?? []).map((tool) =>
      typeof tool === "string" ? tool : tool.id,
    ),
  );
  const enabledTools = allTools.filter((tool) => enabledToolIds.has(tool.id));

  const firewall = parseFirewall(agent.firewall);
  const activeScanners = SCANNER_KEYS.filter(
    (key) => firewall?.scanners?.[key],
  );

  const rightsMode =
    agent.rights_mode &&
    (RIGHTS_MODES as readonly string[]).includes(agent.rights_mode)
      ? agent.rights_mode
      : "unknown";

  const capabilities = [
    {
      key: "text" as const,
      icon: Text,
      label: t("detailsSheet.capabilityLabels.text"),
      enabled: !!agent.capabilities?.text,
      detail: agent.capabilities?.text
        ? tCommon("enabled")
        : t("detailsSheet.capabilityLabels.none"),
    },
    {
      key: "images" as const,
      icon: ImageIcon,
      label: t("detailsSheet.capabilityLabels.images"),
      enabled: !!agent.capabilities?.images?.length,
      detail: agent.capabilities?.images?.length
        ? agent.capabilities.images.join(", ")
        : t("detailsSheet.capabilityLabels.none"),
    },
    {
      key: "files" as const,
      icon: FileText,
      label: t("detailsSheet.capabilityLabels.files"),
      enabled: !!agent.capabilities?.files?.length,
      detail: agent.capabilities?.files?.length
        ? agent.capabilities.files.join(", ")
        : t("detailsSheet.capabilityLabels.none"),
    },
    {
      key: "audio" as const,
      icon: Volume2,
      label: t("detailsSheet.capabilityLabels.audio"),
      enabled: !!agent.capabilities?.audio?.length,
      detail: agent.capabilities?.audio?.length
        ? agent.capabilities.audio.join(", ")
        : t("detailsSheet.capabilityLabels.none"),
    },
    {
      key: "video" as const,
      icon: Video,
      label: t("detailsSheet.capabilityLabels.video"),
      enabled: !!agent.capabilities?.video?.length,
      detail: agent.capabilities?.video?.length
        ? agent.capabilities.video.join(", ")
        : t("detailsSheet.capabilityLabels.none"),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Identity (item 23) */}
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
          {agent.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={agent.image}
              alt=""
              className="size-full rounded-full object-cover"
            />
          ) : (
            // Monogram fallback (item 14)
            <span aria-hidden="true" className="text-2xl font-semibold text-primary">
              {agent.name?.charAt(0).toUpperCase() || "A"}
            </span>
          )}
        </span>
        <div className="space-y-1.5">
          <h3 className="text-lg font-semibold">{agent.name}</h3>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <StatusDot
              status={agent.active ? "success" : "muted"}
              label={agent.active ? tCommon("active") : tCommon("inactive")}
            />
            <Badge variant="outline">
              {agent.modelName || t("detailsSheet.noModelSelected")}
            </Badge>
          </div>
        </div>
      </div>

      {/* Description (item 24) */}
      <section>
        <h4 className="mb-2 text-sm font-medium">
          {t("detailsSheet.description")}
        </h4>
        <p className="text-sm text-muted-foreground">
          {agent.description || t("detailsSheet.noDescriptionAvailable")}
        </p>
      </section>

      {/* Capabilities (item 25 — semantic tokens + tap Popovers, T7) */}
      <section>
        <h4 className="mb-3 text-sm font-medium">
          {t("detailsSheet.capabilities")}
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          {capabilities.map(({ key, icon: Icon, label, enabled, detail }) => (
            <Popover key={key}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`${label}: ${detail}`}
                  className={cn(
                    "flex size-11 items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:size-10",
                    enabled
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto max-w-xs p-3">
                <p className="text-sm">
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground">: {detail}</span>
                </p>
              </PopoverContent>
            </Popover>
          ))}
        </div>
      </section>

      {/* Tools (item 26) */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Wrench aria-hidden="true" className="size-4" />
          <h4 className="text-sm font-medium">{t("detailsSheet.tools")}</h4>
          <Badge variant="outline" className="text-xs">
            {enabledTools.length}/{allTools.length}
          </Badge>
        </div>
        {enabledTools.length > 0 ? (
          <ul className="space-y-2">
            {enabledTools.map((tool) => (
              <li
                key={tool.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{tool.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {tool.type}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {tCommon("enabled")}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("detailsSheet.noToolsEnabled")}
          </p>
        )}
      </section>

      {/* Safety (item 27 — REAL firewall state; the legacy sheet was blind) */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Shield aria-hidden="true" className="size-4" />
          <h4 className="text-sm font-medium">{t("detailsSheet.security")}</h4>
          {AGENT_FIREWALL_SUPPORTED ? (
            <Badge
              variant={firewall?.enabled ? "default" : "outline"}
              className="text-xs"
            >
              {firewall?.enabled
                ? t("detailsSheet.protected")
                : t("detailsSheet.unprotected")}
            </Badge>
          ) : null}
        </div>
        {!AGENT_FIREWALL_SUPPORTED ? (
          // Honest fallback (contracts §5): never fake "Unprotected".
          <p className="text-sm text-muted-foreground">
            {t("detailPanel.firewallUnsupported")}
          </p>
        ) : firewall?.enabled && activeScanners.length > 0 ? (
          <ul className="space-y-2">
            {activeScanners.map((scanner) => (
              <li
                key={scanner}
                className="flex items-center justify-between gap-2 rounded-md border p-2"
              >
                <span className="text-sm">
                  {t(`detailsSheet.scanners.${scanner}`)}
                </span>
                <Badge variant="default" className="shrink-0 text-xs">
                  {t("detailsSheet.active")}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Access (item 28 — real mode names, no "Open" fallback) */}
      <section>
        <div className="flex items-center gap-2">
          <Users aria-hidden="true" className="size-4" />
          <h4 className="text-sm font-medium">
            {t("detailsSheet.accessControl")}
          </h4>
          <Badge variant="outline" className="text-xs">
            {t(`rightsMode.${rightsMode}`)}
          </Badge>
        </div>
      </section>

      {/* Footer actions (items 20/21) — hidden in the editor drill-down. */}
      {!hideActions ? (
        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
          <Button asChild variant="outline" className="sm:flex-1">
            <Link href={`/chat/${agent.id}/new`}>
              <MessageCircle aria-hidden="true" className="mr-2 size-4" />
              {t("openInChat")}
            </Link>
          </Button>
          {canEdit ? (
            <Button asChild className="sm:flex-1">
              <Link href={`/agents/edit/${agent.id}`}>
                <Pencil aria-hidden="true" className="mr-2 size-4" />
                {t("editAgent")}
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Panel-shaped skeleton mirroring the layout above (item 28a). */
function PanelSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-5 w-32" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="size-11 rounded-md md:size-10" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-md" />
        ))}
      </div>
      <div className="flex flex-col gap-2 pt-4 sm:flex-row">
        <Skeleton className="h-9 w-full sm:flex-1" />
        <Skeleton className="h-9 w-full sm:flex-1" />
      </div>
    </div>
  );
}
