"use client";

/**
 * AgentToolCard — tool row + info/config sheet + sub-agent drill-down.
 *
 * Changes vs legacy (agents.md fixes):
 * - Responsive sheets: `w-full sm:max-w-[540px]` (kills the w-[400px]
 *   overflow at 390px, mobile audit).
 * - aria-labels on icon buttons + sub-agent metadata buttons reachable via
 *   tap-friendly Popovers, not hover-only Tooltips (responsive.md T7).
 * - Config-sheet auto-open-on-enable kept (item 64).
 * - Type/category/config badges kept (item 63).
 * - Sub-agent drill-down (item 61) switches from the nested AgentDetailsSheet
 *   to AgentDetailPanel (index-owned, content-only) wrapped in a responsive
 *   Sheet here. `hideActions` so the panel's footer doesn't bleed into the
 *   editor.
 */

import {
  AlertCircle,
  Bot,
  Info,
  Network,
  Settings,
  Sparkles,
  Wrench,
} from "lucide-react";
import * as React from "react";
import { useTranslations } from "next-intl";

import { AgentDetailPanel } from "@/app/(application)/agents/components/agent-detail-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ExuluTool } from "@/types/models/tool";

interface AgentToolCardProps {
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
  agentDetails?: {
    toolCount: number;
    subAgentCount: number;
    capabilities?: string[];
  };
  depth?: number;
}

