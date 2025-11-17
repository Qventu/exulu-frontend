import { useState } from "react";
import { PromptLibrary } from "@/types/models/prompt-library";
import { UserWithRole } from "@/types/models/user";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Edit,
  Trash2,
  MoreVertical,
  Star,
  Activity,
  MessageSquare,
  Copy,
  Bot,
  User,
  Calendar,
  Clock,
  ThumbsUp,
} from "lucide-react";
import { checkPromptWriteAccess } from "@/lib/prompts/check-prompt-access";
import { extractVariables } from "@/lib/prompts/extract-variables";
import { useDeletePrompt, useTogglePromptFavorite } from "@/hooks/use-prompts";
import { PromptEditorModal } from "./prompt-editor-modal";
import { toast } from "sonner";
import { useQuery } from "@apollo/client";
import { GET_AGENTS_BY_IDS, GET_USER_BY_ID } from "@/queries/queries";
import { formatDistanceToNow } from "date-fns";

interface PromptCardProps {
  prompt: PromptLibrary;
  user: UserWithRole;
  onUpdate: () => void;
}

export function PromptCard({ prompt, user, onUpdate }: PromptCardProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [deletePrompt] = useDeletePrompt();
  const { toggleFavorite } = useTogglePromptFavorite();

  const hasWriteAccess = checkPromptWriteAccess(prompt, user);
  const variables = extractVariables(prompt.content);
  const isFavorited = prompt.is_favorited || false;

  // Fetch only the assigned agents by their IDs
  const { data: agentsData } = useQuery(GET_AGENTS_BY_IDS, {
    variables: { ids: prompt.assigned_agents || [] },
    skip: !prompt.assigned_agents || prompt.assigned_agents.length === 0,
  });

  const assignedAgentNames =
    agentsData?.agentByIds?.map((agent: any) => agent.name) || [];

  // Fetch creator information
  const { data: creatorData } = useQuery(GET_USER_BY_ID, {
    variables: { id: prompt.created_by },
    skip: !prompt.created_by,
  });

  const creatorName = creatorData?.userById?.name || "Unknown";

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this prompt?")) {
      try {
        await deletePrompt({ variables: { id: prompt.id } });
        toast.success("Prompt deleted successfully");
        onUpdate();
      } catch (error) {
        toast.error("Failed to delete prompt");
        console.error(error);
      }
    }
  };

  const handleToggleFavorite = async () => {
    if (isFavoriting) return; // Prevent double-clicks

    setIsFavoriting(true);
    try {
      // This is a simplified version - you'd need to fetch the favorite ID
      // and current favorite status from the backend
      await toggleFavorite(
        prompt.id,
        user.id,
        isFavorited,
        prompt.favorite_count,
        undefined // favoriteId would come from querying favorites
      );
      toast.success(
        isFavorited ? "Removed from favorites" : "Added to favorites",
        {
          icon: isFavorited ? "👎" : "👍",
          duration: 2000,
        }
      );
      onUpdate();
    } catch (error) {
      toast.error("Failed to update favorite");
      console.error(error);
    } finally {
      // wait 1 second
      await new Promise(resolve => setTimeout(resolve, 200));
      setIsFavoriting(false);
    }
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(prompt.content);
    toast.success("Prompt copied to clipboard");
  };

  return (
    <>
      <Card className="flex flex-col hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{prompt.name}</h3>
              {prompt.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {prompt.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 transition-all ${isFavoriting ? "scale-125" : ""
                  } ${isFavorited ? "text-yellow-500" : ""}`}
                onClick={handleToggleFavorite}
                disabled={isFavoriting}
              >
                <ThumbsUp
                  className={`h-4 w-4 transition-all ${isFavoriting ? "animate-pulse" : ""
                    } ${isFavorited ? "fill-yellow-400 text-yellow-400" : ""}`}
                />
              </Button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleCopyContent}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Content
                  </DropdownMenuItem>
                  {hasWriteAccess && (
                    <>
                      <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleDelete}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 pb-3">
          <div className="space-y-3">
            {/* Content Preview */}
            <p className="text-sm text-muted-foreground line-clamp-3">
              {prompt.content}
            </p>

            {/* Variables Badge */}
            {variables.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {variables.length} variable{variables.length !== 1 ? "s" : ""}
              </Badge>
            )}

            {/* Assigned Agents */}
            {assignedAgentNames.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Bot className="h-3 w-3" />
                  <span className="font-medium">Works with:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {assignedAgentNames.slice(0, 2).map((name, index) => (
                    <Badge
                      key={index}
                      variant="default"
                      className="text-xs bg-primary/10 text-primary hover:bg-primary/20"
                    >
                      {name}
                    </Badge>
                  ))}
                  {assignedAgentNames.length > 2 && (
                    <Badge
                      variant="default"
                      className="text-xs bg-primary/10 text-primary hover:bg-primary/20"
                    >
                      +{assignedAgentNames.length - 2} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-3 border-t">
          {/* Stats Row */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className={`flex items-center gap-1 transition-all ${isFavoriting ? "scale-125" : ""
                } ${isFavorited ? "text-yellow-500" : ""}`}>
                <ThumbsUp className="h-3.5 w-3.5" />
                <span>{prompt.favorite_count || 0}</span>

              </div>
              <div className="flex items-center gap-1" title="Times used">
                <Activity className="h-3.5 w-3.5" />
                <span>{prompt.usage_count || 0}</span>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setIsEditModalOpen(true)}
            >
              <MessageSquare className="mr-2 h-3.5 w-3.5" />
              View
            </Button>
          </div>

          {/* Metadata Row */}
          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground w-full">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>Created by {creatorName}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>
                Created {formatDistanceToNow(new Date(prompt.createdAt), { addSuffix: true })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>
                Updated {formatDistanceToNow(new Date(prompt.updatedAt), { addSuffix: true })}
              </span>
            </div>
          </div>
        </CardFooter>
      </Card>

      <PromptEditorModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        prompt={prompt}
        onSuccess={onUpdate}
        user={user}
      />
    </>
  );
}
