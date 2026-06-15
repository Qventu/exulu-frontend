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
import { useTranslations } from "next-intl";
import { GET_AGENT_LITELLM_CATALOG } from "@/app/(application)/agents/queries";
import { Input } from "@/components/ui/input";
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

export interface AgentModelSelectorProps {
  value?: string;
  onSelect: (id: string) => void;
  /**
   * NEW (additive, work item 2.8 contracts §2): when no value is set,
   * auto-select the first ACTIVE catalog/model entry once options load and
   * report it via `onSelect` — the create dialog's "pre-selected model"
   * (agents.md create flow: decision 2 is a confirmation, not a hunt).
   * Default false → existing call sites behave byte-identically.
   */
  autoSelectDefault?: boolean;
}

export function AgentModelSelector({
  value,
  onSelect,
  autoSelectDefault = false,
}: AgentModelSelectorProps) {

  const t = useTranslations("agents.modelSelector");
  const [searchTerm, setSearchTerm] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Source the dropdown from the LiteLLM catalog (Phase 4.2 — the legacy
  // Models-table path is gone; LiteLLM is the single source of truth).
  const litellmQuery = useQuery(GET_AGENT_LITELLM_CATALOG, {
    fetchPolicy: "cache-and-network",
  });

  const options: ModelOption[] = React.useMemo(() => {
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
  }, [litellmQuery.data]);

  const isLoading = litellmQuery.loading;

  // autoSelectDefault (additive): once options are loaded and nothing is
  // selected, pick the first active entry and report it upward. Fires at most
  // once per mount; never competes with an existing value, and never touches
  // the stale-value armor below.
  const autoSelectedRef = React.useRef(false);
  const onSelectRef = React.useRef(onSelect);
  React.useEffect(() => {
    onSelectRef.current = onSelect;
  });
  React.useEffect(() => {
    if (!autoSelectDefault || autoSelectedRef.current) return;
    if (value || isLoading) return;
    const firstActive = options.find((option) => option.active !== false);
    if (firstActive) {
      autoSelectedRef.current = true;
      onSelectRef.current(firstActive.id);
    }
  }, [autoSelectDefault, value, isLoading, options]);

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
        label: t("staleLabel", { value }),
        stale: true,
        active: false,
      },
      ...options,
    ];
  }, [options, value, isLoading, t]);

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
        className={selected?.stale ? "border-destructive text-destructive" : undefined}
      >
        <SelectValue placeholder={selected?.label ?? t("placeholder")}>
          {selected ? (
            <span className="flex items-center gap-2">
              <ProviderLogo brand={selected.brand} region={selected.region} />
              <span className={selected.stale ? "text-destructive" : undefined}>
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
            placeholder={t("searchLitellm")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="h-8"
          />
        </div>
        {isLoading ? (
          <SelectItem key="loading" value="loading" disabled>
            {t("loading")}
          </SelectItem>
        ) : filtered.length === 0 ? (
          <SelectItem value="__none" disabled>
            {t("emptyLitellm")}
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
                <span className={m.stale ? "text-destructive" : "uppercase"}>
                  {m.label}
                </span>
                {/* Show a badge for each tag */}
                {m.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
                {m.active === false && !m.stale && (
                  <span className="text-xs text-muted-foreground">
                    {t("inactive")}
                  </span>
                )}
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
