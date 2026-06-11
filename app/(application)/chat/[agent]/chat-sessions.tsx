"use client"

import { useMutation, useQuery } from "@apollo/client";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { ArrowLeft, CirclePlus, SearchAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useState, useEffect } from "react";
import { UserContext } from "@/app/(application)/authenticated";
import { Agent } from "@EXULU_SHARED/models/agent";
import { AgentSession } from "@EXULU_SHARED/models/agent-session";
import {
  CREATE_AGENT_SESSION,
  GET_AGENT_SESSIONS,
  REMOVE_AGENT_SESSION_BY_ID,
  UPDATE_AGENT_SESSION_TITLE,
} from "@/queries/queries";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { checkChatSessionWriteAccess } from "@/lib/check-chat-session-write-access";
import { Skeleton } from "@/components/ui/skeleton";
import { Loading } from "@/components/ui/loading";

export function ChatSessionsComponent({ agent, type }: { agent: Agent, type: string }) {

  const pathname = usePathname();
  const { user } = useContext(UserContext);
  const router = useRouter();
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionDialogMode, setSessionDialogMode] = useState<"create" | "rename">("create");
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [sessionDialogName, setSessionDialogName] = useState("");
  const [limit] = useState(20);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isNavigatingToNew, setIsNavigatingToNew] = useState(false);

  // Reset loading state when pathname changes
  useEffect(() => {
    setIsNavigatingToNew(false);
  }, [pathname]);

  const sessionsQuery = useQuery(GET_AGENT_SESSIONS, {
    returnPartialData: true,
    fetchPolicy: "network-only",
    nextFetchPolicy: "network-only",
    variables: {
      page: 1,
      limit: limit,
      filters: {
        agent: {
          eq: agent.id
        }
      }
    },
    onCompleted: () => {
      setIsInitialLoad(false);
    },
  });

  const [removeSession, removeSessionResult] = useMutation(
    REMOVE_AGENT_SESSION_BY_ID,
    {
      refetchQueries: [
        GET_AGENT_SESSIONS,
        "GetAgentSessions",
      ],
    },
  );

  const [createAgentSession, createAgentSessionResult] = useMutation(
    CREATE_AGENT_SESSION,
    {
      refetchQueries: [
        GET_AGENT_SESSIONS,
        "GetAgentSessions",
      ],
    }
  );

  const [updateSessionTitle, updateSessionTitleResult] = useMutation(
    UPDATE_AGENT_SESSION_TITLE,
    {
      refetchQueries: [
        GET_AGENT_SESSIONS,
        "GetAgentSessions",
      ],
    },
  );

  const handleCreateSession = async () => {
    if (!sessionDialogName.trim()) return;

    const newSession = await createAgentSession({
      variables: {
        user: user.id,
        agent: agent.id,
        type: "FLOW",
        title: sessionDialogName.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    if (newSession.errors) {
      console.error("error", newSession.errors);
      toast.error("Error", { description: "Failed to create session." });
      return;
    }
    if (
      !newSession.data?.agent_sessionsCreateOne?.item?.id
    ) {
      console.error("error", "failed to create session");
      toast.error("Error", { description: "Failed to create session." });
      return;
    }

    toast.success("Session created", { description: "The session has been created successfully." });

    setSessionDialogOpen(false);
    setSessionDialogName("");
    sessionsQuery.refetch();
    router.push(
      `/chat/${agent.id}/${newSession.data?.agent_sessionsCreateOne?.item?.id}`,
    );
  }

  const handleRenameSession = async () => {
    if (!renameSessionId || !sessionDialogName.trim()) return;

    const result = await updateSessionTitle({
      variables: {
        id: renameSessionId,
        title: sessionDialogName.trim(),
      },
    });

    if (result.errors) {
      console.error("error", result.errors);
      toast.error("Error", { description: "Failed to rename session." });
      return;
    }

    toast.success("Session renamed", { description: "The session has been renamed successfully." });

    setSessionDialogOpen(false);
    setRenameSessionId(null);
    setSessionDialogName("");
  }

  const handleSessionDialogSubmit = async () => {
    if (sessionDialogMode === "create") {
      await handleCreateSession();
    } else {
      await handleRenameSession();
    }
  }

  const items = sessionsQuery?.data?.agent_sessionsPagination?.items || sessionsQuery?.previousData?.agent_sessionsPagination?.items || [];
  const pageInfo = sessionsQuery?.data?.agent_sessionsPagination?.pageInfo || {}
  return (
    <div
      key={agent.id + type}
      className="relative hidden flex-col items-start md:flex border-r h-full overflow-y-auto w-[250px] flex-shrink-0"
      x-chunk="dashboard-03-chunk-0">

      <div className="flex items-center gap-2 px-2 pt-2 w-full">
        <Button variant="link" size="sm" asChild>
          <Link href="/chat">
            <ArrowLeft className="size-4" />
            <span className="ml-2">Back to agent selection</span>
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2 pl-4 pr-2 py-2">
        <h2 className="text-lg font-light tracking-tight">{agent.name}:</h2>
      </div>

      <div className={`w-full px-2 flex flex-col items-start gap-0 rounded-none border-none text-left text-sm mb-2`}>
        <Link
          key="new-session"
          href={`/chat/${agent.id}/new`}
          onClick={() => {
            // Only set loading state if we're navigating away from current page
            if (!pathname.includes('/new')) {
              setIsNavigatingToNew(true);
            }
          }}
          className={cn(
            `group p-2 w-full flex flex-col items-start gap-2 rounded-md py-2 pl-0 pr-2 text-left text-sm transition-all hover:bg-accent`,
            pathname.includes('/new') && "bg-muted",
            isNavigatingToNew && "opacity-50 pointer-events-none"
          )}
        >
          <div className="flex w-full flex-col px-2">
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex flex-col min-w-0 flex-1">
                <div className="text-md font-medium truncate flex items-center gap-2">
                  {isNavigatingToNew ? (
                    <Loading className="size-4" />
                  ) : (
                    <CirclePlus className="size-4 text-primary transition-transform group-hover:scale-110 group-hover:text-primary-foreground" />
                  )}
                  <p className="text-sm font-medium">
                    {isNavigatingToNew ? "Loading..." : "New session"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Link>
      </div>

      <div className={`w-full px-2 flex flex-col items-start gap-0 rounded-none border-none text-left text-sm mb-2`}>
        <div
          key="new-session"
          onClick={() => {
            router.push(`/chat/${agent.id}/search`);
          }}
          className={cn(
            `cursor-pointer group p-2 w-full flex flex-col items-start gap-2 rounded-md py-2 pl-0 pr-2 text-left text-sm transition-all hover:bg-accent`
          )}
        >
          <div className="flex w-full flex-col px-2">
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex flex-col min-w-0 flex-1">
                <div className="text-md font-medium truncate flex items-center gap-2">
                  <SearchAlert className="size-4 transition-transform group-hover:scale-110 group-hover:text-primary-foreground" />
                  <p className="text-sm font-medium">Search chats</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 mb-2 mt-5">
        <small className="text-muted-foreground text-sm font-light">Recents</small>
      </div>

      {isInitialLoad && sessionsQuery.loading && (
        <div className="w-full flex flex-col p-2 pt-0 pb-2">
          <Skeleton className="w-full rounded h-[40px] rounded-md" />
          <Skeleton className="w-full rounded h-[40px] rounded-md mt-4" />
          <Skeleton className="w-full rounded h-[40px] rounded-md mt-4" />
          <Skeleton className="w-full rounded h-[40px] rounded-md mt-4" />
          <Skeleton className="w-full rounded h-[40px] rounded-md mt-4" />
          <Skeleton className="w-full rounded h-[40px] rounded-md mt-4" />
          <Skeleton className="w-full rounded h-[40px] rounded-md mt-4" />
          <Skeleton className="w-full rounded h-[40px] rounded-md mt-4" />
          <Skeleton className="w-full rounded h-[40px] rounded-md mt-4" />
          <Skeleton className="w-full rounded h-[40px] rounded-md mt-4" />
          <Skeleton className="w-full rounded h-[40px] rounded-md mt-4" />
          <Skeleton className="w-full rounded h-[40px] rounded-md mt-4" />
        </div>
      )}

      {!isInitialLoad && !items?.length && (
        <div className="w-full flex">
          <small className="mx-auto mt-5 text-muted-foreground">No sessions found.</small>
        </div>
      )}



      {!isInitialLoad
        ? items?.map(
          (
            item: Omit<AgentSession, "agent"> & {
              agent: Agent;
            },
          ) => {

            const writeAccess = checkChatSessionWriteAccess({
              ...item,
              agent: item.agent.id
            }, user);

            return (
              <div key={item.id} className={`w-full px-2 flex flex-col items-start gap-0 rounded-none border-none text-left text-sm`}>
                <Link
                  key={item.id}
                  href={`/chat/${agent.id}/${item.id}`}
                  className={cn(
                    `group p-2 w-full flex flex-col items-start gap-2 rounded-md py-2 pl-0 pr-2 text-left text-sm transition-all hover:bg-accent`,
                    pathname.includes(item.id) && "bg-muted",
                  )}
                >
                  <div className="flex w-full flex-col px-2">
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="text-md font-medium truncate">
                          {item.title
                            ? item.title?.substring(0, 40)
                            : "No title"}
                        </div>

                        <div
                          className={cn(
                            "ml-0 text-xs capitalize max-h-0 opacity-0 overflow-hidden group-hover:max-h-10 group-hover:opacity-100 transition-all duration-200",
                            pathname.includes(item.id)
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {item.updatedAt
                            ? formatDistanceToNow(
                              new Date(item.updatedAt),
                              {
                                addSuffix: true,
                              },
                            )
                            : null}.
                        </div>
                      </div>

                      {writeAccess && (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="flex size-8 p-0 data-[state=open]:bg-muted flex-shrink-0 max-h-0 max-w-0 opacity-0 group-hover:max-h-10 group-hover:max-w-10 group-hover:opacity-100 transition-all duration-200"
                            >
                              <DotsHorizontalIcon className="size-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-[160px]">
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSessionDialogMode("rename");
                                setRenameSessionId(item.id);
                                setSessionDialogName(item.title || "");
                                setSessionDialogOpen(true);
                              }}>
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => {
                                removeSession({
                                  variables: {
                                    id: item.id,
                                  },
                                });
                                toast("Deleting session", { description: "We deleted the session." });
                              }}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            )
          },
        )
        : null}

      {!isInitialLoad &&
        items?.length > 0 &&
        items?.length < pageInfo?.itemCount && (
          <div className="w-full mb-2">
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
              onClick={() => {
                router.push(`/chat/${agent.id}/search`);
              }}
            >
              Show all chats
            </Button>
          </div>
        )}

      <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sessionDialogMode === "create" ? "Create New Session" : "Rename Session"}
            </DialogTitle>
            <DialogDescription>
              {sessionDialogMode === "create"
                ? "Enter a name for your new session."
                : "Enter a new name for this session."}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={sessionDialogName}
            onChange={(e) => setSessionDialogName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSessionDialogSubmit();
              }
            }}
            placeholder="Session name"
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSessionDialogOpen(false);
                setRenameSessionId(null);
                setSessionDialogName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSessionDialogSubmit}
              disabled={
                (sessionDialogMode === "rename" ? updateSessionTitleResult.loading : createAgentSessionResult.loading)
                || !sessionDialogName.trim()
              }
            >
              {sessionDialogMode === "create" ? "Create" : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
