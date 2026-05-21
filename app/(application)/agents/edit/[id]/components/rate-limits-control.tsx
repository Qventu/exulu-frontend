"use client";

import { useContext, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfigContext } from "@/components/config-context";

type RateLimitBucket = { limit: number; window_seconds: number };

export type AgentRateLimitsValue = {
  requests?: RateLimitBucket;
  input_tokens?: RateLimitBucket;
  output_tokens?: RateLimitBucket;
};

type MetricKey = "requests" | "input_tokens" | "output_tokens";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "requests", label: "Request rate" },
  { key: "input_tokens", label: "Input tokens" },
  { key: "output_tokens", label: "Output tokens" },
];

type Props = {
  value: AgentRateLimitsValue | null | undefined;
  onChange: (next: AgentRateLimitsValue | null) => void;
};

export function RateLimitsControl({ value, onChange }: Props) {
  const config = useContext(ConfigContext);
  const licensed = config?.entitlements?.["rate-limits"] === true;

  const [draft, setDraft] = useState<Record<MetricKey, RateLimitBucket | undefined>>({
    requests: value?.requests,
    input_tokens: value?.input_tokens,
    output_tokens: value?.output_tokens,
  });

  useEffect(() => {
    const next: AgentRateLimitsValue = {};
    for (const m of METRICS) {
      const b = draft[m.key];
      if (b && Number.isFinite(b.limit) && Number.isFinite(b.window_seconds) && b.limit > 0 && b.window_seconds > 0) {
        next[m.key] = b;
      }
    }
    const hasAny = Object.keys(next).length > 0;
    onChange(hasAny ? next : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const toggle = (key: MetricKey, on: boolean) => {
    setDraft((d) => ({
      ...d,
      [key]: on ? d[key] ?? { limit: 60, window_seconds: 60 } : undefined,
    }));
  };

  const setField = (key: MetricKey, field: "limit" | "window_seconds", v: string) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    setDraft((d) => {
      const existing = d[key] ?? { limit: 0, window_seconds: 0 };
      return { ...d, [key]: { ...existing, [field]: n } };
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {!licensed && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Enterprise license required</AlertTitle>
          <AlertDescription>
            Per-agent rate limits are an enterprise feature. Configure
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">EXULU_ENTERPRISE_LICENSE</code>
            in your backend deployment to enable. Any values entered here will not
            be enforced.
          </AlertDescription>
        </Alert>
      )}
      {METRICS.map(({ key, label }) => {
        const enabled = !!draft[key];
        const bucket = draft[key];
        return (
          <div key={key} className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 w-44">
              <Checkbox
                id={`rl-${key}`}
                checked={enabled}
                disabled={!licensed}
                onCheckedChange={(c) => toggle(key, !!c)}
              />
              <Label htmlFor={`rl-${key}`} className="cursor-pointer">
                {label}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Limit</Label>
              <Input
                type="number"
                min={1}
                disabled={!enabled || !licensed}
                value={bucket?.limit ?? ""}
                onChange={(e) => setField(key, "limit", e.target.value)}
                className="w-28 h-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Window (s)</Label>
              <Input
                type="number"
                min={1}
                disabled={!enabled || !licensed}
                value={bucket?.window_seconds ?? ""}
                onChange={(e) => setField(key, "window_seconds", e.target.value)}
                className="w-28 h-9"
              />
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Each metric is enforced per (agent, caller). Unchecked metrics are unlimited.
      </p>
    </div>
  );
}
