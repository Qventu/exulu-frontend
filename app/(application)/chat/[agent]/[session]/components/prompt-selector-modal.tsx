import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Star, Eye, FileText, ThumbsUp } from "lucide-react";
import { usePrompts } from "@/hooks/use-prompts";
import { PromptLibrary } from "@/types/models/prompt-library";
import { extractVariables } from "@/lib/prompts/extract-variables";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface PromptSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPrompt: (prompt: PromptLibrary) => void;
  agentId?: string;
}

export function PromptSelectorModal({
  open,
  onOpenChange,
  onSelectPrompt,
  agentId,
}: PromptSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Build filters based on search
  const filters: any[] = [];
  if (searchQuery) {
    filters.push({
      or: [
        { name: { contains: searchQuery } },
        { description: { contains: searchQuery } },
        { content: { contains: searchQuery } },
      ],
    });
  }

  // Fetch prompts
  const { data, loading } = usePrompts({
    page: 1,
    limit: 50,
    filters,
    sort: { field: "favorite_count", direction: "DESC" },
  });

  const prompts = data?.prompt_libraryPagination?.items || [];

  // Filter by agent assignment (client-side since assigned_agents is JSON)
  const agentPrompts = agentId
    ? prompts.filter(
        (p) => p.assigned_agents && p.assigned_agents.includes(agentId)
      )
    : [];

  const otherPrompts = agentId
    ? prompts.filter(
        (p) => !p.assigned_agents || !p.assigned_agents.includes(agentId)
      )
    : prompts;

  const handleSelectPrompt = (prompt: PromptLibrary) => {
    onSelectPrompt(prompt);
    onOpenChange(false);
    setSearchQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select a Prompt</DialogTitle>
          <DialogDescription>
            Choose a prompt template to insert into your message
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Prompts List */}
        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Recommended Prompts (assigned to agent) */}
              {agentPrompts.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ThumbsUp className="h-4 w-4 text-yellow-500" />
                    <h3 className="text-sm font-medium">Recommended for this agent</h3>
                  </div>
                  <div className="space-y-2">
                    {agentPrompts.map((prompt) => (
                      <PromptListItem
                        key={prompt.id}
                        prompt={prompt}
                        onSelect={handleSelectPrompt}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All Other Prompts */}
              {otherPrompts.length > 0 && (
                <div>
                  {agentPrompts.length > 0 && (
                    <h3 className="text-sm font-medium mb-2">All Prompts</h3>
                  )}
                  <div className="space-y-2">
                    {otherPrompts.map((prompt) => (
                      <PromptListItem
                        key={prompt.id}
                        prompt={prompt}
                        onSelect={handleSelectPrompt}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {prompts.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-3" />
                  <h3 className="text-lg font-medium">No prompts found</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery
                      ? "Try a different search term"
                      : "Create your first prompt in the Prompt Library"}
                  </p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface PromptListItemProps {
  prompt: PromptLibrary;
  onSelect: (prompt: PromptLibrary) => void;
}

function PromptListItem({ prompt, onSelect }: PromptListItemProps) {
  const variables = extractVariables(prompt.content);

  return (
    <button
      onClick={() => onSelect(prompt)}
      className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="font-medium text-sm">{prompt.name}</h4>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
          <div className="flex items-center gap-0.5">
            <ThumbsUp className="h-3 w-3" />
            <span>{prompt.favorite_count || 0}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <Eye className="h-3 w-3" />
            <span>{prompt.usage_count || 0}</span>
          </div>
        </div>
      </div>

      {prompt.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {prompt.description}
        </p>
      )}

      <div className="flex flex-wrap gap-1">
        {variables.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {variables.length} variable{variables.length !== 1 ? "s" : ""}
          </Badge>
        )}
        {prompt.tags?.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="secondary" className="text-xs">
            {tag}
          </Badge>
        ))}
        {prompt.tags && prompt.tags.length > 2 && (
          <Badge variant="secondary" className="text-xs">
            +{prompt.tags.length - 2}
          </Badge>
        )}
      </div>
    </button>
  );
}
