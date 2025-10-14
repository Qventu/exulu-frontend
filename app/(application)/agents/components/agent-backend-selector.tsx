"use client";

import * as React from "react";
import { AgentBackend } from "@EXULU_SHARED/models/agent-backend";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@apollo/client";
import { GET_PROVIDERS } from "@/queries/queries";
import { Input } from "@/components/ui/input";

export function AgentBackendSelector({
  onSelect,
}: any & { onSelect: (id) => void}) {

  const [selected, setSelected] = React.useState<AgentBackend | undefined>();
  const [searchTerm, setSearchTerm] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const { loading: isLoading, error, data, refetch, previousData } = useQuery(GET_PROVIDERS, {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
  });

  let providers: AgentBackend[] = []
  providers = data?.providers?.items || [];

  const filteredProviders = providers.filter((provider) =>
    `${provider.provider} - ${provider.name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Select
      onOpenChange={(open) => {
        if (open) {
          setTimeout(() => searchInputRef.current?.focus(), 0);
        }
      }}
      onValueChange={(value) => {
        setSelected(providers?.find((agent) => agent.id === value))
        onSelect(value);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder={selected?.name || `Select an agent backend`} />
      </SelectTrigger>
      <SelectContent>
        <div className="p-2">
          <Input
            ref={searchInputRef}
            placeholder="Search providers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="h-8"
          />
        </div>
        {
          isLoading ? (
            <SelectItem key="loading" value="loading">
              Loading...
            </SelectItem>
          ) :
            filteredProviders?.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.provider + " - " + agent.name}
              </SelectItem>
            ))
        }
      </SelectContent>
    </Select>
  );
}
