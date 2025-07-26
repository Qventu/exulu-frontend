"use client";

import * as React from "react";
import { agents, workflows } from "@/util/api";
import { useQuery } from "@tanstack/react-query";
import { AgentBackend } from "@EXULU_SHARED/models/agent-backend";
import { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AgentBackendSelector({
  params,
  onSelect,
  type,
  ...props
}: any & { onSelect: (id) => void, type: "FLOW" | "CHAT", params?: { id: string } }) {

  const [selected, setSelected] = React.useState<AgentBackend | undefined>();

  const { isLoading, error, data, refetch } = useQuery<AgentBackend[]>({
    queryKey: ["backend"],
    queryFn: async () => {
      let result: any = {};
      let json: any = {};
      console.log("type", type)

      if (type === "FLOW") {
        result = await workflows.get(null, 20);
        console.log("result", result)
        json = await result.json()
        console.log("json", json)
      }

      if (type === "CHAT") {
        result = await agents.get(null, 20);
        console.log("result", result)
        json = await result.json()
        console.log("json", json)
        json = json.filter((agent: any) => agent.type === "agent")
      }

      if (type === "CUSTOM") {
        result = await agents.get(null, 20);
        console.log("result", result)
        json = await result.json()
        json = json.filter((agent: any) => agent.type === "custom")
        console.log("json", json)
      }

      if (params?.id) {
        setSelected(
          result.agents.find(
            (item: any) => item.id === params.id,
          ),
        );
      }

      return json || [];
    },
  });

  useEffect(() => {
    refetch()
    setSelected(undefined)
  }, [type]);

  return (
    <Select onValueChange={(value) => {
      setSelected(data?.find((agent) => agent.id === value))
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
            data?.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))
        }
      </SelectContent>
    </Select>
  );
}
