"use client";

import * as React from "react";
import { useContext } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@apollo/client";
import { GET_LITELLM_CATALOG, GET_MODELS_LITE } from "@/queries/queries";
import { Input } from "@/components/ui/input";
import { ConfigContext } from "@/components/config-context";
import { ProviderLogo } from "@/components/provider-logo";
import { Badge } from "@/components/ui/badge";

type ModelOption = {
  id: string;
  label: string;
  tags?: string[];
  // True for the synthetic "stale" entry 
  // rendered when `value` doesn't match
  // any catalog entry (e.g., agent.model 
  // is a UUID after toggling LiteLLM on).
  stale?: boolean;
  provider?: string;
  description?: string;
  active?: boolean;
  brand?: string | null;
  region?: string | null;
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
  const configContext = useContext(ConfigContext);
  const litellmEnabled = configContext?.liteLLM?.enabled === true;

  // Source the dropdown from either the 
  // LiteLLM catalog or our DB Models table.
  const litellmQuery = useQuery(GET_LITELLM_CATALOG, {
    fetchPolicy: "cache-and-network",
    skip: !litellmEnabled,
  });

  const modelsQuery = useQuery(GET_MODELS_LITE, {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: { page: 1, limit: 100 },
    skip: litellmEnabled,
  });

  const options: ModelOption[] = React.useMemo(() => {
    if (litellmEnabled) {
      const items = litellmQuery.data?.litellmCatalog ?? [];
      return items.map((m: any) => ({
        id: m.model_name,
        label: m.model_name,
        provider: m.upstream_model ?? "",
        description: m.upstream_model ?? "",
        active: true,
        tags: m.tags ?? [],
        brand: m.brand ?? null,
        region: m.region ?? null,
      }));
    }
    const items = modelsQuery.data?.modelsPagination?.items ?? [];
    return items.map((m: any) => ({
      id: m.id,
      label: m.name,
      provider: m.provider,
      description: m.description,
      active: m.active,
      tags: m.tags,
    }));
  }, [litellmEnabled, litellmQuery.data, modelsQuery.data]);

  const isLoading = litellmEnabled ? litellmQuery.loading : modelsQuery.loading;

  // If the agent's stored model value doesn't appear in the current catalog,
  // surface it as a stale entry so the user sees why their dropdown shows
  // nothing. This happens most often after the EXULU_USE_LITELLM toggle is
  // flipped on a running instance: agent.model has a UUID from the Spec A
  // world, and the LiteLLM catalog has only LiteLLM model names.
  const optionsWithStale: ModelOption[] = React.useMemo(() => {
    if (!value) return options;
    if (options.some((o) => o.id === value)) return options;
    if (isLoading) return options;
    return [
      {
        id: value,
        label: `(unknown — re-select): ${value}`,
        stale: true,
        active: false,
      },
      ...options,
    ];
  }, [options, value, isLoading]);

  const selected = optionsWithStale.find((m) => m.id === value);

  const filtered = optionsWithStale.filter((m) =>
    `${m.provider ?? ""} ${m.label}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase()),
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
      <SelectTrigger
        className={selected?.stale ? "border-red-500 text-red-600" : undefined}
      >
        <SelectValue placeholder={selected?.label ?? "Select a model"}>
          {selected ? (
            <span className="flex items-center gap-2">
              <ProviderLogo brand={selected.brand} region={selected.region} />
              <span className={selected.stale ? "text-red-600" : undefined}>
                {selected.label}
              </span>
            </span>
          ) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <div className="p-2">
          <Input
            ref={searchInputRef}
            placeholder={
              litellmEnabled ? "Search LiteLLM models..." : "Search models..."
            }
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
            {litellmEnabled
              ? "No LiteLLM models configured. Edit config.yaml on the host."
              : "No models found. Create one in the Models page."}
          </SelectItem>
        ) : (
          filtered.map((m) => (
            <SelectItem
              key={m.id}
              value={m.id}
              disabled={m.stale}
            >
              <div className="flex items-center gap-2">
                <ProviderLogo brand={m.brand} region={m.region} />
                <span className={m.stale ? "text-red-600" : undefined + " uppercase"}>
                  {m.label} 
                </span>
                {/* Show a badge for each tag */}
                {m.tags?.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
                {m.active === false && !m.stale && (
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
