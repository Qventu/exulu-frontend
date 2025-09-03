import Link from "next/link"
import { ChevronLeft, Info, Search, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useQuery, useMutation } from "@apollo/client";
import { GET_AGENTS, GET_AGENTS_BY_IDS, UPDATE_USER_BY_ID } from "@/queries/queries";
import { Agent } from "@EXULU_SHARED/models/agent";
import * as React from "react";
import { TruncatedText } from "./truncated-text";
import { useParams, usePathname } from "next/navigation";
import { Skeleton } from "./ui/skeleton";
import { AgentDetailsSheet } from "@/app/(application)/agents/components/agent-details-sheet";
import { UserContext } from "@/app/(application)/authenticated";
import { useContext, useState, useEffect } from "react";
import { User } from "@/types/models/user";
import { ChatSessionsComponent } from "@/app/(application)/chat/[agent]/chat/chat-sessions";

export function AgentNav() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [showAllFavorites, setShowAllFavorites] = React.useState(false);
  const [showAllAgents, setShowAllAgents] = React.useState(false);
  const params = useParams();
  const pathname = usePathname();
  const { user: init } = useContext(UserContext);
  const [user, setUser] = useState<User>(init);

  // Fetch favourite agents using GET_AGENTS_BY_IDS
  const favouriteAgents = useQuery(GET_AGENTS_BY_IDS, {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: {
      ids: user?.favourite_agents || []
    },
    skip: !user?.favourite_agents?.length,
  });

  // Fetch regular agents (excluding favourites when not searching)
  const agents = useQuery(GET_AGENTS, {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: {
      page: 1,
      limit: 200,
      filters: {
        type: {
          in: ["agent", "flow", "chat"]
        },
        ...(searchQuery ? {
          name: {
            contains: searchQuery
          }
        } : {})
      },
    },
  });

  const [updateUser] = useMutation(UPDATE_USER_BY_ID, {
    onCompleted: (data) => {
      setUser({ ...user, favourite_agents: data.usersUpdateOneById?.item?.favourite_agents });
    },
  });

  const handleInfoClick = (agentId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedAgentId(agentId);
    setSheetOpen(true);
  };

  const handleFavouriteToggle = (agentId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    console.log("user", user);
    const currentFavourites = user?.favourite_agents || [];
    const isFavourite = currentFavourites.includes(agentId);

    let newFavourites: string[];
    if (isFavourite) {
      newFavourites = currentFavourites.filter((id: string) => id !== agentId);
    } else {
      newFavourites = [...currentFavourites, agentId];
    }

    console.log("newFavourites", newFavourites);

    updateUser({
      variables: {
        id: user.id,
        favourite_agents: newFavourites
      }
    });
  };

  // Check if an agent is currently selected
  const selectedAgent = params.agent ? agents?.data?.agentsPagination?.items?.find(
    (agent: Agent) => agent.id === params.agent
  ) : null;

  const renderAgentImage = (agent: Agent) => {
    if (agent.image) {
      return (
        <img
          src={agent.image}
          alt={`${agent.name} profile`}
          className="h-4 w-4 rounded-full object-cover"
        />
      );
    } else {
      return (
        <div className="h-4 w-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
          {agent.name?.charAt(0).toUpperCase() || 'A'}
        </div>
      );
    }
  };

  useEffect(() => {
    setShowAllAgents(false)
    setShowAllFavorites(false)
  }, [params.agent]);

  return (
    <>
      <div className="pb-12 w-[250px]">
        <div className="space-y-4 py-4">
          <div>
            <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">Agents</h2>
            <div>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 border-0"
                />
              </div>
            </div>
            <div className="space-y-1 border-t px-2 pt-2">
              {
                (selectedAgent && !showAllAgents) && (
                  <div key={`fav-${selectedAgent.id}`} className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 flex-shrink-0"
                      onClick={() => setShowAllAgents(!showAllAgents)}
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Link onClick={() => setShowAllAgents(false)} href={`/chat/${selectedAgent.id}/${selectedAgent.type.toLowerCase()}`} className="flex-1">
                      <Button
                        onClick={() => setShowAllAgents(false)}
                        variant={pathname.includes(selectedAgent.id) ? "secondary" : "ghost"}
                        className="w-full justify-start gap-2 pr-1">
                        {renderAgentImage(selectedAgent)}
                        <span className="flex-1 text-left">
                          <TruncatedText text={selectedAgent.name} length={10} />
                        </span>
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 flex-shrink-0"
                      onClick={(e) => handleFavouriteToggle(selectedAgent.id, e)}
                    >
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 flex-shrink-0"
                      onClick={(e) => handleInfoClick(selectedAgent.id, e)}
                    >
                      <Info className="h-3 w-3" />
                    </Button>
                  </div>
                )
              }
              {
                (!selectedAgent || showAllAgents || searchQuery) && (
                  <>
                    {user?.favourite_agents && user?.favourite_agents?.length > 0 && !searchQuery && (
                      <>
                        {favouriteAgents.loading && (
                          <>
                            <Skeleton className="w-[100%] h-[32px] rounded-lg" />
                            <Skeleton className="w-[100%] h-[32px] rounded-lg" />
                          </>
                        )}
                        {!favouriteAgents.loading && (() => {
                          const favoriteAgentsList = favouriteAgents?.data?.agentByIds || [];
                          const displayedFavorites = showAllFavorites ? favoriteAgentsList : favoriteAgentsList.slice(0, 4);

                          return (
                            <>
                              {displayedFavorites.map((agent: Agent) => (
                                <div key={`fav-${agent.id}`} className="flex items-center gap-1">
                                  <Link href={`/chat/${agent.id}/${agent.type.toLowerCase()}`} className="flex-1">
                                    <Button
                                      variant={pathname.includes(agent.id) ? "secondary" : "ghost"}
                                      className="w-full justify-start gap-2 pr-1">
                                      {renderAgentImage(agent)}
                                      <span className="flex-1 text-left">
                                        <TruncatedText text={agent.name} length={10} />
                                      </span>
                                    </Button>
                                  </Link>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 flex-shrink-0"
                                    onClick={(e) => handleFavouriteToggle(agent.id, e)}
                                  >
                                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 flex-shrink-0"
                                    onClick={(e) => handleInfoClick(agent.id, e)}
                                  >
                                    <Info className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              {favoriteAgentsList.length > 4 && (
                                <Button
                                  variant="ghost"
                                  className="w-full justify-center text-xs text-muted-foreground h-8"
                                  onClick={() => setShowAllFavorites(!showAllFavorites)}
                                >
                                  {showAllFavorites
                                    ? 'Show less'
                                    : `Show more (${favoriteAgentsList.length - 4})`
                                  }
                                </Button>
                              )}
                            </>
                          );
                        })()}
                      </>
                    )}

                    {/* Regular Agents */}
                    {agents.loading && <>
                      <Skeleton className="w-[100%] h-[32px] rounded-lg" />
                      <Skeleton className="w-[100%] h-[32px] rounded-lg" />
                      <Skeleton className="w-[100%] h-[32px] rounded-lg" />
                      <Skeleton className="w-[100%] h-[32px] rounded-lg" />
                      <Skeleton className="w-[100%] h-[32px] rounded-lg" />
                    </>}
                    {!agents.loading && (() => {
                      const regularAgentsList = agents?.data?.agentsPagination?.items
                        ?.filter((agent: Agent) => !user?.favourite_agents?.includes(agent.id) || searchQuery) || [];
                      const displayedAgents = (searchQuery || showAllAgents) ? regularAgentsList : regularAgentsList.slice(0, 4);

                      return (
                        <>
                          {displayedAgents.map((agent: Agent) => (
                            <div key={agent.id} className="flex items-center gap-1">
                              <Link href={`/chat/${agent.id}/${agent.type.toLowerCase()}`} className="flex-1">
                                <Button
                                  variant={pathname.includes(agent.id) ? "secondary" : "ghost"}
                                  className="w-full justify-start gap-2 pr-1">
                                  {renderAgentImage(agent)}
                                  <span className="flex-1 text-left">
                                    <TruncatedText text={agent.name} length={14} />
                                  </span>
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 flex-shrink-0"
                                onClick={(e) => handleFavouriteToggle(agent.id, e)}
                              >
                                <Star className={`h-3 w-3 ${user?.favourite_agents?.includes(agent.id) ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 flex-shrink-0"
                                onClick={(e) => handleInfoClick(agent.id, e)}
                              >
                                <Info className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          {!searchQuery && regularAgentsList.length > 4 && (
                            <Button
                              variant="ghost"
                              className="w-full justify-center text-xs text-muted-foreground h-8"
                              onClick={() => setShowAllAgents(!showAllAgents)}
                            >
                              {showAllAgents
                                ? 'Show less'
                                : `Show more (${regularAgentsList.length - 4})`
                              }
                            </Button>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
            </div>
          </div>
          {/*<div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">Settings</h2>
          <div className="space-y-1">
            <Link href="/settings">
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </Link>
          </div>
        </div>*/}
        </div>
        {
          params.agent && (
            <ChatSessionsComponent agent={params.agent as string} type={"chat"} />
          )
        }
      </div>

      {selectedAgentId && (
        <AgentDetailsSheet
          agentId={selectedAgentId}
          open={sheetOpen}
          onOpenChange={(open) => {
            setSheetOpen(open);
            if (!open) {
              setSelectedAgentId(null);
            }
          }}
        />
      )}
    </>
  )
}

