"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@apollo/client";
import { GET_MODELS_LITE } from "@/queries/queries";
import { Input } from "@/components/ui/input";

type ModelOption = {
  id: string;
  name: string;
  description?: string;
  provider: string;
  active: boolean;
};

export function AgentModelSelector({
  value,
  onSelect,
}: {
  value?: string;
  onSelect: (id: string) => void;
}) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const { loading: isLoading, data } = useQuery(GET_MODELS_LITE, {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: { page: 1, limit: 100 },
  });

  const models: ModelOption[] = data?.modelsPagination?.items ?? [];
  const selected = models.find((m) => m.id === value);

  const filtered = models.filter((m) =>
    `${m.provider} ${m.name}`.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Select
      value={value}
      onOpenChange={(open) => {
        if (open) {
          setTimeout(() => searchInputRef.current?.focus(), 0);
        }
      }}
      onValueChange={(v) => onSelect(v)}
    >
      <SelectTrigger>
        <SelectValue placeholder={selected?.name ?? "Select a model"} />
      </SelectTrigger>
      <SelectContent>
        <div className="p-2">
          <Input
            ref={searchInputRef}
            placeholder="Search models..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="h-8"
          />
        </div>
        {isLoading ? (
          <SelectItem key="loading" value="loading" disabled>
            Loading...
          </SelectItem>
        ) : filtered.length === 0 ? (
          <SelectItem value="__none" disabled>
            No models found. Create one in the Models page.
          </SelectItem>
        ) : (
          filtered.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {m.provider}
                </span>
                <span>{m.name}</span>
                {!m.active && (
                  <span className="text-xs text-amber-600">(inactive)</span>
                )}
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
