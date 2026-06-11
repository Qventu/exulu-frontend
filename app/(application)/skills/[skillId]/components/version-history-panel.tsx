"use client";

import { Skill, SkillVersion } from "@/types/models/skill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  History,
  GitBranch,
  Clock,
  GitCompare,
  TagIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface VersionHistoryPanelProps {
  skill: Skill;
  onCompare: () => void;
}

export function VersionHistoryPanel({ skill, onCompare }: VersionHistoryPanelProps) {
  const history = skill.history ?? [];
  const currentVersion = skill.current_version ?? 1;

  // Build a full version list from history + current
  const allVersionEntries: Array<SkillVersion & { isCurrent?: boolean }> = [
    {
      version: currentVersion,
      created_at: skill.updatedAt,
      label: "Current",
      isCurrent: true,
    },
    ...history
      .slice()
      .sort((a, b) => b.version - a.version),
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary/70" />
          <h3 className="text-sm font-semibold">Version History</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={onCompare}
          disabled={currentVersion < 2}
        >
          <GitCompare className="h-3.5 w-3.5" />
          Compare
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {allVersionEntries.map((entry, idx) => (
            <VersionItem key={entry.version} entry={entry} isFirst={idx === 0} />
          ))}

          {history.length === 0 && (
            <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
              <GitBranch className="size-10 mb-3" />
              <p className="text-sm">No previous versions yet</p>
              <p className="text-xs mt-1">
                Click "Save Version" to create a snapshot
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function VersionItem({
  entry,
  isFirst,
}: {
  entry: SkillVersion & { isCurrent?: boolean };
  isFirst: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-1.5 transition-colors",
        entry.isCurrent
          ? "bg-primary/5 border-primary/20"
          : "bg-card hover:bg-accent/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge
            variant={entry.isCurrent ? "default" : "secondary"}
            className="font-mono text-[10px] px-1.5 py-0"
          >
            v{entry.version}
          </Badge>
          {entry.isCurrent && (
            <span className="text-[10px] text-primary font-semibold">CURRENT</span>
          )}
        </div>
      </div>

      {entry.label && !entry.isCurrent && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <TagIcon className="h-3 w-3" />
          <span className="truncate">{entry.label}</span>
        </div>
      )}

      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>
          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}
