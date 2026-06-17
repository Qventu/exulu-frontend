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
  FolderMinus,
  EyeIcon,
} from "lucide-react";
import { checkPromptWriteAccess } from "@/lib/prompts/check-prompt-access";
import { extractVariables } from "@/lib/prompts/extract-variables";
import { useDeletePrompt, useTogglePromptFavorite, useUpdatePrompt } from "@/hooks/use-prompts";
import { PromptEditorModal } from "./prompt-editor-modal";
import { toast } from "sonner";
import { useQuery } from "@apollo/client";
import { GET_AGENTS_BY_IDS, GET_USER_BY_ID } from "@/queries/queries";
import { formatDistanceToNow } from "date-fns";

interface PromptCardProps {
  prompt: PromptLibrary;
  user: UserWithRole;
  onUpdate: () => void;
  currentFolder?: string; // Optional: If provided, shows "Remove from folder" action
  minimal?: boolean; // Optional: If true, shows only the name and description
}

export function PromptCard({ prompt, user, onUpdate, currentFolder, minimal = false }: PromptCardProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [deletePrompt] = useDeletePrompt();
  const [updatePrompt] = useUpdatePrompt();
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
    // eslint-disable-next-line no-restricted-globals -- pre-existing native dialog; replace with ConfirmDialog in this page's redesign
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

  const handleRemoveFromFolder = async () => {
    if (!currentFolder || !hasWriteAccess) return;

    // Remove the current folder from the tags array
    const updatedTags = (prompt.tags || []).filter(
      tag => tag.toLowerCase() !== currentFolder.toLowerCase()
    );

    try {
      await updatePrompt({
        variables: {
          id: prompt.id,
          tags: updatedTags,
        },
      });
      toast.success(`Removed from "${currentFolder}" folder`);
      onUpdate();
    } catch (error) {
      toast.error("Failed to remove from folder");
      console.error(error);
    }
  };

  return (
    <>
      <Card className="group flex flex-col hover:shadow-xl hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] bg-card/50 backdrop-blur-sm">
        <CardHeader className={`pb-4 ${minimal ? "py-4" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-2">
              <h3 className="font-bold text-xl leading-tight group-hover:text-primary transition-colors">
                {prompt.name}
              </h3>
              {prompt.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                  {prompt.description}
                </p>
              )}
            </div>
            <div className={`flex items-center gap-1 ${minimal ? "my-auto" : ""}`}>
              {!minimal && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 transition-all hover:scale-110 ${isFavoriting ? "scale-125" : ""
                    } ${isFavorited ? "text-yellow-500 bg-yellow-500/10" : ""}`}
                  onClick={handleToggleFavorite}
                  disabled={isFavoriting}
                >
                  <ThumbsUp
                    className={`h-5 w-5 transition-all ${isFavoriting ? "animate-pulse" : ""
                      } ${isFavorited ? "fill-yellow-400 text-yellow-400" : ""}`}
                  />
                </Button>
              )}

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {hasWriteAccess && (
                    <>
                      <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
                        <EyeIcon className="mr-2 h-4 w-4" />
                        Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      {currentFolder && currentFolder !== "untagged" && (
                        <DropdownMenuItem onClick={handleRemoveFromFolder}>
                          <FolderMinus className="mr-2 h-4 w-4" />
                          Remove from "{currentFolder}"
                        </DropdownMenuItem>
                      )}
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

        {!minimal && (
          <>
            <CardContent className="flex-1 pb-4 space-y-4">
              {/* Content Preview - More Prominent */}
              <p className="text-base text-muted-foreground/90 line-clamp-3 leading-relaxed font-mono">
                {prompt.content}
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Variables Badge - More Prominent */}
                {variables.length > 0 && (
                  <Badge variant="outline" className="text-xs font-semibold border-2 border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-400 px-2.5 py-1">
                    {variables.length} variable{variables.length !== 1 ? "s" : ""}
                  </Badge>
                )}

                {/* Assigned Agents - Inline */}
                {assignedAgentNames.length > 0 && (
                  <>
                    {assignedAgentNames.slice(0, 2).map((name, index) => (
                      <Badge
                        key={index}
                        variant="default"
                        className="text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 border-primary/20 px-2.5 py-1"
                      >
                        <Bot className="h-3 w-3 mr-1" />
                        {name}
                      </Badge>
                    ))}
                    {assignedAgentNames.length > 2 && (
                      <Badge
                        variant="default"
                        className="text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 border-primary/20 px-2.5 py-1"
                      >
                        +{assignedAgentNames.length - 2}
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 pt-4 border-t-2 bg-gradient-to-br from-muted/20 to-muted/40">
              {/* Stats Row - Bolder */}
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4 text-sm font-medium">
                  <div className={`flex items-center gap-1.5 transition-all ${isFavoriting ? "scale-125" : ""
                    } ${isFavorited ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground"}`}>
                    <ThumbsUp className={`h-4 w-4 ${isFavorited ? "drop-shadow-sm" : ""}`} />
                    <span className={isFavorited ? "font-bold" : ""}>{prompt.favorite_count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500" title="Times used">
                    <Activity className="h-4 w-4" />
                    <span className="font-semibold">{prompt.usage_count || 0}</span>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="font-semibold group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-md transition-all"
                >
                  View Details
                </Button>
              </div>

              {/* Metadata Row - Condensed */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground w-full flex-wrap">
                <div className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-primary/70" />
                  <span className="font-medium">{creatorName}</span>
                </div>
                <span className="text-muted-foreground/50">·</span>
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-500" />
                  <span>
                    {formatDistanceToNow(new Date(prompt.updatedAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </CardFooter>
          </>
        )}
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
