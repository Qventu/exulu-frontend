"use client";

import { useState } from "react";
import { Agent } from "@EXULU_SHARED//models/agent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Info } from "lucide-react";
import { AgentDetailsSheet } from "./agent-details-sheet";

interface AgentCardProps {
  agent: Agent;
  onSelect?: (agent: Agent) => void;
  showDetails?: boolean;
}

export function AgentCard({ agent, onSelect, showDetails = true }: AgentCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(agent);
    }
  };

  const handleDetailsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDetailsOpen(true);
  };

  // Truncate description to 200 characters
  const truncatedDescription = agent.description
    ? agent.description.length > 200
      ? agent.description.substring(0, 200) + "..."
      : agent.description
    : "No description available";

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow duration-200 h-full flex flex-col pb-3"
        onClick={handleCardClick}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            {/* Agent Profile Image */}
            <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
              {agent.image ? (
                <img
                  src={agent.image}
                  alt={`${agent.name} agent`}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="text-lg font-bold text-primary">
                  {agent.name?.charAt(0).toUpperCase() || 'A'}
                </div>
              )}
            </div>

            {/* Agent Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-lg line-clamp-1 flex-1 min-w-0">{agent.name}</CardTitle>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {showDetails && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDetailsClick}
                      className="p-1 h-auto"
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <CardDescription className="text-sm line-clamp-2">
                {truncatedDescription}
              </CardDescription>

              <Badge
                variant={agent.active ? "default" : "secondary"}
                className="text-xs mt-2"
              >
                {agent.active ? "Active" : "Inactive"}
              </Badge>

            </div>
          </div>
        </CardHeader>
      </Card>

      {showDetails && (
        <AgentDetailsSheet
          agentId={agent.id}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      )}
    </>
  );
}