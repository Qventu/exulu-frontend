"use client";

import * as React from "react";
import { AgentBackend } from "@EXULU_SHARED/models/agent-backend";
import { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@apollo/client";
import { GET_PROVIDERS } from "@/queries/queries";

export function AgentBackendSelector({
  onSelect,
  type
}: any & { onSelect: (id) => void, type: "CHAT" | "CUSTOM" }) {

  const [selected, setSelected] = React.useState<AgentBackend | undefined>();
  const { loading: isLoading, error, data, refetch, previousData } = useQuery(GET_PROVIDERS, {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
  });

  let providers: AgentBackend[] = []

  console.log("data", data)

  if (type.toLowerCase() === "chat") {
    providers = data?.providers?.items?.filter((provider: any) => provider.type === "agent")
  }

  if (type.toLowerCase() === "custom") {
    providers = data?.providers?.items?.filter((provider: any) => provider.type === "custom")
  }

  useEffect(() => {
    refetch()
  }, [type]);

  return (
    <Select onValueChange={(value) => {
      setSelected(providers?.find((agent) => agent.id === value))
      onSelect(value);  
    }} defaultValue={type}>
      <SelectTrigger>
        <SelectValue placeholder={selected?.name || `Select an agent backend`} />
      </SelectTrigger>
      <SelectContent>
        {
          isLoading ? (
            <SelectItem key="loading" value="loading">
              Loading...
            </SelectItem>
          ) :
            providers?.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))
        }
      </SelectContent>
    </Select>
  );
}
