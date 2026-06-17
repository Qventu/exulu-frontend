"use client";

import { useQuery } from "@apollo/client";
import { AlertCircle, Cpu, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { GET_LITELLM_CATALOG } from "@/queries/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/primitives/empty-state";
import { StatusDot } from "@/components/primitives/status-dot";
import { Toolbar } from "@/components/primitives/toolbar";
import { ProviderLogo } from "@/components/provider-logo";

import { ModelDetailSheet } from "./model-detail-sheet";
import { formatCostPerMillion, formatTokens } from "./format";
import type { LiteLLMCatalogEntry } from "./types";

const COLUMN_COUNT = 6;

export function LiteLLMCatalogView() {
  const t = useTranslations("models");
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<LiteLLMCatalogEntry | null>(
    null,
  );

  const { data, loading, error, refetch } = useQuery<{
    litellmCatalog: LiteLLMCatalogEntry[];
  }>(GET_LITELLM_CATALOG, { fetchPolicy: "cache-and-network" });

  const items = data?.litellmCatalog ?? [];

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) => {
      const haystack = [
        m.model_name,
        m.upstream_model ?? "",
        m.brand ?? "",
        ...(m.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search]);

  const isFirstLoad = loading && items.length === 0;
  const hasError = !!error && !data;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p className="min-w-0 flex-1">
            <span className="font-medium text-foreground">
              {t("banner.title")}.
            </span>{" "}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="underline decoration-dotted underline-offset-2"
                >
                  {t("banner.body")}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-sm">
                {t("banner.body")}
              </TooltipContent>
            </Tooltip>
          </p>
        </div>

        <Toolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: t("search.placeholder"),
            debounceMs: 0,
          }}
        />

        {hasError ? (
          <ErrorCallout error={error} onRetry={() => refetch()} />
        ) : isFirstLoad ? (
          <CatalogSkeleton />
        ) : filtered.length === 0 ? (
          search.trim() ? (
            <EmptyState
              icon={Cpu}
              title={t("emptyFiltered.title")}
              action={{
                label: t("emptyFiltered.reset"),
                onClick: () => setSearch(""),
              }}
              className="rounded-md border"
            />
          ) : (
            <EmptyState
              icon={Cpu}
              title={t("empty.title")}
              description={t("empty.body")}
              className="rounded-md border"
            />
          )
        ) : (
          <>
            {/* Table — md+ */}
            <div className="hidden rounded-md border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.model")}</TableHead>
                    <TableHead>{t("table.context")}</TableHead>
                    <TableHead>{t("table.modalities")}</TableHead>
                    <TableHead>{t("table.cost")}</TableHead>
                    <TableHead>{t("table.status")}</TableHead>
                    <TableHead>{t("table.tags")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m, index) => (
                    <ModelRow
                      key={`model-${m.model_name}-${index}-${(m.tags ?? []).join("-")}`}
                      entry={m}
                      onSelect={() => setSelected(m)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Cards — < md */}
            <ul className="space-y-2 md:hidden">
              {filtered.map((m, index) => (
                <li
                  key={`card-${m.model_name}-${index}-${(m.tags ?? []).join("-")}`}
                >
                  <ModelCard entry={m} onSelect={() => setSelected(m)} />
                </li>
              ))}
            </ul>
          </>
        )}

        <ModelDetailSheet
          entry={selected}
          open={selected !== null}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        />
        {/* Mute unused warning when colSpan is referenced in skeleton only */}
        <span className="hidden">{COLUMN_COUNT}</span>
      </div>
    </TooltipProvider>
  );
}

