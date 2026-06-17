"use client";

/**
 * Tools & skills section — items 57 (debounced search + clear), 58 (category
 * filter + clear), 59 (Expand/Collapse all WIRED to Accordion state — review
 * #5 dead-button repair), 60/60a (found/available + enabled counts), 61-66
 * via AgentHierarchyView + AgentToolCard, 67 (empty state + clear filters),
 * 68 (self/agentic exclusions kept in useEditorReferenceData).
 *
 * Toolbar wraps below md (search full-width, T4).
 */

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AgentTool } from "@/types/models/agent";
import type { ExuluTool } from "@/types/models/tool";

import { AgentHierarchyView } from "../components/agent-hierarchy-view";
import { ToolConfigurationElement } from "../components/tool-config-fields";
import type { EditorSectionProps } from "./types";

export function ToolsSection({ editor, refs }: EditorSectionProps) {
  const t = useTranslations("agents");

  const [sheetOpen, setSheetOpen] = React.useState<boolean | string>(false);
  const [collapsedCategories, setCollapsedCategories] = React.useState<
    Set<string>
  >(new Set());

  // Initialize ALL categories as collapsed when data loads (legacy default).
  const categoryNamesKey = React.useMemo(() => {
    const set = new Set<string>();
    refs.tools.forEach((t) => {
      if (t.id === "agentic_context_search") return;
      if (t.category === "agents") return;
      set.add(t.category || "other");
    });
    return Array.from(set).sort().join("|");
  }, [refs.tools]);

  React.useEffect(() => {
    if (!categoryNamesKey) return;
    setCollapsedCategories(new Set(categoryNamesKey.split("|")));
  }, [categoryNamesKey]);

  const handleCategoryToggle = (category: string, collapsed: boolean) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (collapsed) next.add(category);
      else next.delete(category);
      return next;
    });
  };

  const handleExpandAll = () => setCollapsedCategories(new Set());
  const handleCollapseAll = () =>
    setCollapsedCategories(new Set(categoryNamesKey.split("|")));

  const clearFilters = () => {
    refs.setToolSearch("");
    refs.setToolCategory("all");
  };

  const handleToolToggle = (tool: ExuluTool, enabled: boolean) => {
    if (enabled) {
      const newToolConfig: AgentTool = {
        id: tool.id,
        type: tool.type as any,
        name: tool.name,
        config:
          tool.config?.map((c) => ({
            name: c.name,
            variable: "",
            type: c.type as any,
          })) || [],
      };
      editor.setTools([...editor.tools, newToolConfig]);
      // Auto-open the config sheet when enabling a configurable tool (item 64).
      if (tool.config && tool.config.length > 0) {
        setSheetOpen(tool.id);
      }
    } else {
      editor.setTools(editor.tools.filter((t) => t.id !== tool.id));
    }
  };

  const handleConfigUpdate = (toolId: string, value: any, name: string) => {
    editor.setTools(
      editor.tools.map((t) =>
        t.id === toolId
          ? {
              ...t,
              config: t.config.map((c) =>
                c.name === name ? { ...c, variable: value } : c,
              ),
            }
          : t,
      ),
    );
  };

  const handleSkillToggle = (
    skill: { id: string; name: string; description?: string },
    enabled: boolean,
  ) => {
    if (enabled) {
      editor.setSkills([
        ...editor.skills,
        { id: skill.id, name: skill.name },
      ]);
    } else {
      editor.setSkills(editor.skills.filter((s) => s.id !== skill.id));
    }
  };

  const hasFilter =
    refs.toolSearch.length > 0 || refs.toolCategory !== "all";
  const noResults = refs.tools.length === 0 && hasFilter;

  return (
    <section id="tools" className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{t("editor.sections.tools")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("editor.tools.summary", { count: editor.tools.length })}
        </p>
      </div>

      {/* Toolbar — search (full width below md), category, expand/collapse */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("editor.tools.searchPlaceholder")}
            value={refs.toolSearch}
            onChange={(e) => refs.setToolSearch(e.target.value)}
            className="pl-10 pr-10"
          />
          {refs.toolSearch && (
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
              onClick={() => refs.setToolSearch("")}
              aria-label={t("editor.tools.clearSearchAria")}
            >
              <X className="size-3" />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={refs.toolCategory}
            onValueChange={refs.setToolCategory}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue
                placeholder={t("editor.tools.categoryPlaceholder")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("editor.tools.allCategories")}
              </SelectItem>
              {refs.categories.map((category) => (
                <SelectItem
                  key={category}
                  value={category}
                  className="capitalize"
                >
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilter && (
            <Button
              variant="outline"
              type="button"
              size="sm"
              onClick={clearFilters}
              aria-label={t("editor.tools.clearFiltersAria")}
            >
              <X className="size-4" />
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExpandAll}
          >
            {t("editor.tools.expandAll")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCollapseAll}
          >
            {t("editor.tools.collapseAll")}
          </Button>

          <p className="ml-auto text-sm text-muted-foreground">
            {t("editor.tools.resultCount", {
              count: refs.toolsTotal,
              suffix: hasFilter
                ? t("editor.tools.found")
                : t("editor.tools.available"),
            })}
          </p>
        </div>
      </div>

      <AgentHierarchyView
        tools={refs.tools}
        enabledTools={editor.tools}
        onToggle={handleToolToggle}
        onConfigUpdate={handleConfigUpdate}
        sheetOpen={sheetOpen}
        setSheetOpen={setSheetOpen}
        variables={refs.variables}
        renderConfigElement={(tool, config, update) => (
          <ToolConfigurationElement
            tool={tool}
            config={config as any}
            variables={refs.variables}
            update={update}
          />
        )}
        skills={refs.skills}
        enabledSkills={editor.skills}
        onSkillToggle={handleSkillToggle}
        collapsedCategories={collapsedCategories}
        onCategoryToggle={handleCategoryToggle}
      />

      {noResults && (
        <div className="rounded-md border py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t("editor.tools.noResults")}
          </p>
          <Button
            variant="outline"
            size="sm"
            type="button"
            className="mt-2"
            onClick={clearFilters}
          >
            {t("editor.tools.clearFilters")}
          </Button>
        </div>
      )}
    </section>
  );
}
