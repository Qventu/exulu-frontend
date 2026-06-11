"use client";

import { useRouter } from "next/navigation";
import { PromptLibrary } from "@/types/models/prompt-library";
import { Folder, Inbox, Plus, FolderPlus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";

interface PromptsGroupedViewProps {
  prompts: PromptLibrary[];
  onCreateClick: () => void;
}

export function PromptsGroupedView({
  prompts,
  onCreateClick,
}: PromptsGroupedViewProps) {
  const router = useRouter();
  const [showFolderTip, setShowFolderTip] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('prompts-folder-tip-seen');
    }
    return false;
  });

  // Count prompts by folder (tag)
  const folderCounts: Record<string, number> = {};
  let untaggedCount = 0;

  prompts.forEach((prompt) => {
    if (!prompt.tags || prompt.tags.length === 0) {
      untaggedCount++;
    } else {
      prompt.tags.forEach((tag) => {
        folderCounts[tag] = (folderCounts[tag] || 0) + 1;
      });
    }
  });

  // Sort folder names alphabetically
  const sortedFolders = Object.keys(folderCounts).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  const handleFolderClick = (folder: string) => {
    router.push(`/prompts/${encodeURIComponent(folder)}`);
  };

  const handleUntaggedClick = () => {
    router.push(`/prompts/untagged`);
  };

  if (sortedFolders.length === 0 && untaggedCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed rounded-2xl bg-muted/20">
        <div className="text-center space-y-8 max-w-2xl px-8">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-3xl"></div>
              <FolderPlus className="relative size-24 text-primary" />
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-3xl font-bold">Organize with Folders</h3>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Folders help you organize prompts by team, use case, or project. Add tags when creating prompts to automatically sort them into folders.
            </p>
          </div>

          {/* How it works */}
          <div className="bg-card border rounded-lg p-6 text-left space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                <Tag className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-1 flex-1">
                <h4 className="font-semibold text-sm">Add tags to your prompts</h4>
                <p className="text-sm text-muted-foreground">
                  When creating a prompt, add tags like "marketing", "support", or "engineering"
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 mt-0.5">
                <Folder className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="space-y-1 flex-1">
                <h4 className="font-semibold text-sm">Folders appear automatically</h4>
                <p className="text-sm text-muted-foreground">
                  Each unique tag becomes a folder, organizing your library
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={onCreateClick}
            size="lg"
            className="h-14 px-8 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="mr-2 h-5 w-5" />
            Create Your First Prompt
          </Button>
        </div>
      </div>
    );
  }

  // Color palette for folders (avoiding AI slop purple-blue gradients)
  const folderColors = [
    "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    "text-orange-500 bg-orange-500/10 border-orange-500/20",
    "text-rose-500 bg-rose-500/10 border-rose-500/20",
    "text-cyan-600 bg-cyan-500/10 border-cyan-500/20",
    "text-violet-500 bg-violet-500/10 border-violet-500/20",
    "text-amber-500 bg-amber-500/10 border-amber-500/20",
  ];

  return (
    <div className="space-y-6">
      {/* Folder tip for first-time users */}
      {showFolderTip && sortedFolders.length > 0 && (
        <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Folder className="h-4 w-4 text-primary" />
                Your prompts are organized!
              </h4>
              <p className="text-sm text-muted-foreground">
                Click any folder to see its prompts. Add or remove tags in the prompt editor to reorganize.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.setItem('prompts-folder-tip-seen', 'true');
                }
                setShowFolderTip(false);
              }}
              className="text-muted-foreground hover:text-foreground shrink-0 transition-colors duration-200"
            >
              Got it
            </Button>
          </div>
        </div>
      )}

      <p className="text-base font-medium text-muted-foreground">
        <span className="text-foreground font-bold text-lg">{sortedFolders.length}</span>{" "}
        {sortedFolders.length === 1 ? "folder" : "folders"}
        {untaggedCount > 0 && (
          <>
            <span className="mx-2">·</span>
            <span className="text-foreground font-bold text-lg">{untaggedCount}</span> unorganized
          </>
        )}
      </p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Folder Cards - Bold & Colorful */}
        {sortedFolders.map((folder, index) => {
          const colorClass = folderColors[index % folderColors.length];
          return (
            <div
              key={folder}
              className="animate-in fade-in slide-in-from-bottom-4"
              style={{
                animationDuration: '400ms',
                animationDelay: `${index * 50}ms`,
                animationFillMode: 'backwards'
              }}
            >
              <Card
                className={`cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] group border-2 ${colorClass}`}
                onClick={() => handleFolderClick(folder)}
              >
              <CardContent className="p-8">
                <div className="flex flex-col gap-4">
                  <Folder className="size-16 flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 ease-out" />
                  <div className="space-y-2">
                    <h3 className="font-bold text-2xl leading-tight group-hover:text-primary transition-colors duration-200">
                      {folder}
                    </h3>
                    <p className="text-base text-muted-foreground font-medium transition-colors group-hover:text-foreground">
                      {folderCounts[folder]} {folderCounts[folder] === 1 ? "prompt" : "prompts"}
                    </p>
                  </div>
                </div>
              </CardContent>
              </Card>
            </div>
          );
        })}

        {/* Untagged Card - Distinctive Style */}
        {untaggedCount > 0 && (
          <div
            className="animate-in fade-in slide-in-from-bottom-4"
            style={{
              animationDuration: '400ms',
              animationDelay: `${sortedFolders.length * 50}ms`,
              animationFillMode: 'backwards'
            }}
          >
            <Card
              className="cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] group border-2 border-muted-foreground/20 bg-muted/30"
              onClick={handleUntaggedClick}
            >
            <CardContent className="p-8">
              <div className="flex flex-col gap-4">
                <Inbox className="size-16 text-muted-foreground flex-shrink-0 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300 ease-out" />
                <div className="space-y-2">
                  <h3 className="font-bold text-2xl leading-tight text-muted-foreground group-hover:text-foreground transition-colors duration-200">
                    Unorganized
                  </h3>
                  <p className="text-base text-muted-foreground font-medium transition-colors group-hover:text-foreground">
                    {untaggedCount} {untaggedCount === 1 ? "prompt" : "prompts"}
                  </p>
                </div>
              </div>
            </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