function ModelRow({
  entry,
  onSelect,
}: {
  entry: LiteLLMCatalogEntry;
  onSelect: () => void;
}) {
  const t = useTranslations("models");
  const status = entry.active ? "success" : "muted";
  const statusLabel = entry.active
    ? t("status.active")
    : t("status.inactive");

  return (
    <TableRow
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={entry.model_name}
      className="cursor-pointer"
    >
      <TableCell className="font-medium">
        <span className="flex items-center gap-2">
          <ProviderLogo brand={entry.brand} region={entry.region} size={20} />
          {entry.model_name}
        </span>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatTokens(entry.max_input_tokens)} /{" "}
        {formatTokens(entry.max_output_tokens)}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {entry.supports_vision && (
            <Badge variant="outline">{t("modality.vision")}</Badge>
          )}
          {entry.supports_pdf_input && (
            <Badge variant="outline">{t("modality.pdf")}</Badge>
          )}
          {entry.supports_audio_input && (
            <Badge variant="outline">{t("modality.audio")}</Badge>
          )}
          {entry.supports_function_calling && (
            <Badge variant="outline">{t("modality.tools")}</Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {entry.input_cost_per_million_tokens != null && (
            <Badge variant="outline">
              ${formatCostPerMillion(entry.input_cost_per_million_tokens)}/M
            </Badge>
          )}
          {entry.output_cost_per_million_tokens != null && (
            <Badge variant="outline">
              ${formatCostPerMillion(entry.output_cost_per_million_tokens)}/M
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <StatusDot status={status} label={statusLabel} />
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {(entry.tags ?? []).map((tg, i) => (
            <Badge key={`tag-${i}`} variant="secondary">
              {tg}
            </Badge>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}

function ModelCard({
  entry,
  onSelect,
}: {
  entry: LiteLLMCatalogEntry;
  onSelect: () => void;
}) {
  const t = useTranslations("models");
  const status = entry.active ? "success" : "muted";
  const statusLabel = entry.active
    ? t("status.active")
    : t("status.inactive");

  const hasCost =
    entry.input_cost_per_million_tokens != null ||
    entry.output_cost_per_million_tokens != null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-3 rounded-md border bg-card p-4 text-left transition active:bg-muted/40"
    >
      <ProviderLogo brand={entry.brand} region={entry.region} size={24} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-1">
          <p className="truncate font-medium text-foreground">
            {entry.model_name}
          </p>
          <StatusDot status={status} label={statusLabel} />
        </div>
        {hasCost ? (
          <p className="text-xs text-muted-foreground">
            {entry.input_cost_per_million_tokens != null
              ? `$${formatCostPerMillion(entry.input_cost_per_million_tokens)}/M`
              : "—"}
            {" · "}
            {entry.output_cost_per_million_tokens != null
              ? `$${formatCostPerMillion(entry.output_cost_per_million_tokens)}/M`
              : "—"}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1">
          {entry.supports_vision && (
            <Badge variant="outline">{t("modality.vision")}</Badge>
          )}
          {entry.supports_pdf_input && (
            <Badge variant="outline">{t("modality.pdf")}</Badge>
          )}
          {entry.supports_audio_input && (
            <Badge variant="outline">{t("modality.audio")}</Badge>
          )}
          {entry.supports_function_calling && (
            <Badge variant="outline">{t("modality.tools")}</Badge>
          )}
          {(entry.tags ?? []).map((tg, i) => (
            <Badge key={`tag-${i}`} variant="secondary">
              {tg}
            </Badge>
          ))}
        </div>
      </div>
    </button>
  );
}

function CatalogSkeleton() {
  return (
    <>
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-16" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-44" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-24" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="space-y-2 md:hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <li
            key={i}
            className="flex items-start gap-3 rounded-md border bg-card p-4"
          >
            <Skeleton className="size-6 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-48" />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function ErrorCallout({
  error,
  onRetry,
}: {
  error: { message?: string };
  onRetry: () => void;
}) {
  const t = useTranslations("models");
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 p-4"
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-destructive"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <p className="font-medium text-foreground">{t("error.title")}</p>
            <p className="text-sm text-muted-foreground">{t("error.body")}</p>
          </div>
          {error.message ? (
            <details
              className="text-sm"
              open={detailsOpen}
              onToggle={(e) =>
                setDetailsOpen((e.target as HTMLDetailsElement).open)
              }
            >
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                {t("error.details")}
              </summary>
              <pre className="mt-2 overflow-x-auto rounded bg-background p-2 font-mono text-xs text-muted-foreground">
                {error.message}
              </pre>
            </details>
          ) : null}
          <Button type="button" onClick={onRetry}>
            {t("error.retry")}
          </Button>
        </div>
      </div>
    </div>
  );
}
