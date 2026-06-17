"use client";

import { useState } from "react";
import { usePrompts, useUniquePromptTags, useUpdatePrompt } from "@/hooks/use-prompts";
import { PromptLibrary } from "@/types/models/prompt-library";
import { UserWithRole } from "@/types/models/user";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Folder, ArrowLeft, Plus, X as XIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
// Cross-feature reuse — see instructions.tsx note. Promotion is scoped to the
// prompts redesign, not this work item.
import { PromptEditorModal } from "@/app/(application)/prompts/components/prompt-editor-modal";

interface PromptBrowserSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
  user: UserWithRole;
  onUpdate: () => void;
}

type ViewMode = "folders" | "prompts";

export function PromptBrowserSheet({
  open,
  onOpenChange,
  agentId,
  agentName,
  user,
  onUpdate,
}: PromptBrowserSheetProps) {
  const t = useTranslations("agents");
  const [viewMode, setViewMode] = useState<ViewMode>("folders");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatePrompt] = useUpdatePrompt();
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);

  // Fetch unique tags for folder view
  const { data: tagsData, loading: tagsLoading } = useUniquePromptTags();
  const folders = tagsData?.getUniquePromptTags || [];

  // Fetch prompts (either all or filtered by folder)
  const filters: any[] = [];
  if (selectedFolder && viewMode === "prompts") {
    if (selectedFolder === "untagged") {
      // We'll filter client-side for untagged
    } else {
      filters.push({ tags: { contains: selectedFolder } });
    }
  }
  if (searchQuery) {
    filters.push({ name: { contains: searchQuery } });
  }

  const { data: promptsData, loading: promptsLoading, refetch } = usePrompts({
    page: 1,
    limit: 100,
    filters,
  });

  let prompts = promptsData?.prompt_libraryPagination?.items || [];

  // Client-side filter for untagged
  if (selectedFolder === "untagged" && viewMode === "prompts") {
    prompts = prompts.filter(p => !p.tags || p.tags.length === 0);
  }

  const isPromptAssigned = (prompt: PromptLibrary) => {
    return prompt.assigned_agents?.includes(agentId) || false;
  };


  // Sort prompts: assigned ones first when no search query
  if (viewMode === "prompts" && !searchQuery) {
    prompts = [...prompts].sort((a, b) => {
      const aAssigned = isPromptAssigned(a);
      const bAssigned = isPromptAssigned(b);
      if (aAssigned && !bAssigned) return -1;
      if (!aAssigned && bAssigned) return 1;
      return 0;
    });
  }

  // Count prompts per folder
  const allPrompts = promptsData?.prompt_libraryPagination?.items || [];
  const folderCounts: Record<string, number> = {};
  let untaggedCount = 0;

  allPrompts.forEach((prompt) => {
    if (!prompt.tags || prompt.tags.length === 0) {
      untaggedCount++;
    } else {
      prompt.tags.forEach((tag) => {
        folderCounts[tag] = (folderCounts[tag] || 0) + 1;
      });
    }
  });

  const handleFolderClick = (folder: string) => {
    setSelectedFolder(folder);
    setViewMode("prompts");
  };

  const handleBackToFolders = () => {
    setViewMode("folders");
    setSelectedFolder(null);
    setSearchQuery("");
  };

  const handleTogglePrompt = async (prompt: PromptLibrary) => {
    const isAssigned = isPromptAssigned(prompt);
    const currentAgents = prompt.assigned_agents || [];

    let updatedAgents: string[];
    if (isAssigned) {
      // Remove agent
      updatedAgents = currentAgents.filter(id => id !== agentId);
    } else {
      // Add agent
      updatedAgents = [...currentAgents, agentId];
    }

    try {
      await updatePrompt({
        variables: {
          id: prompt.id,
          assigned_agents: updatedAgents,
        },
      });
      toast.success(
        isAssigned
          ? t("promptBrowser.removedFromAgent", { name: agentName })
          : t("promptBrowser.addedToAgent", { name: agentName })
      );
      // Refetch to update the UI
      await refetch();
      onUpdate();
    } catch (error) {
      toast.error(t("promptBrowser.updateFailed"));
      console.error(error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("promptBrowser.title")}</SheetTitle>
          <SheetDescription>
            {viewMode === "folders"
              ? t("promptBrowser.foldersSubtitle")
              : t("promptBrowser.promptsSubtitle", {
                  folder: selectedFolder ?? "",
                })}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Search */}
          <div className="flex items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("promptBrowser.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Button
              variant="outline"
              size="default"
              onClick={() => {
                setIsPromptModalOpen(true);
              }}
              className="ml-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("promptBrowser.createPrompt")}
            </Button>
          </div>

          {/* Back Button */}
          {viewMode === "prompts" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToFolders}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("promptBrowser.backToFolders")}
            </Button>
          )}

          <Separator />

          {/* Folders View */}
          {viewMode === "folders" && (
            <div className="space-y-2">
              {tagsLoading ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  {t("promptBrowser.loadingFolders")}
                </div>
              ) : (
                <>
                  {folders
                    .filter(folder =>
                      !searchQuery || folder.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((folder) => (
                      <Card
                        key={folder}
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => handleFolderClick(folder)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Folder className="h-5 w-5 text-primary" />
                              <span className="font-medium">{folder}</span>
                            </div>
                            <Badge variant="secondary">
                              {folderCounts[folder] || 0}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                  {untaggedCount > 0 && (
                    <Card
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => handleFolderClick("untagged")}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Folder className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium text-muted-foreground">{t('promptBrowser.untagged')}</span>
                          </div>
                          <Badge variant="outline">{untaggedCount}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}

          {/* Prompts View */}
          {viewMode === "prompts" && (
            <div className="space-y-2">
              {promptsLoading ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  {t("promptBrowser.loadingPrompts")}
                </div>
              ) : prompts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery
                    ? t("promptBrowser.noPromptsFound")
                    : t("promptBrowser.noPromptsInFolder")}
                </div>
              ) : (
                <>
                  {!searchQuery && prompts.some(p => isPromptAssigned(p)) && (
                    <div className="text-xs font-medium text-muted-foreground px-1 py-2">
                      {t("promptBrowser.assignedToAgent", { name: agentName })}
                    </div>
                  )}
                  {prompts.map((prompt, index) => {
                    const isAssigned = isPromptAssigned(prompt);
                    const showDivider = !searchQuery &&
                      index > 0 &&
                      isPromptAssigned(prompts[index - 1]) &&
                      !isAssigned;

                    return (
                      <div key={prompt.id}>
                        {showDivider && (
                          <div className="text-xs font-medium text-muted-foreground px-1 py-2 mt-4">
                            {t("promptBrowser.otherPrompts")}
                          </div>
                        )}
                        <Card className="hover:shadow-sm transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate">{prompt.name}</h4>
                                {prompt.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                    {prompt.description}
                                  </p>
                                )}
                                {prompt.tags && prompt.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {prompt.tags.slice(0, 3).map((tag) => (
                                      <Badge key={tag} variant="outline" className="text-xs">
                                        {tag}
                                      </Badge>
                                    ))}
                                    {prompt.tags.length > 3 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{prompt.tags.length - 3}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant={isAssigned ? "destructive" : "default"}
                                onClick={() => handleTogglePrompt(prompt)}
                                className="shrink-0"
                              >
                                {isAssigned ? (
                                  <>
                                    <XIcon className="h-4 w-4 mr-2" />
                                    {t("promptBrowser.remove")}
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    {t("promptBrowser.add")}
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </SheetContent>

      {/* Prompt Editor Modal */}
      <PromptEditorModal
        open={isPromptModalOpen}
        onOpenChange={setIsPromptModalOpen}
        defaultTags={selectedFolder ? [selectedFolder] : undefined}
        onSuccess={refetch}
        user={user}
        defaultAssignedAgents={[agentId]}
      />
    </Sheet>
  );
}
