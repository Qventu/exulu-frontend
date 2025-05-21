import Link from "next/link"
import { Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {useQuery} from "@apollo/client";
import {GET_AGENTS} from "@/queries/queries";
import {Loading} from "@/components/ui/loading";
import {Agent} from "@EXULU_SHARED/models/agent";
import * as React from "react";
import { TruncatedText } from "./truncated-text";
import { usePathname } from "next/navigation";

export function AgentNav() {
  
  const pathname = usePathname();
  const agents = useQuery(GET_AGENTS, {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: {
      page: 1,
      limit: 200,
      filters: {},
    },
  });

  return (
    <div className="pb-12 w-64">
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">Agents</h2>
          <div className="space-y-1">
            {agents.loading && <Loading />}
            {!agents.loading
                ? agents?.data?.agentPagination?.items?.map(
                    (agent: Agent) => (
                        <Link key={agent.id} href={`/playground/${agent.id}/${agent.type.toLowerCase()}`}>
                          <Button
                              variant={pathname.includes(agent.id) ? "secondary" : "ghost"}
                              className="w-full justify-start gap-2">
                            <Bot className="h-4 w-4" />
                            <span className="flex-1 text-left">
                              <TruncatedText text={agent.name} length={10}/>
                            </span>
                            <Badge variant={"outline"} className="ml-2">
                              {agent.type}
                            </Badge>
                          </Button>
                        </Link>
                    )
                ) : null
            }
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
    </div>
  )
}

