"use client";

import { useContext } from "react";
import { useQuery } from "@apollo/client";
import { ExternalLink, Info } from "lucide-react";
import { GET_LITELLM_CATALOG } from "@/queries/queries";
import { ConfigContext } from "@/components/config-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { ProviderLogo } from "@/components/provider-logo";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type LiteLLMCatalogEntry = {
  model_name: string;
  upstream_model: string | null;
  tags: string[] | null;
  brand: string | null;
  region: string | null;
  max_input_tokens: number | null;
  max_output_tokens: number | null;
  max_tokens: number | null;
  supports_vision: boolean | null;
  supports_function_calling: boolean | null;
  active: boolean | null;
  supports_pdf_input: boolean | null;
  supports_audio_input: boolean | null;
};

const formatTokens = (n: number | null) => {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
};

export function LiteLLMCatalogView() {
  const configContext = useContext(ConfigContext);
  const backend = configContext?.backend ?? "";
  const adminUiUrl = (() => {
    try {
      const url = new URL(backend);
      // LiteLLM Admin UI lives on the LiteLLM port (default 4000), on the same
      // host as the backend. If the dev is using a non-standard layout they
      // can override via env, but we don't expose that here.
      url.port = "4000";
      url.pathname = "/ui";
      return url.toString();
    } catch {
      return `${backend.replace(/\/$/, "")}:4000/ui`;
    }
  })();

  const { data, loading, error } = useQuery<{
    litellmCatalog: LiteLLMCatalogEntry[];
  }>(GET_LITELLM_CATALOG, { fetchPolicy: "cache-and-network" });

  const items = data?.litellmCatalog ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-4 text-sm">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="flex-1">
          <p className="font-medium">Read-only view</p>
          <p className="text-muted-foreground">
            Models are configured in LiteLLM's <code>config.yaml</code>. Edit it
            on the host and restart Exulu to pick up changes. Use LiteLLM's own
            Admin UI for runtime keys, budgets, and access groups.
          </p>
        </div>
        {/* <Button asChild variant="outline" size="sm">
          <a href={adminUiUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open LiteLLM Admin UI
          </a>
        </Button> */}
      </div>

      {loading && items.length === 0 ? (
        <div className="flex justify-center p-8">
          <Loading />
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          Failed to load LiteLLM catalog. Make sure LiteLLM is running and
          reachable from the Exulu backend.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model name</TableHead>
                {/* <TableHead>Upstream model</TableHead> */}
                <TableHead>Context (in / out)</TableHead>
                <TableHead>Modalities</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No models configured in LiteLLM. Edit{" "}
                    <code>config.yaml</code> on the host and restart Exulu.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((m) => (
                  <TableRow key={m.model_name}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <ProviderLogo brand={m.brand} region={m.region} size={20} />
                        {m.model_name}
                      </span>
                    </TableCell>
                    {/* <TableCell className="font-mono text-xs">
                      {m.upstream_model ?? "—"}
                    </TableCell> */}
                    <TableCell className="text-xs">
                      {formatTokens(m.max_input_tokens)} /{" "}
                      {formatTokens(m.max_output_tokens)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.supports_vision && (
                          <Badge variant="outline">vision</Badge>
                        )}
                        {m.supports_pdf_input && (
                          <Badge variant="outline">pdf</Badge>
                        )}
                        {m.supports_audio_input && (
                          <Badge variant="outline">audio</Badge>
                        )}
                        {m.supports_function_calling && (
                          <Badge variant="outline">tools</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.active ? <Badge variant="outline">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(m.tags ?? []).map((t) => (
                          <Badge key={t} variant="secondary">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
