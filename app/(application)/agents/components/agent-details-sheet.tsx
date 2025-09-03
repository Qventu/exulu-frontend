"use client";

import { useQuery } from "@apollo/client";
import { Agent } from "@EXULU_SHARED//models/agent";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Image, FileText, Volume2, Video, Shield, Users, Wrench, Text } from "lucide-react";
import { GET_AGENT_BY_ID, GET_TOOLS } from "@/queries/queries";
import { Tool } from "@/types/models/tool";

interface AgentDetailsSheetProps {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentDetailsSheet({ agentId, open, onOpenChange }: AgentDetailsSheetProps) {

  const { data: agentData, loading: agentLoading } = useQuery<{
    agentById: Agent
  }>(GET_AGENT_BY_ID, {
    variables: {
      id: agentId,
    },
  });

  const { data: toolsData, loading: toolsLoading } = useQuery<{
    tools: {
      items: Tool[]
    }
  }>(GET_TOOLS);

  if (agentLoading || !agentData?.agentById || toolsLoading || !toolsData?.tools) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const agent = agentData.agentById;
  const tools = toolsData.tools;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center overflow-hidden">
              {agent.image ? (
                <img
                  src={agent.image}
                  alt={`${agent.name} agent`}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="text-3xl font-bold text-primary">
                  {agent.name?.charAt(0).toUpperCase() || 'A'}
                </div>
              )}
            </div>
            <div className="text-center space-y-2">
              <SheetTitle className="text-xl">{agent.name}</SheetTitle>
              <div className="flex items-center justify-center gap-2">
                <Badge variant={agent.active ? "default" : "secondary"}>
                  {agent.active ? "Active" : "Inactive"}
                </Badge>
                <Badge variant="outline">{agent.modelName || "Custom"}</Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-sm font-medium mb-2">Description</h3>
            <p className="text-sm text-muted-foreground">
              {agent.description || "No description available."}
            </p>
          </div>

          {/* Capabilities */}
          {agent.type !== "custom" && (
            <div>
              <h3 className="text-sm font-medium mb-3">Capabilities</h3>
              <TooltipProvider>
                <div className="flex items-center gap-3">

                  <div className={`p-3 rounded-md ${agent.capabilities?.text ? 'bg-green-500 text-primary-foreground' : 'bg-gray-500 text-white'}`}>
                    <Text className="h-4 w-4" />
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`p-3 rounded-md ${agent.capabilities?.images?.length ? 'bg-primary text-primary-foreground' : 'bg-gray-500 text-white'}`}>
                        <Image className="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Images: {agent.capabilities?.images?.length ? agent.capabilities.images.join(", ") : "None"}</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`p-3 rounded-md ${agent.capabilities?.files?.length ? 'bg-primary text-primary-foreground' : 'bg-gray-500 text-white'}`}>
                        <FileText className="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Files: {agent.capabilities?.files?.length ? agent.capabilities.files.join(", ") : "None"}</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`p-3 rounded-md ${agent.capabilities?.audio?.length ? 'bg-primary text-primary-foreground' : 'bg-gray-500 text-white'}`}>
                        <Volume2 className="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Audio: {agent.capabilities?.audio?.length ? agent.capabilities.audio.join(", ") : "None"}</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`p-3 rounded-md ${agent.capabilities?.video?.length ? 'bg-primary text-primary-foreground' : 'bg-gray-500 text-white'}`}>
                        <Video className="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Video: {agent.capabilities?.video?.length ? agent.capabilities.video.join(", ") : "None"}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>
          )}

          {/* Tools */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="h-4 w-4" />
              <h3 className="text-sm font-medium">Tools</h3>
              <Badge variant="outline" className="text-xs">
                {agent.tools?.length  || 0}/{tools.items?.length || 0}
              </Badge>
            </div>
            <div className="space-y-2">
              {agent.tools?.length && agent.tools.length > 0 ? (
                tools?.items?.map((tool) => {
                  const isEnabled = agent.tools?.some(et => et.toolId === tool.id);
                  if (!isEnabled) return null;
                  return (
                    <div key={tool.id} className="flex items-center justify-between p-2 rounded border">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{tool.name}</div>
                        <div className="text-xs text-muted-foreground">{tool.type}</div>
                      </div>
                      <Badge variant="secondary" className="text-xs">Enabled</Badge>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No tools enabled</p>
              )}
            </div>
          </div>

          {/* Firewall */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4" />
              <h3 className="text-sm font-medium">Security</h3>
              <Badge variant={agent.firewall?.enabled ? "default" : "secondary"} className="text-xs">
                {agent.firewall?.enabled ? "Protected" : "Unprotected"}
              </Badge>
            </div>
            {agent.firewall?.enabled && agent.firewall.scanners && (
              <div className="space-y-2">
                {Object.entries(agent.firewall.scanners).map(([scanner, enabled]) => {
                  if (!enabled) return null;
                  const scannerNames = {
                    promptGuard: "Prompt Guard",
                    codeShield: "Code Shield",
                    agentAlignment: "Agent Alignment",
                    hiddenAscii: "Hidden ASCII Detection",
                    piiDetection: "PII Detection"
                  };
                  return (
                    <div key={scanner} className="flex items-center justify-between p-2 rounded border">
                      <span className="text-sm">{scannerNames[scanner as keyof typeof scannerNames] || scanner}</span>
                      <Badge variant="default" className="text-xs">Active</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Access Control */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4" />
              <h3 className="text-sm font-medium">Access Control</h3>
              <Badge variant="outline" className="text-xs">
                {agent.rights_mode || "Open"}
              </Badge>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}