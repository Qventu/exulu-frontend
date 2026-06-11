"use client";

import { useContext, useState } from "react";
import { PromptLibrary } from "@/types/models/prompt-library";
import { UserWithRole } from "@/types/models/user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ThumbsUp,
  Activity,
  Edit,
  Trash2,
  Copy,
  Bot,
  User,
  Clock,
  MoreVertical,
  ExternalLink,
  Share2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { extractVariables } from "@/lib/prompts/extract-variables";
import { fillPromptVariables } from "@/lib/prompts/fill-prompt-variables";
import { checkPromptWriteAccess } from "@/lib/prompts/check-prompt-access";
import { useDeletePrompt, useTogglePromptFavorite } from "@/hooks/use-prompts";
import { toast } from "sonner";
import { useQuery } from "@apollo/client";
import { GET_AGENTS_BY_IDS, GET_USER_BY_ID } from "@/queries/queries";
import { formatDistanceToNow } from "date-fns";
import { PromptVariableForm } from "@/app/(application)/chat/components/prompt-variable-form";
import { VersionHistoryPanel } from "./version-history-panel";
import { UserContext } from "../../authenticated";

interface PromptPreviewProps {
  prompt: PromptLibrary;
  onUpdate?: () => void;
  onEdit?: () => void;
}

