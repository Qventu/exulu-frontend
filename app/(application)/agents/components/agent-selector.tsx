"use client";

import { useQuery } from "@tanstack/react-query";
import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as React from "react";
import { GET_AGENTS } from "@/queries/queries";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {Agent} from "@EXULU_SHARED/models/agent";
import { agents } from "@/util/api";

export function AgentSelector({
  navigate,
  params,
  onSelect,
  ...props
}: any & { params?: { id: string } }) {

  const [open, setOpen] = React.useState(false);
  const [selectedAgent, setSelectedAgent] = React.useState<Agent>();
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);

  const { isLoading, error, data, refetch } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const response = await agents.get({});
      const results: Agent[] = await response.json();
      console.log("[EXULU] agents", results)
      return results;
    }
  })

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label="Select an agent..."
          aria-expanded={open}
          className="flex-1 justify-between md:max-w-[200px] lg:max-w-[300px]"
        >
          {navigating ? (
            <Loader2 />
          ) : selectedAgent ? (
              selectedAgent.name
          ) : (
            "Load an agent..."
          )}
          <CaretSortIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search agents..." />
          <CommandEmpty>No agents found.</CommandEmpty>
          <CommandGroup heading="Agents">
            {data?.map((agent: Agent) => (
              <CommandItem
                key={agent.id}
                onSelect={() => {
                  if (navigate) {
                    setNavigating(true);
                    router.push(`/agents/edit/${agent.id}`);
                  }
                  if (onSelect) {
                    onSelect(agent);
                  }
                  setSelectedAgent(agent);
                  setOpen(false);
                }}
              >
                <div className="flex flex-col items-start w-full">
                  <span className="font-medium">{agent.name}</span>
                  {agent.model && (
                    <span className="text-xs text-muted-foreground">
                      {agent.model}
                    </span>
                  )}
                </div>
                <CheckIcon
                  className={cn(
                    "ml-auto h-4 w-4",
                    selectedAgent?.id === agent.id
                      ? "opacity-100"
                      : "opacity-0",
                  )}
                />
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
