"use client"

import { useMutation, useQuery } from "@apollo/client";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { ArrowLeft, Trash2, Search as SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useContext, useEffect, useState } from "react";
import { UserContext } from "@/app/(application)/authenticated";
import { Agent } from "@EXULU_SHARED/models/agent";
import { AgentSession } from "@EXULU_SHARED/models/agent-session";
import {
  GET_AGENT_SESSIONS,
  REMOVE_AGENT_SESSION_BY_ID,
} from "@/queries/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { checkChatSessionWriteAccess } from "@/lib/check-chat-session-write-access";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SearchPage({ params }: { params: Promise<{ agent: string }> }) {
  const resolvedParams = React.use(params);
  const agentId = resolvedParams.agent;
  const { user } = useContext(UserContext);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [limit, setLimit] = useState(50);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const sessionsQuery = useQuery(GET_AGENT_SESSIONS, {
    returnPartialData: true,
    fetchPolicy: "network-only",
    nextFetchPolicy: "network-only",
    variables: {
      page: 1,
      limit: limit,
      filters: {
        agent: {
          eq: agentId
        },
        ...(searchQuery.length > 2 && {
          title: {
            contains: searchQuery
          }
        })
      }
    },
    onCompleted: () => {
      setIsInitialLoad(false);
    },
  });

  const [removeSession] = useMutation(
    REMOVE_AGENT_SESSION_BY_ID,
    {
      refetchQueries: [
        GET_AGENT_SESSIONS,
        "GetAgentSessions",
      ],
    },
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      sessionsQuery.refetch();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, limit]);

  const handleSessionClick = (sessionId: string) => {
    router.push(`/chat/${agentId}/${sessionId}`);
  };

  const toggleSessionSelection = (sessionId: string) => {
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId);
    } else {
      newSelected.add(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const toggleSelectAll = () => {
    const writableItems = items.filter((item: any) => {
      const writeAccess = checkChatSessionWriteAccess({
        ...item,
        agent: item.agent
      }, user);
      return writeAccess;
    });

    if (selectedSessions.size === writableItems.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(writableItems.map((item: any) => item.id)));
    }
  };

  const handleBulkDelete = async () => {
    const deletionPromises = Array.from(selectedSessions).map(sessionId =>
      removeSession({
        variables: {
          id: sessionId,
        },
      })
    );

    try {
      await Promise.all(deletionPromises);
      toast.success("Sessions deleted", { description: `${selectedSessions.size} session(s) have been deleted.` });
      setSelectedSessions(new Set());
      setDeleteDialogOpen(false);
    } catch (error) {
      toast.error("Error", { description: "Failed to delete some sessions." });
    }
  };

  const items = sessionsQuery?.data?.agent_sessionsPagination?.items ||
                sessionsQuery?.previousData?.agent_sessionsPagination?.items || [];
  const pageInfo = sessionsQuery?.data?.agent_sessionsPagination?.pageInfo || {};

  const writableItems = items.filter((item: any) => {
    const writeAccess = checkChatSessionWriteAccess({
      ...item,
      agent: item.agent
    }, user);
    return writeAccess;
  });

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex flex-col gap-4 p-6 border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/chat/${agentId}`}>
              <ArrowLeft className="size-4" />
              <span className="ml-2">Back to chat</span>
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search chat sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {selectedSessions.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="size-4 mr-2" />
              Delete {selectedSessions.size} session{selectedSessions.size !== 1 ? 's' : ''}
            </Button>
          )}
        </div>

        {writableItems.length > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={selectedSessions.size === writableItems.length && writableItems.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <label
              htmlFor="select-all"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Select all
            </label>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isInitialLoad && sessionsQuery.loading && (
          <div className="w-full flex flex-col gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="w-full h-[80px] rounded-md" />
            ))}
          </div>
        )}

        {!isInitialLoad && !items?.length && (
          <div className="w-full flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">
              {searchQuery.length > 0 ? "No sessions found matching your search." : "No sessions found."}
            </p>
          </div>
        )}

        {!isInitialLoad && items?.length > 0 && (
          <div className="flex flex-col gap-2">
            {items.map((item: Omit<AgentSession, "agent"> & { agent: Agent }) => {
              const writeAccess = checkChatSessionWriteAccess({
                ...item,
                agent: item.agent.id
              }, user);

              const isSelected = selectedSessions.has(item.id);

              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-lg border transition-all hover:bg-accent cursor-pointer",
                    isSelected && "bg-muted border-primary"
                  )}
                  onClick={() => handleSessionClick(item.id)}
                >
                  {writeAccess && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSessionSelection(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">
                          {item.title || "Untitled Session"}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.updatedAt
                            ? `Updated ${formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}`
                            : "No update time"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isInitialLoad &&
          items?.length > 0 &&
          items?.length < pageInfo?.itemCount && (
            <div className="w-full mt-6">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLimit(prevLimit => prevLimit + 50)}
                disabled={sessionsQuery.loading}
              >
                {sessionsQuery.loading ? 'Loading...' : `Show more (${items?.length} of ${pageInfo?.itemCount})`}
              </Button>
            </div>
          )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sessions</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedSessions.size} session{selectedSessions.size !== 1 ? 's' : ''}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}