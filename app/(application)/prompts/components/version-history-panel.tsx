"use client";

import { useState } from "react";
import { PromptLibrary, PromptVersion } from "@/types/models/prompt-library";
import { UserWithRole } from "@/types/models/user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  History,
  GitBranch,
  RotateCcw,
  Eye,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { VersionDiffModal } from "./version-diff-modal";
import { VersionRestoreModal } from "./version-restore-modal";
import { useQuery } from "@apollo/client";
import { GET_USER_BY_ID } from "@/queries/queries";

interface VersionHistoryPanelProps {
  prompt: PromptLibrary;
  user: UserWithRole;
  hasWriteAccess: boolean;
  onRestore: () => void;
}

export function VersionHistoryPanel({
  prompt,
  user,
  hasWriteAccess,
  onRestore,
}: VersionHistoryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);
  const [compareVersion, setCompareVersion] = useState<PromptVersion | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  const history = prompt.history || [];
  const hasHistory = history.length > 0;
  const displayedVersions = isExpanded ? history : history.slice(0, 3);

  // Get current version number (latest + 1)
  const currentVersion = hasHistory ? Math.max(...history.map(v => v.version)) + 1 : 1;

  const handleCompare = (version: PromptVersion) => {
    setSelectedVersion(version);
    // Compare with current by default
    setCompareVersion(null);
    setIsDiffModalOpen(true);
  };

  const handleRestore = (version: PromptVersion) => {
    setSelectedVersion(version);
    setIsRestoreModalOpen(true);
  };

  if (!hasHistory) {
    return (
      <div className="space-y-3 pt-6 border-t">
        <div className="flex items-center gap-2 text-muted-foreground">
          <History className="h-4 w-4" />
          <h3 className="text-sm font-semibold">Version History</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-muted/20">
          <GitBranch className="size-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No previous versions yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Changes will be tracked automatically when you edit
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-6 border-t">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary/70" />
          <h3 className="text-sm font-semibold text-muted-foreground">Version History</h3>
          <Badge variant="outline" className="text-xs font-mono">
            v{currentVersion}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {history.length} {history.length === 1 ? "version" : "versions"}
          </span>
        </div>
        {history.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show All ({history.length - 3} more)
              </>
            )}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {displayedVersions.map((version, index) => (
          <VersionItem
            key={`${version.version}-${version.timestamp}`}
            version={version}
            prompt={prompt}
            isLatest={index === 0}
            onCompare={() => handleCompare(version)}
            onRestore={() => handleRestore(version)}
            hasWriteAccess={hasWriteAccess}
          />
        ))}
      </div>

      {/* Diff Modal */}
      {selectedVersion && (
        <VersionDiffModal
          open={isDiffModalOpen}
          onOpenChange={setIsDiffModalOpen}
          prompt={prompt}
          version={selectedVersion}
          compareVersion={compareVersion}
        />
      )}

      {/* Restore Modal */}
      {selectedVersion && (
        <VersionRestoreModal
          open={isRestoreModalOpen}
          onOpenChange={setIsRestoreModalOpen}
          prompt={prompt}
          version={selectedVersion}
          onRestore={onRestore}
        />
      )}
    </div>
  );
}

interface VersionItemProps {
  version: PromptVersion;
  prompt: PromptLibrary;
  isLatest: boolean;
  onCompare: () => void;
  onRestore: () => void;
  hasWriteAccess: boolean;
}

function VersionItem({
  version,
  prompt,
  isLatest,
  onCompare,
  onRestore,
  hasWriteAccess,
}: VersionItemProps) {
  // Fetch user who made the change
  const { data: userData } = useQuery(GET_USER_BY_ID, {
    variables: { id: version.changed_by },
    skip: !version.changed_by,
  });

  const userName = userData?.userById?.name || "Unknown";

  return (
    <div className="group relative border rounded-lg p-3 hover:bg-accent/50 transition-colors">
      {/* Version indicator line */}

      <div className="flex items-start gap-3">
        {/* Version badge */}
     

        <div className="flex-1 min-w-0 space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-sm">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{userName}</span>
                </div>
                <span className="text-muted-foreground/50">·</span>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(version.timestamp), { addSuffix: true })}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCompare}
              className="h-7 text-xs"
            >
              <Eye className="h-3 w-3 mr-1" />
              Compare
            </Button>
            {hasWriteAccess && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRestore}
                className="h-7 text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Restore
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
