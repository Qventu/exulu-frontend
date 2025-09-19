"use client";

import * as React from "react";
import { AgentBackend } from "@EXULU_SHARED/models/agent-backend";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@apollo/client";
import { GET_PROVIDERS } from "@/queries/queries";

export function AgentBackendSelector({
  onSelect,
}: any & { onSelect: (id) => void}) {

  const [selected, setSelected] = React.useState<AgentBackend | undefined>();
  const { loading: isLoading, error, data, refetch, previousData } = useQuery(GET_PROVIDERS, {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
  });

  let providers: AgentBackend[] = []
  providers = data?.providers?.items || [];

  return (
    <Select onValueChange={(value) => {
      setSelected(providers?.find((agent) => agent.id === value))
      onSelect(value);  
    }}>
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
