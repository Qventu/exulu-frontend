import { PromptLibrary } from "@/types/models/prompt-library";
import { UserWithRole } from "@/types/models/user";
import { Button } from "@/components/ui/button";
import { ThumbsUp, Activity, Trash2, Lock, Globe, Users, Shield, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractVariables } from "@/lib/prompts/extract-variables";
import { checkPromptWriteAccess } from "@/lib/prompts/check-prompt-access";
import { useDeletePrompt } from "@/hooks/use-prompts";
import { toast } from "sonner";
import { useState } from "react";

interface PromptListItemProps {
  prompt: PromptLibrary;
  isSelected: boolean;
  onClick: () => void;
  user: UserWithRole;
  onDelete?: () => void;
}

export function PromptListItem({ prompt, isSelected, onClick, user, onDelete }: PromptListItemProps) {
  const variables = extractVariables(prompt.content);
  const isFavorited = prompt.is_favorited || false;
  const hasWriteAccess = checkPromptWriteAccess(prompt, user);
  const [deletePrompt] = useDeletePrompt();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the prompt

    // eslint-disable-next-line no-restricted-globals -- pre-existing native dialog; replace with ConfirmDialog in this page's redesign
    if (!confirm(`Are you sure you want to delete "${prompt.name}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await deletePrompt({ variables: { id: prompt.id } });
      toast.success("Prompt deleted", {
        description: `"${prompt.name}" has been deleted successfully.`,
      });
      onDelete?.();
    } catch (error) {
      toast.error("Failed to delete prompt", {
        description: "Please try again.",
      });
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the prompt
    const url = `${window.location.origin}/prompts/${prompt.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied", {
      icon: "🔗",
      description: "Share this link to give others access",
      duration: 2000,
    });
  };

  // Rights mode icon and color
  const getRightsMode = () => {
    const mode = prompt.rights_mode;
    switch (mode) {
      case "private":
        return { icon: Lock, color: "text-red-600 dark:text-red-500", label: "Private" };
      case "public":
        return { icon: Globe, color: "text-green-600 dark:text-green-500", label: "Public" };
      case "users":
        return { icon: Users, color: "text-blue-600 dark:text-blue-500", label: "Users" };
      case "roles":
        return { icon: Shield, color: "text-purple-600 dark:text-purple-500", label: "Roles" };
      default:
        return { icon: Globe, color: "text-muted-foreground", label: "Public" };
    }
  };

  const rightsMode = getRightsMode();
  const RightsModeIcon = rightsMode.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 border-l-2 transition-all duration-200 hover:bg-accent/50 group relative",
        isSelected
          ? "bg-primary/10 border-l-primary shadow-sm"
          : "border-l-transparent hover:border-l-border"
      )}
    >
      <div className="space-y-1.5">
        {/* Title and Actions Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h3
              className={cn(
                "font-semibold text-sm leading-tight transition-colors truncate",
                isSelected ? "text-foreground" : "text-foreground group-hover:text-primary"
              )}
            >
              {prompt.name}
            </h3>
            {isFavorited && (
              <ThumbsUp className="h-3 w-3 text-amber-600 dark:text-amber-500 fill-amber-400 flex-shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Share button - shows on hover */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
              onClick={handleShare}
              title="Share link"
            >
              <Share2 className="h-3.5 w-3.5" />
            </Button>

            {/* Delete button - only for users with write access */}
            {hasWriteAccess && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive",
                  isDeleting && "opacity-100"
                )}
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Compact metadata row */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {/* Rights mode indicator */}
          <div className={cn("flex items-center gap-1 font-medium", rightsMode.color)}>
            <RightsModeIcon className="h-3 w-3" />
            <span>{rightsMode.label}</span>
          </div>

          <span className="text-muted-foreground/50">·</span>

          {/* Stats */}
          <div className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            <span>{prompt.favorite_count || 0}</span>
          </div>

          <div className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            <span>{prompt.usage_count || 0}</span>
          </div>

          {/* Variables count if any */}
          {variables.length > 0 && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-violet-700 dark:text-violet-400 font-medium">
                {variables.length} var{variables.length !== 1 ? "s" : ""}
              </span>
            </>
          )}

          {/* First tag if any */}
          {prompt.tags && prompt.tags.length > 0 && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="truncate max-w-[100px]">{prompt.tags[0]}</span>
              {prompt.tags.length > 1 && (
                <span className="text-muted-foreground/70">+{prompt.tags.length - 1}</span>
              )}
            </>
          )}
        </div>
      </div>
    </button>
  );
}
