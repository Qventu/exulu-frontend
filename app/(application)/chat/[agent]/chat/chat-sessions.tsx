"use client"

import { useMutation, useQuery } from "@apollo/client";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { PlusIcon, Search } from "lucide-react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import Link from "next/link";
import { checkChatSessionWriteAccess } from "@/lib/check-chat-session-write-access";

export function ChatSessionsComponent({ agent, type }: { agent: string, type: string }) {

  const pathname = usePathname();
  const { toast } = useToast();
  const { user } = useContext(UserContext);
  const [sessionName, setSessionName] = useState("");
  const isMobile = useIsMobile();
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
        agent: {
          eq: agent
        }
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
      variables.filters = { agent: { eq: agent }, title: { contains: search } };
    } else {
      variables.filters = { agent: { eq: agent } };
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
      !newSession.data?.agent_sessionsCreateOne?.item?.id
    ) {
      console.error("error", "failed to create session");
      return;
    }
    setSessionName("");
    sessionsQuery.refetch();
    router.push(
      `/chat/${agent}/${type}/${newSession.data?.agent_sessionsCreateOne?.item?.id}`,
    );
  }

  return (
    <div
      key={agent + type}
      className="relative hidden flex-col items-start md:flex h-100 overflow-y-scroll border-r"
      x-chunk="dashboard-03-chunk-0">
      <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">Sessions</h2>

      <div className="bg-background/95 w-full backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <form>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input
              onKeyUp={(e) => {
                const searchString = e.currentTarget.value;
                setSearch(searchString);
              }}
              placeholder="Search sessions"
              className="pl-8 border-0"
            />
          </div>
        </form>
      </div>

      <div className="flex w-full items-center gap-2 p-3 border-t justify-between">
        <Input
          autoFocus={true}
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleCreateSession();
            }
          }}
          placeholder="Name"
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
          <div className="font-semibold">
            <PlusIcon />
          </div>
        </Button>
      </div>
      {sessionsQuery.loading && (
        <div className="w-full flex">
          <Loading className="mx-auto mt-5" />
        </div>
      )}

      {!sessionsQuery.loading && !sessionsQuery?.data?.agent_sessionsPagination?.items?.length && (
        <div className="w-full flex">
          <p className="mx-auto mt-5">No sessions found.</p>
        </div>
      )}

      {!sessionsQuery.loading
        ? sessionsQuery?.data?.agent_sessionsPagination?.items?.map(
          (
            item: Omit<AgentSession, "agent"> & {
              agent: Agent;
            },
          ) => {

            const writeAccess = checkChatSessionWriteAccess(item, user);

            return (
              <div key={item.id} className={`w-full px-2 flex flex-col items-start gap-0 rounded-none border-none text-left text-sm mb-2`}>
                <Link
                  key={item.id}
                  href={`/chat/${agent}/${type}/${item.id}`}
                  className={cn(
                    `p-2 w-full flex flex-col items-start gap-2 rounded-md p-3 text-left text-sm transition-all hover:bg-accent`,
                    pathname.includes(item.id) && "bg-muted",
                    writeAccess ? "border border-l-4 border-r-0 border-y-0 border-gray-700" : "border border-l-4 border-r-0 border-y-0 border-yellow-900",
                  )}
                >
                  <div className="flex w-full flex-col px-2">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-2">
                        <div className="text-md font-medium max-w-[80%] truncate">
                          {item.title
                            ? item.title?.substring(0, 20)
                            : "No title"}
                        </div>

                        <div
                          className={cn(
                            "ml-0 text-xs capitalize",
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
                      )}
                    </div>
                    <small className="text-xs text-muted-foreground">
                      {item.agent?.name}
                    </small>
                  </div>
                </Link>
              </div>
            )
          },
        )
        : null}
    </div>
  );
}
