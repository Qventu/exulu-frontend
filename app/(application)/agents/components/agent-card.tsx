"use client";

import { Agent } from "@EXULU_SHARED//models/agent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Info, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import AgentVisual from "@/components/lottie";

interface AgentCardProps {
  agent: Agent;
  onEdit?: (agent: Agent) => void;
  onChat?: (agent: Agent) => void;
  showDetails: (agent: Agent) => void;
}

export function AgentCard({ agent, onEdit, onChat, showDetails }: AgentCardProps) {
  const t = useTranslations();

  const handleCardClick = () => {
    if (onChat) {
      onChat(agent);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(agent);
    }
  };

  const handleDetailsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    showDetails(agent);
  };

  // Truncate description to 200 characters
  const truncatedDescription = agent.description
    ? agent.description.length > 200
      ? agent.description.substring(0, 200) + "..."
      : agent.description
    : t('agents.noDescriptionAvailable');

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200 h-full flex flex-col group"
        onClick={handleCardClick}
      >
        <CardHeader className="pb-4">
          <div className="flex items-start gap-4">
            {/* Agent Profile Image - Using AgentVisual component */}
            <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
              <AgentVisual agent={agent} status="ready" className="w-16 h-16" />
            </div>
            {/* Agent Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <CardTitle className="text-base line-clamp-1 flex-1 min-w-0 group-hover:text-primary transition-colors">
                  {agent.name}
                </CardTitle>
                <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleEditClick}
                      className="h-7 w-7 p-0 opacity-60 hover:opacity-100 hover:bg-accent"
                      title={t('agents.edit')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDetailsClick}
                    className="h-7 w-7 p-0 opacity-60 hover:opacity-100 hover:bg-accent"
                    title={t('agents.viewDetails')}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <CardDescription className="text-xs line-clamp-2 mb-2">
                {truncatedDescription}
              </CardDescription>

              <div className="flex items-center gap-2">
                <Badge
                  variant={agent.active ? "default" : "secondary"}
                  className="text-xs"
                >
                  {agent.active ? t('common.active') : t('common.inactive')}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>
    </>
  );
}