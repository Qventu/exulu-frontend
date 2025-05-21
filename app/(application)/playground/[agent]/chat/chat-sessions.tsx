"use client"

import { useMutation, useQuery } from "@apollo/client";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { ChevronLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "@/app/(application)/authenticated";
import { Agent } from "@EXULU_SHARED/models/agent";
import { AgentSession } from "@EXULU_SHARED/models/agent-session";
import {
  CREATE_AGENT_SESSION,
  GET_AGENT_SESSIONS,
  REMOVE_AGENT_SESSION_BY_ID,
} from "@/queries/queries";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import {
  Tooltip,
  TooltipContent, TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


export function ChatSessionsComponent({ agent, type }: { agent: string, type: string }) {

  const pathname = usePathname();
  const { toast } = useToast();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showSessions, setShowSessions] = useState(true);
  const { user, setUser } = useContext(UserContext);
  const [sessionName, setSessionName] = useState("");

  useEffect(() => {
    const checkScreenWidth = () => {
      setIsMobile(window.innerWidth <= 1023);
    };

    // Initial check
    checkScreenWidth();

    // Event listener for screen width changes
    window.addEventListener("resize", checkScreenWidth);

    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener("resize", checkScreenWidth);
    };
  }, []);

  const router = useRouter();

  let [search, setSearch]: any = useState({ searchString: null });

  const sessionsQuery = useQuery(GET_AGENT_SESSIONS, {
    returnPartialData: true,
    fetchPolicy: "network-only",
    nextFetchPolicy: "network-only",
    variables: {
      page: 1,
      limit: 40,
      filters: {
        agentId: agent
      }
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
  );

  useEffect(() => {
    let variables: any = {
      page: 1,
      limit: 40,
    };
    if (search && search?.length > 2) {
      variables.filters = { agentId: agent, nameSearch: search };
    } else {
      variables.filters = { agentId: agent };
    }
    sessionsQuery.refetch(variables);
  }, [search]);

  const handleCreateSession = async () => {
    const newSession = await createAgentSession({
      variables: {
        user: user.id,
        agent: agent,
        type: "FLOW",
        title: sessionName.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    if (newSession.errors) {
      console.error("error", newSession.errors);
      return;
    }
    if (
      !newSession.data?.agentSessionCreateOne?.record?.id
    ) {
      console.error("error", "failed to create session");
      return;
    }
    setSessionName("");
    sessionsQuery.refetch();
    router.push(
      `/playground/${agent}/${type}/${newSession.data?.agentSessionCreateOne?.record?.id}`,
    );
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.altKey) && e.key === 'b') {
        setShowSessions(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      {!showSessions && (
        <div
          onClick={() => setShowSessions(true)}
          className="relative hidden min-w-[10px] flex-col items-start md:flex h-100 overflow-y-scroll border-r flex hover:bg-muted cursor-pointer"
          x-chunk="dashboard-03-chunk-0"
        >
          <div className="m-auto rotate-90 flex">
            <span className="mt-3">
              Sessions
            </span>
          </div>
        </div>
      )}
      {showSessions && (
        <div
          className="md:min-w-[400px] relative hidden flex-col items-start md:flex h-100 overflow-y-scroll border-r"
          x-chunk="dashboard-03-chunk-0"
        >
          <div className="bg-background/95 w-full backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <form>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                <Input
                  onKeyUp={(e) => {
                    const searchString = e.currentTarget.value;
                    setSearch(searchString);
                  }}
                  placeholder="Search by name"
                  className="pl-8 border-0"
                />
              </div>
            </form>
          </div>

          <div className="flex w-full items-center gap-2 p-3 border-t">
            <Input
              autoFocus={true}
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateSession();
                }
              }}
              placeholder="New session name"
              className="flex-1"
            />
            <Button
              variant="secondary"
              tabIndex={1}
              disabled={createAgentSessionResult.loading || !sessionName.trim()}
              onClick={async () => {
                // create a new session
                handleCreateSession();
              }}
            >
              <div className="font-semibold">Create</div>
            </Button>
            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSessions(false)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Collapse (Ctrl+B)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {sessionsQuery.loading && (
            <div className="w-full flex">
              <Loading className="mx-auto mt-5" />
            </div>
          )}

          {!sessionsQuery.loading && !sessionsQuery?.data?.agentSessionPagination?.items?.length && (
            <div className="w-full flex">
              <p className="mx-auto mt-5">No sessions found.</p>
            </div>
          )}

          {!sessionsQuery.loading
            ? sessionsQuery?.data?.agentSessionPagination?.items?.map(
              (
                item: Omit<AgentSession, "agent"> & {
                  agent: Agent;
                },
              ) => (
                <button
                  key={item.id}
                  className={cn(
                    "w-full flex flex-col items-start gap-2 rounded-lg border-t p-3 text-left text-sm transition-all hover:bg-accent",
                    pathname.includes(item.id) && "bg-muted",
                  )}
                  onClick={() => {
                    router.push(`/playground/${agent}/${type}/${item.id}`);
                  }}
                >
                  <div className="flex w-full flex-col gap-1">
                    <div className="flex items-center">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-medium">
                          {item.title
                            ? item.title?.substring(0, 20)
                            : "No title"}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "ml-auto text-xs",
                          pathname.includes(item.id)
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {item.updatedAt && !isCollapsed
                          ? formatDistanceToNow(
                            new Date(item.updatedAt),
                            {
                              addSuffix: true,
                            },
                          )
                          : null}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="flex size-8 p-0 data-[state=open]:bg-muted"
                          >
                            <DotsHorizontalIcon className="size-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-[160px]">
                          <DropdownMenuItem
                            onClick={() => {
                              removeSession({
                                variables: {
                                  id: item.id,
                                },
                              });
                              toast({
                                title: "Deleting session",
                                description: "We deleted the session.",
                              });
                            }}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <small className="text-xs text-muted-foreground">
                      {item.agent?.name}
                    </small>
                  </div>
                </button>
              ),
            )
            : null}
        </div>
      )}
    </>
  );
}
