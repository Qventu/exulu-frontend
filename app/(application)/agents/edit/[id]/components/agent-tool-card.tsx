"use client";

import { useState } from "react";
import { ExuluTool } from "@EXULU_SHARED/models/tool";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  ChevronRight,
  Bot,
  Wrench,
  Info,
  Settings,
  AlertCircle,
  Network,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AgentDetailsSheet } from "@/app/(application)/agents/components/agent-details-sheet";

interface AgentToolCardProps {
  tool: ExuluTool;
  isEnabled: boolean;
  config: any[];
  onToggle: (enabled: boolean) => void;
  onConfigUpdate: (value: any, name: string) => void;
  sheetOpen: boolean | string;
  setSheetOpen: (open: boolean | string) => void;
  variables: any[];
  renderConfigElement: (tool: ExuluTool, config: any[], update: (value: any, name: string) => void) => React.ReactNode;
  // For agent-specific features
  agentDetails?: {
    toolCount: number;
    subAgentCount: number;
    capabilities?: string[];
  };
  depth?: number; // For visual hierarchy
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
  const [agentDetailsSheetOpen, setAgentDetailsSheetOpen] = useState(false);

  const isAgent = tool.category === "agents";
  const requiredConfigCount = tool.config?.length || 0;
  const filledConfigCount = config?.filter(c => c.variable).length || 0;
  const hasEmptyConfigs = isEnabled && requiredConfigCount > 0 && filledConfigCount < requiredConfigCount;

  // Color scheme based on type
  const borderColor = isAgent ? "border-l-primary" : "border-l-secondary";
  const iconBg = isAgent ? "bg-primary/10" : "bg-muted";
  const iconColor = isAgent ? "text-primary" : "text-muted-foreground";

  return (
    <div
      className={cn(
        "rounded-lg border border-l-4 transition-all hover:shadow-sm",
        borderColor,
        isEnabled && isAgent && "bg-primary/5",
        depth > 0 && "ml-6 border-l-2"
      )}
      style={{
        marginLeft: depth > 0 ? `${depth * 1.5}rem` : undefined,
      }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon Section */}
          <div className={cn("p-2 rounded-md shrink-0", iconBg)}>
            {isAgent ? (
              <Bot className={cn("h-4 w-4", iconColor)} />
            ) : (
              <Wrench className={cn("h-4 w-4", iconColor)} />
            )}
          </div>

          {/* Content Section */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                {/* Title Row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium capitalize text-base">
                    {tool.name?.replace(/_/g, " ")}
                  </h4>

                  {/* Type Badge */}
                  <Badge variant={isAgent ? "default" : "outline"} className="text-xs">
                    {isAgent ? (
                      <><Bot className="h-3 w-3 mr-1" />Agent</>
                    ) : (
                      <><Wrench className="h-3 w-3 mr-1" />Tool</>
                    )}
                  </Badge>

                  {/* Category Badge */}
                  <Badge variant="secondary" className="text-xs capitalize">
                    {tool.category}
                  </Badge>

                  {/* Configuration Status */}
                  {requiredConfigCount > 0 && isEnabled && (
                    <Badge
                      variant={hasEmptyConfigs ? "destructive" : "outline"}
                      className="text-xs"
                    >
                      {filledConfigCount}/{requiredConfigCount}
                      {hasEmptyConfigs && <AlertCircle className="h-3 w-3 ml-1" />}
                    </Badge>
                  )}
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {tool.description}
                </p>

                {/* Agent-specific metadata */}
                {isAgent && agentDetails && (
                  <div className="flex items-center gap-3 mt-2">
                    {agentDetails.toolCount > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAgentDetailsSheetOpen(true);
                              }}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Wrench className="h-3 w-3" />
                              <span>{agentDetails.toolCount} tool{agentDetails.toolCount !== 1 ? 's' : ''}</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>This agent has access to {agentDetails.toolCount} tool{agentDetails.toolCount !== 1 ? 's' : ''}. Click to view details.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}

                    {agentDetails.subAgentCount > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAgentDetailsSheetOpen(true);
                              }}
                              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                            >
                              <Network className="h-3 w-3" />
                              <span>{agentDetails.subAgentCount} sub-agent{agentDetails.subAgentCount !== 1 ? 's' : ''}</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>This agent can delegate to {agentDetails.subAgentCount} other agent{agentDetails.subAgentCount !== 1 ? 's' : ''}. Click to view details.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}

                    {agentDetails.capabilities && agentDetails.capabilities.length > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAgentDetailsSheetOpen(true);
                              }}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Sparkles className="h-3 w-3" />
                              <span>{agentDetails.capabilities.length} capabilit{agentDetails.capabilities.length !== 1 ? 'ies' : 'y'}</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{agentDetails.capabilities.join(", ")}. Click to view details.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <Sheet
                  open={sheetOpen === tool.id}
                  onOpenChange={() => {
                    setSheetOpen(sheetOpen === tool.id ? false : tool.id);
                  }}
                >
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Info className="h-4 w-4" />
                      <span className="sr-only">Tool information</span>
                    </Button>
                  </SheetTrigger>

                  {requiredConfigCount > 0 && isEnabled && (
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-8 w-8 p-0",
                          hasEmptyConfigs && "text-destructive"
                        )}
                      >
                        <Settings className="h-4 w-4" />
                        <span className="sr-only">Configure tool</span>
                      </Button>
                    </SheetTrigger>
                  )}

                  <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                    <SheetHeader>
                      <div className="flex items-center gap-2">
                        {isAgent ? (
                          <div className="p-2 rounded-md bg-primary/10">
                            <Bot className="h-5 w-5 text-primary" />
                          </div>
                        ) : (
                          <div className="p-2 rounded-md bg-muted">
                            <Wrench className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <SheetTitle className="capitalize">{tool.name?.replace(/_/g, " ")}</SheetTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={isAgent ? "default" : "outline"} className="text-xs">
                              {isAgent ? "Agent" : "Tool"}
                            </Badge>
                            <Badge variant="secondary" className="text-xs capitalize">
                              {tool.category}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <SheetDescription className="mt-4">
                        {tool.description}
                      </SheetDescription>
                    </SheetHeader>

                    <div className="py-6 space-y-6">
                      {/* Configuration */}
                      {tool.config && tool.config.length > 0 && isEnabled && (
                        <div className="space-y-4">
                          <div className="text-sm font-medium">Configuration</div>
                          {renderConfigElement(tool, config, onConfigUpdate)}
                        </div>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>

                <Switch
                  checked={isEnabled}
                  onCheckedChange={onToggle}
                  className="ml-2"
                />
              </div>
            </div>

            {/* Expandable section for agent hierarchy */}
            {isAgent && agentDetails && (agentDetails.toolCount > 0 || agentDetails.subAgentCount > 0) && isEnabled && (
              <>
                <Button onClick={() => {
                  setAgentDetailsSheetOpen(true);
                }} variant="default" size="sm" type="button" className="h-7 text-xs gap-1 px-2 mt-2">
                  Show agent's tools & sub-agents
                </Button>
                {/* Agent Details Sheet */}
                <AgentDetailsSheet
                  agentId={tool.id}
                  open={agentDetailsSheetOpen}
                  onOpenChange={setAgentDetailsSheetOpen}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