export function AgentToolCard({
  tool,
  isEnabled,
  config,
  onToggle,
  onConfigUpdate,
  sheetOpen,
  setSheetOpen,
  variables,
  renderConfigElement,
  agentDetails,
  depth = 0,
}: AgentToolCardProps) {
  const t = useTranslations("agents");
  const tCommon = useTranslations("common");
  const [drillOpen, setDrillOpen] = React.useState(false);

  const isAgent = tool.category === "agents";
  const requiredConfigCount = tool.config?.length || 0;
  const filledConfigCount =
    config?.filter((c) => c.variable).length || 0;
  const hasEmptyConfigs =
    isEnabled &&
    requiredConfigCount > 0 &&
    filledConfigCount < requiredConfigCount;

  const borderColor = isAgent ? "border-l-primary" : "border-l-secondary";
  const iconBg = isAgent ? "bg-primary/10" : "bg-muted";
  const iconColor = isAgent ? "text-primary" : "text-muted-foreground";

  return (
    <div
      className={cn(
        "rounded-lg border border-l-4 transition-colors duration-150 hover:bg-muted/30 motion-reduce:transition-none",
        borderColor,
        isEnabled && isAgent && "bg-primary/5",
        depth > 0 && "ml-6 border-l-2",
      )}
      style={{
        marginLeft: depth > 0 ? `${depth * 1.5}rem` : undefined,
      }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("shrink-0 rounded-md p-2", iconBg)}>
            {isAgent ? (
              <Bot className={cn("size-4", iconColor)} />
            ) : (
              <Wrench className={cn("size-4", iconColor)} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-base font-medium capitalize">
                    {tool.name?.replace(/_/g, " ")}
                  </h4>

                  <Badge
                    variant={isAgent ? "default" : "outline"}
                    className="text-xs"
                  >
                    {isAgent ? (
                      <>
                        <Bot className="mr-1 size-3" />
                        {t("editor.tools.typeAgent")}
                      </>
                    ) : (
                      <>
                        <Wrench className="mr-1 size-3" />
                        {t("editor.tools.typeTool")}
                      </>
                    )}
                  </Badge>

                  <Badge variant="secondary" className="text-xs capitalize">
                    {tool.category}
                  </Badge>

                  {requiredConfigCount > 0 && isEnabled && (
                    <Badge
                      variant={hasEmptyConfigs ? "destructive" : "outline"}
                      className="text-xs"
                    >
                      {filledConfigCount}/{requiredConfigCount}
                      {hasEmptyConfigs && (
                        <AlertCircle className="ml-1 size-3" />
                      )}
                    </Badge>
                  )}
                </div>

                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {tool.description}
                </p>

                {/* Sub-agent metadata (tap-friendly popovers, T7). */}
                {isAgent && agentDetails && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {agentDetails.toolCount > 0 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-foreground md:min-h-0"
                          >
                            <Wrench className="size-3" />
                            <span>
                              {t("editor.tools.subAgentTools", {
                                count: agentDetails.toolCount,
                              })}
                            </span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 text-sm">
                          {t("editor.tools.subAgentToolsHint", {
                            count: agentDetails.toolCount,
                          })}
                        </PopoverContent>
                      </Popover>
                    )}
                    {agentDetails.subAgentCount > 0 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex min-h-11 items-center gap-1 text-xs text-primary hover:text-primary/80 md:min-h-0"
                          >
                            <Network className="size-3" />
                            <span>
                              {t("editor.tools.subAgentDelegates", {
                                count: agentDetails.subAgentCount,
                              })}
                            </span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 text-sm">
                          {t("editor.tools.subAgentDelegatesHint", {
                            count: agentDetails.subAgentCount,
                          })}
                        </PopoverContent>
                      </Popover>
                    )}
                    {agentDetails.capabilities &&
                      agentDetails.capabilities.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-foreground md:min-h-0"
                            >
                              <Sparkles className="size-3" />
                              <span>
                                {t("editor.tools.subAgentCapabilities", {
                                  count: agentDetails.capabilities.length,
                                })}
                              </span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 text-sm">
                            {agentDetails.capabilities.join(", ")}
                          </PopoverContent>
                        </Popover>
                      )}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Sheet
                  open={sheetOpen === tool.id}
                  onOpenChange={() =>
                    setSheetOpen(sheetOpen === tool.id ? false : tool.id)
                  }
                >
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={t("editor.tools.infoAria", {
                        name: tool.name,
                      })}
                    >
                      <Info className="size-4" />
                    </Button>
                  </SheetTrigger>

                  {requiredConfigCount > 0 && isEnabled && (
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "size-8",
                          hasEmptyConfigs && "text-destructive",
                        )}
                        aria-label={t("editor.tools.configureAria", {
                          name: tool.name,
                        })}
                      >
                        <Settings className="size-4" />
                      </Button>
                    </SheetTrigger>
                  )}

                  <SheetContent className="w-full overflow-y-auto sm:max-w-[540px]">
                    <SheetHeader>
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "rounded-md p-2",
                            isAgent ? "bg-primary/10" : "bg-muted",
                          )}
                        >
                          {isAgent ? (
                            <Bot className="size-5 text-primary" />
                          ) : (
                            <Wrench className="size-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <SheetTitle className="capitalize">
                            {tool.name?.replace(/_/g, " ")}
                          </SheetTitle>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge
                              variant={isAgent ? "default" : "outline"}
                              className="text-xs"
                            >
                              {isAgent
                                ? t("editor.tools.typeAgent")
                                : t("editor.tools.typeTool")}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="text-xs capitalize"
                            >
                              {tool.category}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <SheetDescription className="mt-4">
                        {tool.description}
                      </SheetDescription>
                    </SheetHeader>

                    <div className="space-y-6 py-6">
                      {tool.config && tool.config.length > 0 && isEnabled && (
                        <div className="space-y-4">
                          <div className="text-sm font-medium">
                            {t("editor.tools.configuration")}
                          </div>
                          {renderConfigElement(
                            tool,
                            config,
                            onConfigUpdate,
                          )}
                        </div>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>

                <Switch
                  checked={isEnabled}
                  onCheckedChange={onToggle}
                  aria-label={t("editor.tools.toggleAria", { name: tool.name })}
                  className="ml-2"
                />
              </div>
            </div>

            {/* Sub-agent drill-down — uses AgentDetailPanel inside a sheet. */}
            {isAgent &&
              agentDetails &&
              (agentDetails.toolCount > 0 ||
                agentDetails.subAgentCount > 0) &&
              isEnabled && (
                <>
                  <Button
                    type="button"
                    onClick={() => setDrillOpen(true)}
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 gap-1 px-2 text-xs"
                  >
                    {t("editor.tools.showSubAgent")}
                  </Button>
                  <Sheet open={drillOpen} onOpenChange={setDrillOpen}>
                    <SheetContent className="w-full overflow-y-auto sm:max-w-[540px]">
                      <SheetHeader>
                        <SheetTitle>{tool.name?.replace(/_/g, " ")}</SheetTitle>
                        <SheetDescription>
                          {t("editor.tools.subAgentSheetDescription")}
                        </SheetDescription>
                      </SheetHeader>
                      <div className="py-6">
                        <AgentDetailPanel
                          agentId={tool.id}
                          canEdit={true}
                          hideActions
                        />
                      </div>
                    </SheetContent>
                  </Sheet>
                </>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
