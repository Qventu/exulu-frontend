"use client";

import { Skill } from "@/types/models/skill";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Lock, Globe, Users, Shield, GitBranch, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDeleteSkill } from "@/hooks/use-skills";
import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

interface SkillListItemProps {
  skill: Skill;
  isSelected: boolean;
  onClick: () => void;
  onDelete?: () => void;
}

const getRightsMode = (mode: string) => {
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

export function SkillListItem({ skill, isSelected, onClick, onDelete }: SkillListItemProps) {
  const [deleteSkill] = useDeleteSkill();
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const rightsMode = getRightsMode(skill.rights_mode);
  const RightsModeIcon = rightsMode.icon;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // eslint-disable-next-line no-restricted-globals -- pre-existing native dialog; replace with ConfirmDialog in this page's redesign
    if (!confirm(`Delete "${skill.name}"? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      await deleteSkill({ variables: { id: skill.id } });
      toast.success("Skill deleted");
      onDelete?.();
    } catch {
      toast.error("Failed to delete skill");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/skills/${skill.id}`);
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 border-l-2 transition-all duration-200 hover:bg-accent/50 group relative",
        isSelected
          ? "bg-primary/10 border-l-primary shadow-sm"
          : "border-l-transparent hover:border-l-border",
      )}
    >
      <div className="space-y-1.5">
        {/* Title and actions row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h3
              className={cn(
                "font-semibold text-sm leading-tight transition-colors truncate",
                isSelected ? "text-foreground" : "text-foreground group-hover:text-primary",
              )}
            >
              {skill.name}
            </h3>
            <Badge
              variant="secondary"
              className="font-mono text-[10px] px-1.5 py-0 flex-shrink-0"
            >
              v{skill.current_version ?? 1}
            </Badge>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
              onClick={handleOpen}
              title="Open editor"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive",
                isDeleting && "opacity-100",
              )}
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <div className={cn("flex items-center gap-1 font-medium", rightsMode.color)}>
            <RightsModeIcon className="h-3 w-3" />
            <span>{rightsMode.label}</span>
          </div>

          <span className="text-muted-foreground/50">·</span>

          <div className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            <span>{(skill.history?.length ?? 0) + 1} version{((skill.history?.length ?? 0) + 1) !== 1 ? "s" : ""}</span>
          </div>

          {skill.tags && skill.tags.length > 0 && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="truncate max-w-[100px]">{skill.tags[0]}</span>
              {skill.tags.length > 1 && (
                <span className="text-muted-foreground/70">+{skill.tags.length - 1}</span>
              )}
            </>
          )}

          <span className="text-muted-foreground/50 ml-auto">
            {formatDistanceToNow(new Date(skill.updatedAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    </button>
  );
}
