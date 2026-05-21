"use client";

import { useQuery } from "@apollo/client";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AGENT_RATE_LIMIT_USAGE } from "@/queries/queries";
import type { AgentRateLimitsValue } from "./rate-limits-control";

type Props = {
  agentId: string;
  limits: AgentRateLimitsValue | null | undefined;
};

type Row = {
  callerId: string;
  callerLabel: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
};

export function RateLimitsUsage({ agentId, limits }: Props) {
  const { data, refetch, loading } = useQuery(AGENT_RATE_LIMIT_USAGE, {
    variables: { agentId },
    fetchPolicy: "network-only",
    pollInterval: 10000,
    skip: !limits,
  });

  if (!limits) return null;

  const rows: Row[] = data?.agentRateLimitUsage ?? [];
  const fmt = (cur: number, lim?: number) =>
    lim ? `${cur} / ${lim}` : String(cur);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Live counters in the current rate-limit window.
        </p>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => refetch()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          No active callers in the current window.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Caller</TableHead>
              <TableHead>Requests</TableHead>
              <TableHead>Input tokens</TableHead>
              <TableHead>Output tokens</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.callerId}>
                <TableCell className="font-medium">{row.callerLabel}</TableCell>
                <TableCell>{fmt(row.requests, limits.requests?.limit)}</TableCell>
                <TableCell>{fmt(row.inputTokens, limits.input_tokens?.limit)}</TableCell>
                <TableCell>{fmt(row.outputTokens, limits.output_tokens?.limit)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