export function PromptPreview({ prompt, onUpdate, onEdit }: PromptPreviewProps) {
  const { user } = useContext(UserContext);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [promptVariableFormOpen, setPromptVariableFormOpen] = useState(false);
  const [deletePrompt] = useDeletePrompt();
  const { toggleFavorite } = useTogglePromptFavorite();

  const hasWriteAccess = checkPromptWriteAccess(prompt, user);
  const variables = extractVariables(prompt.content);
  const isFavorited = prompt.is_favorited || false;

  // Fetch assigned agents
  const { data: agentsData } = useQuery(GET_AGENTS_BY_IDS, {
    variables: { ids: prompt.assigned_agents || [] },
    skip: !prompt.assigned_agents || prompt.assigned_agents.length === 0,
  });

  const assignedAgentNames =
    agentsData?.agentByIds?.map((agent: any) => agent.name) || [];

  // Fetch creator
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
        toast.success("Prompt deleted successfully", {
          description: "Prompt deleted successfully.",
        });
        if (onUpdate) {
          onUpdate();
        }
      } catch (error) {
        toast.error("Failed to delete prompt", {
          description: "Failed to delete prompt. Please try again.",
        });
        console.error(error);
      }
    }
  };

  const handleToggleFavorite = async () => {
    if (isFavoriting) return;

    setIsFavoriting(true);
    try {
      await toggleFavorite(
        prompt.id,
        user.id,
        isFavorited,
        prompt.favorite_count,
        undefined
      );
      toast.success(
        isFavorited ? "Removed from favorites" : "Added to favorites",
        {
          icon: isFavorited ? "👎" : "👍",
          duration: 2000,
        }
      );
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      toast.error("Failed to update favorite");
      console.error(error);
    } finally {
      await new Promise(resolve => setTimeout(resolve, 200));
      setIsFavoriting(false);
    }
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(prompt.content);
    toast.success("Prompt copied to clipboard", {
      icon: "📋",
      duration: 2000,
    });
  };

  const handleUsePrompt = () => {
    if (variables.length > 0) {
      // Prompt has variables, show form
      setPromptVariableFormOpen(true);
    } else {
      // No variables, copy directly
      navigator.clipboard.writeText(prompt.content);
      toast.success("Prompt copied to clipboard", {
        icon: "📋",
        duration: 2000,
      });
    }
  };

  const handleSubmitVariables = (values: Record<string, string>) => {
    const filledPrompt = fillPromptVariables(prompt.content, values);
    navigator.clipboard.writeText(filledPrompt);
    toast.success("Filled prompt copied to clipboard", {
      icon: "📋",
      duration: 2000,
    });
    setPromptVariableFormOpen(false);
  };

  const handleShareLink = () => {
    const url = `${window.location.origin}/prompts/${prompt.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard", {
      icon: "🔗",
      description: "Share this link to give others access to this prompt",
      duration: 2000,
    });
  };

  // Highlight variables in content
  const renderContentWithVariables = () => {
    if (variables.length === 0) return prompt.content;

    let highlightedContent = prompt.content;
    variables.forEach((variable) => {
      const regex = new RegExp(`\\{${variable}\\}`, 'g');
      highlightedContent = highlightedContent.replace(
        regex,
        `<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-700 dark:text-violet-400 font-mono text-sm border border-violet-500/20">{${variable}}</span>`
      );
    });
    return highlightedContent;
  };

  return (
    <div className="h-full flex flex-col bg-background border rounded-lg shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Browser Chrome */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/80" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
            <div className="h-3 w-3 rounded-full bg-green-500/80" />
          </div>
          <div className="ml-4 px-3 py-1 rounded bg-background border text-xs text-muted-foreground font-mono flex items-center gap-2">
            <ExternalLink className="h-3 w-3" />
            prompt-library/{prompt.name.toLowerCase().replace(/\s+/g, '-')}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Share button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 transition-all hover:scale-110"
            onClick={handleShareLink}
            title="Share link"
          >
            <Share2 className="h-4 w-4" />
          </Button>

          {/* Favorite button */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 transition-all hover:scale-110",
              isFavoriting ? "scale-125" : "",
              isFavorited ? "text-amber-600 dark:text-amber-500 bg-amber-500/10" : ""
            )}
            onClick={handleToggleFavorite}
            disabled={isFavoriting}
            title={isFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            <ThumbsUp
              className={cn(
                "h-4 w-4 transition-all",
                isFavoriting ? "animate-pulse" : "",
                isFavorited ? "fill-amber-400 text-amber-400" : ""
              )}
            />
          </Button>

          {/* Actions dropdown (for users with write access) */}
          {hasWriteAccess && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  if (onEdit) {
                    onEdit();
                  }
                }}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyContent}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Content
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <h2 className="text-2xl font-bold leading-tight">{prompt.name}</h2>
          {prompt.description && (
            <p className="text-base text-muted-foreground leading-relaxed">
              {prompt.description}
            </p>
          )}
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <User className="h-4 w-4 text-primary/70" />
            <span className="font-medium">{creatorName}</span>
          </div>
          <span className="text-muted-foreground/50">·</span>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4 text-cyan-600 dark:text-cyan-500" />
            <span>
              {formatDistanceToNow(new Date(prompt.updatedAt), { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Stats & Tags */}
        <div className="flex items-center gap-4 flex-wrap">
          <div
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium transition-all",
              isFavorited ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground"
            )}
          >
            <ThumbsUp className={cn("h-4 w-4", isFavorited ? "drop-shadow-sm" : "")} />
            <span className={isFavorited ? "font-bold" : ""}>{prompt.favorite_count || 0}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-500">
            <Activity className="h-4 w-4" />
            <span>{prompt.usage_count || 0}</span>
          </div>

          {variables.length > 0 && (
            <Badge variant="outline" className="text-xs font-semibold border-2 border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-400 px-2.5 py-1">
              {variables.length} variable{variables.length !== 1 ? "s" : ""}
            </Badge>
          )}

          {prompt.tags && prompt.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs px-2.5 py-1">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Assigned Agents */}
        {assignedAgentNames.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Assigned Agents</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {assignedAgentNames.map((name, index) => (
                <Badge
                  key={index}
                  variant="default"
                  className="text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 border-primary/20 px-2.5 py-1"
                >
                  <Bot className="h-3 w-3 mr-1" />
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Prompt Content */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Prompt Content</h3>
          <div
            onClick={handleCopyContent}
            className="p-4 rounded-lg border-2 bg-muted/20 font-mono text-sm leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: renderContentWithVariables() }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4">
          <Button
            size="lg"
            onClick={handleUsePrompt}
            className="shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-150"
          >
            Use This Prompt
          </Button>
          {hasWriteAccess && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                if (onEdit) {
                  onEdit();
                }
              }}
              className="border-2 hover:border-primary hover:text-primary hover:bg-primary/5"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>

        {/* Version History Panel */}
        <VersionHistoryPanel
          prompt={prompt}
          user={user}
          hasWriteAccess={hasWriteAccess}
          onRestore={() => {
            if (onUpdate) {
              onUpdate();
            }
          }}
        />
      </div>

      {/* Variable Form Modal */}
      {variables.length > 0 && (
        <PromptVariableForm
          open={promptVariableFormOpen}
          onOpenChange={setPromptVariableFormOpen}
          variables={variables}
          promptName={prompt.name}
          onSubmit={handleSubmitVariables}
          submitButtonText="Copy to Clipboard"
        />
      )}
    </div>
  );
}

// Helper function - moved outside component
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
