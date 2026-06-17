"use client";

/**
 * AgentHierarchyView — Sub-Agents / Tools / Skills groups.
 *
 * Changes vs legacy:
 * - Accepts `collapsedCategories` + `onCategoryToggle` from the consumer and
 *   renders tool categories as Accordion groups — this is what makes item 59
 *   ("Expand all / Collapse all") REAL (it was dead in the legacy form, since
 *   the state was created but never consumed here — agents.md review #5).
 * - Uses the editor-local GET_SUB_AGENT_SUMMARY (not the monolith
 *   GET_AGENT_BY_ID — the editor stops importing from queries/queries.ts).
 *   Behavior identical: a lite agentById fetch per enabled sub-agent.
 * - Drill-down now goes through AgentDetailPanel (item 61) inside the tool
 *   card's responsive Sheet.
 */

import { useQuery } from "@apollo/client";
import { BookOpen, Layers, Network } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { ExuluTool } from "@/types/models/tool";

import { GET_SUB_AGENT_SUMMARY } from "../queries";
import { AgentToolCard } from "./agent-tool-card";

interface AgentHierarchyViewProps {
  tools: ExuluTool[];
  enabledTools: any[];
  onToggle: (tool: ExuluTool, enabled: boolean) => void;
  onConfigUpdate: (toolId: string, value: any, name: string) => void;
  sheetOpen: boolean | string;
  setSheetOpen: (open: boolean | string) => void;
  variables: any[];
  renderConfigElement: (
    tool: ExuluTool,
    config: any[],
    update: (value: any, name: string) => void,
  ) => React.ReactNode;
  skills?: { id: string; name: string; description?: string }[];
  enabledSkills?: { id: string; name: string }[];
  onSkillToggle?: (
    skill: { id: string; name: string; description?: string },
    enabled: boolean,
  ) => void;
  /** Category names currently collapsed (item 59 — wired). */
  collapsedCategories: Set<string>;
  onCategoryToggle: (category: string, collapsed: boolean) => void;
}

