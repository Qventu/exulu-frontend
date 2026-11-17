"use client";

/**
 * Tools & skills section — enabled-only. Three groups (sub-agents, skills,
 * tools) list what this agent has, with the configure / info affordances of
 * the tool card and a remove action. The catalogue (every tool, agent and
 * skill of the instance) lives behind each group's "Add …" button in a
 * searchable picker (components/add-items-dialog.tsx), so an agent with a
 * dozen tools no longer renders eighty cards.
 */

import { BookOpen, Layers, Network, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AgentTool } from "@/types/models/agent";
import type { ExuluTool } from "@/types/models/tool";

import { AddItemsDialog, type PickerKind } from "../components/add-items-dialog";
import { AgentToolWithDetails } from "../components/agent-hierarchy-view";
import { AgentToolCard } from "../components/agent-tool-card";
import { KB_EDITOR_TOOL_ID } from "../components/kb-editing/config-schema";
import { KbEditingConfigPanel } from "../components/kb-editing/kb-editing-config-panel";
import { ToolConfigurationElement } from "../components/tool-config-fields";
import type { EditorSectionProps } from "./types";

type SkillRef = { id: string; name: string; description?: string };

export function ToolsSection({ editor, refs }: EditorSectionProps) {
  const t = useTranslations("agents");
  const [sheetOpen, setSheetOpen] = React.useState<boolean | string>(false);
  const [picker, setPicker] = React.useState<PickerKind | null>(null);

  // The catalogue, split the way the groups are. The agentic search tool has
  // its own switch in the Knowledge section and never appears here.
  const { agentCatalogue, toolCatalogue } = React.useMemo(() => {
    const agents: ExuluTool[] = [];
    const tools: ExuluTool[] = [];
    for (const tool of refs.tools) {
      if (tool.id === "agentic_context_search") continue;
      (tool.category === "agents" ? agents : tools).push(tool);
    }
    return { agentCatalogue: agents, toolCatalogue: tools };
  }, [refs.tools]);

  const enabledIds = React.useMemo(() => new Set(editor.tools.map((t) => t.id)), [editor.tools]);
  const enabledSkillIds = React.useMemo(() => new Set(editor.skills.map((s) => s.id)), [editor.skills]);
  const byId = React.useMemo(() => new Map(refs.tools.map((t) => [t.id, t])), [refs.tools]);

  // Enabled entries in catalogue order; entries whose tool vanished from the
  // instance keep a minimal card so they can still be removed.
  const enabledAgents = agentCatalogue.filter((t) => enabledIds.has(t.id));
  const enabledTools = toolCatalogue.filter((t) => enabledIds.has(t.id));
  const orphanTools = editor.tools.filter((et) => !byId.has(et.id) && et.id !== "agentic_context_search");
  const enabledSkills: SkillRef[] = editor.skills.map((s) => refs.skills.find((r) => r.id === s.id) ?? s);

  const toolConfigEntry = (tool: ExuluTool): AgentTool => ({
    id: tool.id,
    type: tool.type as any,
    name: tool.name,
    config: tool.config?.map((c) => ({ name: c.name, variable: "", type: c.type as any })) || [],
  });

  const addTools = (tools: ExuluTool[]) => {
    editor.setTools([...editor.tools, ...tools.map(toolConfigEntry)]);
    const needsConfig = tools.filter((tool) => tool.config && tool.config.length > 0);
    if (needsConfig.length === 1) setSheetOpen(needsConfig[0]!.id);
  };
  const removeTool = (id: string) => editor.setTools(editor.tools.filter((t) => t.id !== id));
  const addSkills = (skills: SkillRef[]) => editor.setSkills([...editor.skills, ...skills.map((s) => ({ id: s.id, name: s.name }))]);
  const removeSkill = (id: string) => editor.setSkills(editor.skills.filter((s) => s.id !== id));

  const handleConfigUpdate = (toolId: string, value: any, name: string) => {
    editor.setTools(editor.tools.map((t) => (t.id === toolId ? { ...t, config: t.config.map((c) => (c.name === name ? { ...c, variable: value } : c)) } : t)));
  };

  const renderConfigElement = (tool: ExuluTool, config: any[], update: (value: any, name: string) => void) =>
    tool.id === KB_EDITOR_TOOL_ID ? (
      <KbEditingConfigPanel config={config as any} contexts={refs.contexts} update={update} />
    ) : (
      <ToolConfigurationElement tool={tool} config={config as any} variables={refs.variables} update={update} />
    );

  const cardProps = (tool: ExuluTool) => ({
    tool,
    isEnabled: true,
    config: editor.tools.find((et) => et.id === tool.id)?.config || [],
    onToggle: (enabled: boolean) => {
      if (!enabled) removeTool(tool.id);
    },
    onConfigUpdate: (value: any, name: string) => handleConfigUpdate(tool.id, value, name),
    sheetOpen,
    setSheetOpen,
    variables: refs.variables,
    renderConfigElement,
  });

  const groupHeader = (icon: React.ReactNode, title: string, hint: string, count: number, kind: PickerKind) => (
    <div className="flex items-center gap-2 border-b pb-2">
      <div className="rounded-md bg-muted p-1.5">{icon}</div>
      <div className="min-w-0">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Badge variant="secondary" className="ml-auto shrink-0">
        {count}
      </Badge>
      <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => setPicker(kind)}>
        <Plus aria-hidden="true" className="mr-1 size-4" />
        {kind === "tools" ? t("editor.tools.addTools") : kind === "agents" ? t("editor.tools.addSubAgents") : t("editor.tools.addSkills")}
      </Button>
    </div>
  );

  const empty = (text: string) => <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{text}</p>;

  return (
    <section id="tools" className="scroll-mt-20 space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{t("editor.sections.tools")}</h2>
        <p className="text-sm text-muted-foreground">{t("editor.tools.overview", { tools: enabledTools.length + orphanTools.length, skills: enabledSkills.length, agents: enabledAgents.length })}</p>
      </div>

      {refs.toolsLoading && refs.tools.length === 0 ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <>
          {/* Sub-agents */}
          <div className="space-y-3">
            {groupHeader(<Network className="size-4 text-primary" />, t("editor.tools.subAgents"), t("editor.tools.subAgentsHint"), enabledAgents.length, "agents")}
            {enabledAgents.length === 0 ? empty(t("editor.tools.emptySubAgents")) : <div className="space-y-2">{enabledAgents.map((tool) => <AgentToolWithDetails key={tool.id} {...cardProps(tool)} />)}</div>}
          </div>

          {/* Skills */}
          <div className="space-y-3">
            {groupHeader(<BookOpen className="size-4 text-muted-foreground" />, t("editor.tools.skills"), t("editor.tools.skillsHint"), enabledSkills.length, "skills")}
            {enabledSkills.length === 0 ? (
              empty(t("editor.tools.emptySkills"))
            ) : (
              <ul className="divide-y rounded-lg border">
                {enabledSkills.map((skill) => (
                  <li key={skill.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="rounded-md bg-muted p-2">
                      <BookOpen aria-hidden="true" className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{skill.name}</p>
                      {skill.description && <p className="line-clamp-2 text-sm text-muted-foreground">{skill.description}</p>}
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label={t("editor.tools.removeAria", { name: skill.name })} title={t("editor.tools.removeAria", { name: skill.name })} onClick={() => removeSkill(skill.id)}>
                      <X aria-hidden="true" className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tools */}
          <div className="space-y-3">
            {groupHeader(<Layers className="size-4 text-muted-foreground" />, t("editor.tools.tools"), t("editor.tools.toolsHint"), enabledTools.length + orphanTools.length, "tools")}
            {enabledTools.length === 0 && orphanTools.length === 0 ? (
              empty(t("editor.tools.emptyTools"))
            ) : (
              <div className="space-y-2">
                {enabledTools.map((tool) => (
                  <AgentToolCard key={tool.id} {...cardProps(tool)} />
                ))}
                {orphanTools.map((et) => (
                  <div key={et.id} className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium capitalize">{et.name?.replace(/_/g, " ") ?? et.id}</p>
                      <p className="text-sm text-muted-foreground">{t("editor.tools.orphanHint")}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label={t("editor.tools.removeAria", { name: et.name ?? et.id })} onClick={() => removeTool(et.id)}>
                      <X aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <AddItemsDialog kind="tools" open={picker === "tools"} onOpenChange={(o) => setPicker(o ? "tools" : null)} items={toolCatalogue} enabledIds={enabledIds} onAdd={addTools} loading={refs.toolsLoading} />
      <AddItemsDialog kind="agents" open={picker === "agents"} onOpenChange={(o) => setPicker(o ? "agents" : null)} items={agentCatalogue} enabledIds={enabledIds} onAdd={addTools} loading={refs.toolsLoading} />
      <AddItemsDialog kind="skills" open={picker === "skills"} onOpenChange={(o) => setPicker(o ? "skills" : null)} items={refs.skills} enabledIds={enabledSkillIds} onAdd={addSkills} />
    </section>
  );
}
