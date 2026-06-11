"use client";

import { useContext, useState, useEffect } from "react";
import { UserContext } from "@/app/(application)/authenticated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ChevronLeft, ChevronRight, FileText, MessageSquare, Tag } from "lucide-react";
import { usePrompts } from "@/hooks/use-prompts";
import { PromptCard } from "./components/prompt-card";
import { PromptEditorModal } from "./components/prompt-editor-modal";
import { PromptFilters } from "./components/prompt-filters";
import { PromptListItem } from "./components/prompt-list-item";
import { PromptPreview } from "./components/prompt-preview";
import { PromptLibrary } from "@/types/models/prompt-library";
import { Badge } from "@/components/ui/badge";
import { useUniquePromptTags } from "@/hooks/use-prompts";

export const dynamic = "force-dynamic";

export default function PromptsPage() {
  const { user } = useContext(UserContext);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>("updatedAt");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(50); // Increased for list view
  const [selectedPrompt, setSelectedPrompt] = useState<PromptLibrary | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    // Check if user has seen onboarding
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('prompts-onboarding-seen');
    }
    return false;
  });

  // Keyboard shortcuts for power users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K: Quick create
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCreateModalOpen(true);
      }
      // Cmd/Ctrl + /: Focus search
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder="Search prompts..."]') as HTMLInputElement;
        searchInput?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, sortBy, selectedTags, selectedAgents]);

  // Build filters based on search and tags (server-side)
  const filters: any[] = [];
  if (searchQuery) {
    filters.push({ name: { contains: searchQuery } });
  }
  // Add tag filters - prompts must contain all selected tags
  if (selectedTags.length > 0) {
    selectedTags.forEach(tag => {
      filters.push({ tags: { contains: tag } });
    });
  }
  // Add agent filters - prompts must be assigned to selected agents
  if (selectedAgents.length > 0) {
    selectedAgents.forEach(agentId => {
      filters.push({ assigned_agents: { contains: agentId } });
    });
  }

  // Fetch prompts with server-side filtering and sorting
  const { data, loading, error, refetch } = usePrompts({
    page,
    limit,
    filters,
    sort: { field: sortBy, direction: "DESC" },
  });

  const prompts = data?.prompt_libraryPagination?.items || [];
  const pageInfo = data?.prompt_libraryPagination?.pageInfo;

  // Fetch all available tags
  const { data: tagsData } = useUniquePromptTags();
  const availableTags = tagsData?.getUniquePromptTags || [];

  // Auto-select first prompt in list view
  useEffect(() => {
    if (prompts.length > 0 && !selectedPrompt) {
      setSelectedPrompt(prompts[0]);
    }
  }, [prompts, selectedPrompt]);

  // Update selected prompt when prompts data changes (after edit/refetch)
  useEffect(() => {
    if (selectedPrompt && prompts.length > 0) {
      const updatedPrompt = prompts.find(p => p.id === selectedPrompt.id);
      if (updatedPrompt) {
        setSelectedPrompt(updatedPrompt);
      }
    }
  }, [prompts]);

  return (
    <div className="h-full flex-1 flex-col p-4 sm:p-6 lg:p-8">
      {/* Hero Header - Editorial Style */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 sm:gap-0 border-b border-border/50 pb-6 sm:pb-8 mb-6 sm:mb-8">
        <div className="space-y-2 sm:space-y-4 max-w-3xl animate-in fade-in slide-in-from-left-8 duration-700">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-none">
            Prompt
            <br />
            <span className="text-primary">Library</span>
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-xl">
            Craft, organize, and deploy prompts across your AI infrastructure.
          </p>
        </div>
        <div className="w-full sm:w-auto animate-in fade-in slide-in-from-right-8 duration-700">
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            size="lg"
            className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-150 bg-primary hover:bg-primary/90"
          >
            <Plus className="mr-2 h-5 w-5" />
            <span className="hidden xs:inline">New Prompt</span>
            <span className="xs:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 lg:gap-6 mb-4">
        <div className="relative flex-1 min-w-0 sm:min-w-[280px] sm:max-w-lg">
          <Search className="absolute left-3 sm:left-4 top-1/2 h-4 sm:h-5 w-4 sm:w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 sm:pl-12 h-11 sm:h-12 text-sm sm:text-base border-2 focus-visible:ring-offset-2 sm:focus-visible:ring-offset-4 focus-visible:border-primary/50 focus-visible:shadow-lg focus-visible:shadow-primary/10 transition-all duration-200"
          />
        </div>

        <PromptFilters
          sortBy={sortBy}
          onSortChange={setSortBy}
          selectedTags={selectedTags}
          onTagsChange={setSelectedTags}
          selectedAgents={selectedAgents}
          onAgentsChange={setSelectedAgents}
        />
      </div>

      {/* Selectable Tag Chips */}
      {availableTags.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Folders</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {availableTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <Badge
                  key={tag}
                  variant={isSelected ? "default" : "outline"}
                  className={`capitalize cursor-pointer transition-all duration-200 text-sm px-3 py-1.5 ${
                    isSelected
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedTags(selectedTags.filter((t) => t !== tag));
                    } else {
                      setSelectedTags([...selectedTags, tag]);
                    }
                  }}
                >
                  {tag}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Prompts Display */}
      {error ? (
        <div className="flex flex-col items-center justify-center py-12 px-8 max-w-md mx-auto">
          <div className="p-3 rounded-full bg-destructive/10 mb-4">
            <FileText className="h-8 w-8 text-destructive" />
          </div>
          <p className="text-base font-semibold text-destructive mb-2">Failed to load prompts</p>
          <p className="text-sm text-muted-foreground text-center mb-4">There was an error loading your prompt library. Please try refreshing the page.</p>
          <Button onClick={() => refetch()} variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10">
            Try Again
          </Button>
        </div>
      ) : (
        <>
          {/* List View - Side by Side on Desktop, Stacked on Mobile */}
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-auto lg:h-[calc(100vh-280px)] animate-in fade-in duration-500">
              {/* Left Panel - Prompt List */}
              <div className="w-full lg:w-80 xl:w-96 flex flex-col border rounded-lg shadow-sm bg-card overflow-hidden max-h-[50vh] lg:max-h-none">
                <div className="p-3 sm:p-4 border-b bg-muted/30">
                  <p className="text-xs sm:text-sm font-semibold text-muted-foreground">
                    {prompts.length} {prompts.length === 1 ? "prompt" : "prompts"}
                  </p>
                </div>
                <div className="flex-1 overflow-auto">
                  {loading ? (
                    <div className="flex items-center justify-center h-full p-8">
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                        <span className="text-sm font-medium text-muted-foreground">Loading...</span>
                      </div>
                    </div>
                  ) : prompts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        {searchQuery ? "No matches found" : "No prompts yet"}
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        {searchQuery
                          ? "Try a different search term"
                          : "Create your first prompt to get started"}
                      </p>
                      {!searchQuery && (
                        <Button
                          onClick={() => setIsCreateModalOpen(true)}
                          size="sm"
                          className="shadow-md"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          New Prompt
                        </Button>
                      )}
                    </div>
                  ) : (
                    prompts.map((prompt) => (
                      <PromptListItem
                        key={prompt.id}
                        prompt={prompt}
                        isSelected={selectedPrompt?.id === prompt.id}
                        onClick={() => setSelectedPrompt(prompt)}
                        user={user}
                        onDelete={() => {
                          // If deleted prompt was selected, clear selection
                          if (selectedPrompt?.id === prompt.id) {
                            setSelectedPrompt(null);
                          }
                          refetch();
                        }}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Right Panel - Preview */}
              <div className="flex-1 min-w-0 min-h-[400px] lg:min-h-0">
                {selectedPrompt ? (
                  <PromptPreview
                    key={selectedPrompt.id}
                    prompt={selectedPrompt}
                    onUpdate={refetch}
                    onEdit={() => setIsEditModalOpen(true)}
                  />
                ) : (
                  <div className="h-full min-h-[300px] flex items-center justify-center border rounded-lg bg-muted/20">
                    <div className="text-center space-y-3 sm:space-y-4 px-6 sm:px-8">
                      <FileText className="size-12 sm:size-16 text-muted-foreground mx-auto" />
                      <div className="space-y-1 sm:space-y-2">
                        <p className="text-base sm:text-lg font-semibold text-muted-foreground">
                          Select a prompt to preview
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Choose a prompt from the list to view its details
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
        </>
      )
      }

      {/* Create Modal */}
      <PromptEditorModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={refetch}
        user={user}
      />

      {/* Edit Modal */}
      {selectedPrompt && (
        <PromptEditorModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          prompt={selectedPrompt}
          onSuccess={() => {
            refetch();
            setIsEditModalOpen(false);
          }}
          user={user}
        />
      )}
    </div >
  );
}