export function AgentHierarchyView({
  tools,
  enabledTools,
  onToggle,
  onConfigUpdate,
  sheetOpen,
  setSheetOpen,
  variables,
  renderConfigElement,
  skills = [],
  enabledSkills = [],
  onSkillToggle,
  collapsedCategories,
  onCategoryToggle,
}: AgentHierarchyViewProps) {
  const t = useTranslations("agents");

  // Item 68: exclusions kept (agentic_context_search has its own section).
  const { agentTools, regularToolsByCategory } = React.useMemo(() => {
    const agents: ExuluTool[] = [];
    const grouped: Record<string, ExuluTool[]> = {};
    tools.forEach((tool) => {
      if (tool.id === "agentic_context_search") return;
      if (tool.category === "agents") {
        agents.push(tool);
        return;
      }
      const cat = tool.category || "other";
      (grouped[cat] = grouped[cat] || []).push(tool);
    });
    return { agentTools: agents, regularToolsByCategory: grouped };
  }, [tools]);

  const categoryNames = Object.keys(regularToolsByCategory).sort();
  // Accordion's `value` is the OPEN list — invert collapsed.
  const openCategories = categoryNames.filter(
    (c) => !collapsedCategories.has(c),
  );

  return (
    <div className="space-y-6">
      {/* Sub-Agents (item 61) */}
      {agentTools.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b pb-2">
            <div className="rounded-md bg-primary/10 p-1.5">
              <Network className="size-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium">
                {t("editor.tools.subAgents")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("editor.tools.subAgentsHint")}
              </p>
            </div>
            <Badge variant="secondary" className="ml-auto">
              {t("editor.tools.enabledCount", {
                enabled: agentTools.filter((t) =>
                  enabledTools.some((et) => et.id === t.id),
                ).length,
                total: agentTools.length,
              })}
            </Badge>
          </div>

          <div className="space-y-2">
            {agentTools.map((tool) => (
              <AgentToolWithDetails
                key={tool.id}
                tool={tool}
                isEnabled={enabledTools.some((et) => et.id === tool.id)}
                config={
                  enabledTools.find((et) => et.id === tool.id)?.config || []
                }
                onToggle={(enabled) => onToggle(tool, enabled)}
                onConfigUpdate={(value, name) =>
                  onConfigUpdate(tool.id, value, name)
                }
                sheetOpen={sheetOpen}
                setSheetOpen={setSheetOpen}
                variables={variables}
                renderConfigElement={renderConfigElement}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tools — Accordion groups, one per category (item 59 wired) */}
      {categoryNames.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b pb-2">
            <div className="rounded-md bg-muted p-1.5">
              <Layers className="size-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-medium">{t("editor.tools.tools")}</h3>
              <p className="text-xs text-muted-foreground">
                {t("editor.tools.toolsHint")}
              </p>
            </div>
            <Badge variant="outline" className="ml-auto">
              {t("editor.tools.enabledCount", {
                enabled: Object.values(regularToolsByCategory)
                  .flat()
                  .filter((t) => enabledTools.some((et) => et.id === t.id))
                  .length,
                total: Object.values(regularToolsByCategory).flat().length,
              })}
            </Badge>
          </div>

          <Accordion
            type="multiple"
            value={openCategories}
            onValueChange={(open) => {
              // Translate the OPEN list back to per-category toggles.
              const openSet = new Set(open);
              categoryNames.forEach((cat) => {
                const isCollapsed = !openSet.has(cat);
                const wasCollapsed = collapsedCategories.has(cat);
                if (isCollapsed !== wasCollapsed) {
                  onCategoryToggle(cat, isCollapsed);
                }
              });
            }}
            className="space-y-2"
          >
            {categoryNames.map((category) => {
              const catTools = regularToolsByCategory[category];
              return (
                <AccordionItem
                  key={category}
                  value={category}
                  className="rounded-lg border"
                >
                  <AccordionTrigger className="px-4 py-3 text-sm font-medium capitalize hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span>{category}</span>
                      <Badge variant="outline" className="text-xs">
                        {
                          catTools.filter((t) =>
                            enabledTools.some((et) => et.id === t.id),
                          ).length
                        }
                        /{catTools.length}
                      </Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-2">
                      {catTools.map((tool) => (
                        <AgentToolCard
                          key={tool.id}
                          tool={tool}
                          isEnabled={enabledTools.some(
                            (et) => et.id === tool.id,
                          )}
                          config={
                            enabledTools.find((et) => et.id === tool.id)
                              ?.config || []
                          }
                          onToggle={(enabled) => onToggle(tool, enabled)}
                          onConfigUpdate={(value, name) =>
                            onConfigUpdate(tool.id, value, name)
                          }
                          sheetOpen={sheetOpen}
                          setSheetOpen={setSheetOpen}
                          variables={variables}
                          renderConfigElement={renderConfigElement}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      )}

      {/* Skills (item 66) */}
      {skills.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b pb-2">
            <div className="rounded-md bg-muted p-1.5">
              <BookOpen className="size-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-medium">
                {t("editor.tools.skills")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("editor.tools.skillsHint")}
              </p>
            </div>
            <Badge variant="outline" className="ml-auto">
              {t("editor.tools.enabledCount", {
                enabled: enabledSkills.length,
                total: skills.length,
              })}
            </Badge>
          </div>

          <div className="space-y-2">
            {skills.map((skill) => {
              const isEnabled = enabledSkills.some((es) => es.id === skill.id);
              return (
                <div
                  key={skill.id}
                  className="flex items-center justify-between rounded-lg border border-l-4 border-l-primary/60 p-3"
                >
                  <div className="mr-3 flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">
                      {skill.name}
                    </span>
                    {skill.description && (
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {skill.description}
                      </span>
                    )}
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(enabled) =>
                      onSkillToggle?.(skill, enabled)
                    }
                    aria-label={skill.name}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Wrapper that fetches per-sub-agent summary via the editor-local query
 * (replaces monolith GET_AGENT_BY_ID — work-item route-colocation rule).
 */
function AgentToolWithDetails({
  tool,
  isEnabled,
  config,
  onToggle,
  onConfigUpdate,
  sheetOpen,
  setSheetOpen,
  variables,
  renderConfigElement,
}: {
  tool: ExuluTool;
  isEnabled: boolean;
  config: any[];
  onToggle: (enabled: boolean) => void;
  onConfigUpdate: (value: any, name: string) => void;
  sheetOpen: boolean | string;
  setSheetOpen: (open: boolean | string) => void;
  variables: any[];
  renderConfigElement: (
    tool: ExuluTool,
    config: any[],
    update: (value: any, name: string) => void,
  ) => React.ReactNode;
}) {
  const { data } = useQuery(GET_SUB_AGENT_SUMMARY, {
    variables: { id: tool.id },
    skip: !isEnabled || tool.category !== "agents",
  });

  const agentDetails = React.useMemo(() => {
    if (!data?.agentById) return undefined;
    const agentData = data.agentById;
    let toolsArray: any[] = [];
    try {
      toolsArray =
        typeof agentData.tools === "string"
          ? JSON.parse(agentData.tools)
          : agentData.tools || [];
    } catch {
      // ignore
    }
    const subAgentCount = toolsArray.filter((t: any) => {
      if (typeof t === "string") return false;
      return t.category === "agents" || t.type === "agent";
    }).length;
    const toolCount = toolsArray.length - subAgentCount;
    return {
      toolCount,
      subAgentCount,
      capabilities: agentData.capabilities || [],
    };
  }, [data]);

  return (
    <AgentToolCard
      tool={tool}
      isEnabled={isEnabled}
      config={config}
      onToggle={onToggle}
      onConfigUpdate={onConfigUpdate}
      sheetOpen={sheetOpen}
      setSheetOpen={setSheetOpen}
      variables={variables}
      renderConfigElement={renderConfigElement}
      agentDetails={agentDetails}
    />
  );
}
