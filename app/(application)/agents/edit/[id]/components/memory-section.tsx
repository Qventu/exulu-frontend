"use client";

/**
 * MemorySection — the Knowledge & memory section's memory base card (Task 14,
 * agent-memory redesign). Replaces the old "Long-term memory" context
 * combobox in sections/knowledge.tsx with: an off-state picker + onboarding
 * steps; an on-state card with base link, stats (memoryBaseStats), the
 * primary "look up memories" switch + per-answer limit, three knowledge-
 * search memory toggles nested under it (disabled with a "recall off" /
 * "search off" hint), and sharing rules (visibility default, guest chats).
 * Turn off / Change store both go through the shared ConfirmDialog.
 */

import { useQuery } from "@apollo/client";
import { Bookmark, Check, ChevronsUpDown, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { ChartCard } from "@/components/primitives/chart-card";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { RelativeTime } from "@/components/primitives/relative-time";
import { SettingRow } from "@/components/primitives/setting-row";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import { GET_AGENTS_USING_MEMORY, GET_MEMORY_BASE_STATS, GET_MEMORY_BASE_USAGE, GET_MEMORY_CONFLICT_COUNTS } from "../queries";
import type { EditorSectionProps } from "../sections/types";
import { MEMORY_DEFAULTS, parseWizardConfig, serializeWizardConfig } from "./knowledge-search/config-schema";
import type { ToolConfigEntry } from "./tool-config-fields";
import { MEMORY_LIMIT_MAX, MEMORY_LIMIT_MIN, sortContextsForPicker, weekBars, type PickerEntry } from "./memory-section-data";

type MemoryBaseStats = {
  total: number;
  public: number;
  private: number;
  contributors: number;
  lastSavedAt: string | null;
  lastSavedBy: { id: number; name: string } | null;
};

type BaseUsage = {
  used: number;
  neverUsed: number;
  stale: number;
  mostUsed: { id: string; information: string; count: number; lastUsedAt: string | null }[];
  newPerWeek: { weekStart: string; count: number }[];
};

export function MemorySection({ editor, refs }: EditorSectionProps) {
  const t = useTranslations("agents");
  const agentName = editor.form.watch("name") ?? "";
  const contextId = editor.memory;
  const selected = refs.contexts.find((c) => c.id === contextId);
  const memoryOn = !!contextId;

  const { data: agentsData } = useQuery<{
    agentsPagination: { items: { id: string; name: string; memory?: string | null }[] };
  }>(GET_AGENTS_USING_MEMORY, { variables: { page: 1, limit: 200 } });
  const usedBy = React.useMemo<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    for (const a of agentsData?.agentsPagination?.items ?? []) {
      if (a.memory && a.id !== editor.agentId) (map[a.memory] ??= []).push(a.name);
    }
    return map;
  }, [agentsData, editor.agentId]);
  const entries = React.useMemo(
    () => sortContextsForPicker(refs.contexts, usedBy),
    [refs.contexts, usedBy],
  );

  const { data: statsData } = useQuery<{ memoryBaseStats: MemoryBaseStats }>(GET_MEMORY_BASE_STATS, {
    variables: { contextId },
    skip: !memoryOn,
  });
  const stats = statsData?.memoryBaseStats;

  const invalid = selected && selected.memoryBase && !selected.memoryBase.ok;
  // A base missing from code (`!selected`) must not run the usage query either —
  // it would otherwise show "no usage yet" underneath the missing-base warning.
  const showInsights = !!selected && !invalid;
  const { data: usageData, loading: usageLoading, error: usageError, refetch: refetchUsage } = useQuery<{ memoryBaseUsage: BaseUsage | null }>(GET_MEMORY_BASE_USAGE, {
    variables: { contextId, staleDays: 90 },
    skip: !memoryOn || !showInsights,
    fetchPolicy: "cache-and-network",
  });
  const { data: conflictCountsData, error: conflictCountsError } = useQuery<{ memoryConflictCounts: { open: number; memoriesInvolved: number; lastScanAt: string | null } }>(GET_MEMORY_CONFLICT_COUNTS, {
    variables: { contextId },
    skip: !memoryOn || !showInsights,
  });

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pendingPick, setPendingPick] = React.useState<PickerEntry | null>(null);
  const [confirmOff, setConfirmOff] = React.useState(false);
  const [confirmChange, setConfirmChange] = React.useState(false);

  // Knowledge-search memory toggles live in the agentic_context_search config entry.
  const agenticTool = editor.tools.find((x) => x.id === "agentic_context_search");
  const searchOn = !!agenticTool;
  const wizardCfg = parseWizardConfig((agenticTool?.config as ToolConfigEntry[]) ?? []);
  const setSearchMemory = (patch: Partial<typeof MEMORY_DEFAULTS>) => {
    if (!agenticTool) return;
    const next = serializeWizardConfig({ ...wizardCfg, memory: { ...wizardCfg.memory, ...patch } });
    editor.setTools(
      editor.tools.map((x) => (x.id === "agentic_context_search" ? { ...x, config: next as any } : x)),
    );
  };
  const cfg = editor.memoryConfig;
  const setCfg = (patch: Partial<typeof cfg>) => editor.setMemoryConfig({ ...cfg, ...patch });

  const Picker = (
    <Popover modal open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between text-sm">
          {pendingPick?.name ?? selected?.name ?? t("editor.memory.pickPlaceholder")}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[320px] p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
        <Command>
          <CommandInput placeholder={t("editor.knowledge.searchContexts")} />
          <CommandList>
            <CommandEmpty>{t("editor.knowledge.noContexts")}</CommandEmpty>
            <CommandGroup>
              {entries.map((e) => (
                <CommandItem
                  key={e.id}
                  value={e.name}
                  disabled={e.disabled}
                  onSelect={() => {
                    setPendingPick(e);
                    setPickerOpen(false);
                  }}
                  className={cn(e.disabled && "opacity-50")}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      (pendingPick?.id ?? contextId) === e.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span>{e.name}</span>
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {e.disabled
                        ? t("editor.memory.notConfigured", { fields: e.missing.join(", ") })
                        : e.usedBy.length
                          ? t("editor.memory.usedBy", { names: e.usedBy.join(", ") })
                          : (e.description ?? "")}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  if (!memoryOn) {
    return (
      <div className="space-y-4 rounded-lg border p-4" data-demo-id="agent-memory-off">
        <Header on={false} t={t} />
        <p className="text-sm text-muted-foreground">{t("editor.memory.intro", { agent: agentName })}</p>
        <ol className="grid gap-2 sm:grid-cols-3">
          {(["step1", "step2", "step3"] as const).map((k, i) => (
            <li key={k} className="flex gap-2 rounded-md bg-muted/40 p-3 text-sm">
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-xs">
                {i + 1}
              </span>
              {t(`editor.memory.${k}`, { agent: agentName })}
            </li>
          ))}
        </ol>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("editor.memory.whereTitle")}</p>
          <p className="text-sm">{t("editor.memory.useExisting")}</p>
          <p className="text-xs text-muted-foreground">{t("editor.memory.useExistingHint")}</p>
          {Picker}
        </div>
        <div className="flex justify-end">
          <Button
            disabled={!pendingPick}
            onClick={() => {
              if (pendingPick) {
                editor.setMemory(pendingPick.id);
                setPendingPick(null);
              }
            }}
          >
            <Bookmark className="mr-2 size-4" aria-hidden="true" />
            {t("editor.memory.turnOn")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border p-4" data-demo-id="agent-memory-on">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Header on t={t} />
          <p className="text-sm text-muted-foreground">
            {t("editor.memory.storedIn")}{" "}
            {selected ? (
              <Link className="underline" href={`/data/${selected.id}`}>
                {selected.name}
              </Link>
            ) : (
              <code>{contextId}</code>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setConfirmChange(true)}>
            {t("editor.memory.changeStore")}
          </Button>
          <Button variant="outline" onClick={() => setConfirmOff(true)}>
            {t("editor.memory.turnOff")}
          </Button>
        </div>
      </div>

      {!selected && (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertDescription>{t("editor.memory.warningMissing", { id: contextId })}</AlertDescription>
        </Alert>
      )}
      {invalid && (
        <Alert>
          <TriangleAlert className="size-4" />
          <AlertDescription>
            {t("editor.memory.warningInvalid", { name: selected!.name, fields: selected!.memoryBase!.missing.join(", ") })}
          </AlertDescription>
        </Alert>
      )}

      {stats && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label={t("editor.memory.statsMemories")}
            value={stats.total}
            hint={t("editor.memory.statsSplit", { public: stats.public, private: stats.private })}
          />
          <Stat label={t("editor.memory.statsContributors")} value={stats.contributors} />
          <Stat
            label={t("editor.memory.statsLastSaved")}
            value={stats.lastSavedAt ? <RelativeTime date={stats.lastSavedAt} /> : t("editor.memory.never")}
            hint={stats.lastSavedBy ? t("editor.memory.statsBy", { name: stats.lastSavedBy.name }) : undefined}
          />
        </div>
      )}

      {showInsights && (
        <ChartCard
          title={t("editor.memory.insightsTitle")}
          description={t("editor.memory.insightsHint", { agent: agentName })}
          loading={usageLoading && !usageData}
          error={usageError ? { message: usageError.message, onRetry: () => { void refetchUsage(); } } : null}
        >
          {(() => {
            const u = usageData?.memoryBaseUsage;
            if (!u || (u.used === 0 && u.neverUsed === 0)) return <p className="text-sm text-muted-foreground">{t("editor.memory.noUsageYet")}</p>;
            const bars = weekBars(u.newPerWeek);
            return (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{t("editor.memory.mostUsed")}</p>
                  {u.mostUsed.slice(0, 3).map((m) => (
                    <Link key={m.id} href={`/memory/${contextId}/${m.id}`} className="block truncate text-sm underline-offset-2 hover:underline">
                      {m.information} <span className="text-muted-foreground">{m.count}×</span>
                    </Link>
                  ))}
                  {u.mostUsed.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{t("editor.memory.needsAttention")}</p>
                  <Link href={`/memory/${contextId}?usage=never`} className="block text-sm hover:underline">{t("editor.memory.neverUsed")} <span className="text-muted-foreground">{u.neverUsed}</span></Link>
                  <Link href={`/memory/${contextId}?usage=stale`} className="block text-sm hover:underline">{t("editor.memory.staleUsed")} <span className="text-muted-foreground">{u.stale}</span></Link>
                  <Link href={`/memory/${contextId}/conflicts`} className="block text-sm hover:underline">
                    {t("editor.memory.conflictsLine")} <span className="text-muted-foreground">{conflictCountsError ? "—" : (conflictCountsData?.memoryConflictCounts?.open ?? 0)}</span>
                  </Link>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{t("editor.memory.newPerWeek")}</p>
                  <div className="flex h-16 items-end gap-1" role="img" aria-label={t("editor.memory.newPerWeek")}>
                    {bars.map((b) => (
                      <div key={b.weekStart} className="flex flex-1 flex-col items-center gap-1">
                        <div className="w-full rounded-sm bg-primary/70" style={{ height: `${Math.max(b.height, 4)}%` }} title={`${b.label} · ${b.count}`} />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("editor.memory.lastWeeks")}</p>
                </div>
              </div>
            );
          })()}
        </ChartCard>
      )}

      <div className="space-y-1">
        <p className="text-sm font-medium">{t("editor.memory.howTitle", { agent: agentName })}</p>
        <p className="text-xs text-muted-foreground">{t("editor.memory.howHint")}</p>
      </div>
      {/* Primary switch: the ONE place memory retrieval is turned on. */}
      <SettingRow htmlFor="memory-retrieval-enabled" label={t("editor.memory.retrievalLabel")} description={t("editor.memory.retrievalHint", { agent: agentName })}>
        <div className="flex items-center gap-3">
          <Input
            id="memory-limit"
            aria-label={t("editor.memory.limitLabel")}
            type="number"
            min={MEMORY_LIMIT_MIN}
            max={MEMORY_LIMIT_MAX}
            className="w-20"
            disabled={!cfg.retrieval.enabled}
            value={cfg.retrieval.limit}
            onChange={(e) =>
              setCfg({
                retrieval: {
                  ...cfg.retrieval,
                  limit: Math.min(MEMORY_LIMIT_MAX, Math.max(MEMORY_LIMIT_MIN, Number(e.target.value) || MEMORY_LIMIT_MIN)),
                },
              })
            }
          />
          <span className="text-xs text-muted-foreground">{t("editor.memory.limitUnit")}</span>
          <Switch id="memory-retrieval-enabled" checked={cfg.retrieval.enabled} onCheckedChange={(v) => setCfg({ retrieval: { ...cfg.retrieval, enabled: v } })} />
        </div>
      </SettingRow>
      {/* Nested: what knowledge search may additionally do with the recalled set. */}
      <div className={cn("ml-4 space-y-1 border-l pl-4", (!cfg.retrieval.enabled || !searchOn) && "opacity-60")}>
        <p className="text-xs font-medium text-muted-foreground">{t("editor.memory.nestedTitle")}</p>
        {(
          [
            ["override", "overrideLabel", "overrideHint"],
            ["filePrioritization", "fileLabel", "fileHint"],
            ["queryAugmentation", "augmentLabel", "augmentHint"],
          ] as const
        ).map(([key, label, hint]) => {
          const nestedDisabled = !cfg.retrieval.enabled || !searchOn;
          const description = !cfg.retrieval.enabled
            ? t("editor.memory.recallOff")
            : !searchOn
              ? t("editor.memory.searchOff")
              : t(`editor.memory.${hint}`, { agent: agentName });
          const switchId = `memory-nested-${key}`;
          return (
            <SettingRow key={key} htmlFor={switchId} label={t(`editor.memory.${label}`)} description={description}>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-normal">
                  {t("editor.memory.usesSearch")}
                </Badge>
                <Switch
                  id={switchId}
                  disabled={nestedDisabled}
                  checked={!nestedDisabled && wizardCfg.memory[key]}
                  onCheckedChange={(v) => setSearchMemory({ [key]: v })}
                />
              </div>
            </SettingRow>
          );
        })}
      </div>

      <p className="text-sm font-medium">{t("editor.memory.rulesTitle")}</p>
      <SettingRow label={t("editor.memory.visibilityLabel")} description={t("editor.memory.visibilityHint")}>
        <ToggleGroup
          type="single"
          value={cfg.visibility}
          onValueChange={(v) => v && setCfg({ visibility: v as typeof cfg.visibility })}
          aria-label={t("editor.memory.visibilityLabel")}
        >
          <ToggleGroupItem value="ask">{t("editor.memory.askEveryTime")}</ToggleGroupItem>
          <ToggleGroupItem value="preselect_private">{t("editor.memory.preselectPrivate")}</ToggleGroupItem>
        </ToggleGroup>
      </SettingRow>
      <SettingRow htmlFor="memory-guests-show-recalled" label={t("editor.memory.guestsLabel")} description={t("editor.memory.guestsHint")}>
        <div className="flex items-center gap-2 text-sm">
          <span>{t("editor.memory.guestsShow")}</span>
          <Switch id="memory-guests-show-recalled" checked={cfg.guests.showRecalled} onCheckedChange={(v) => setCfg({ guests: { showRecalled: v } })} />
        </div>
      </SettingRow>

      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        variant="destructive"
        title={t("editor.memory.turnOffTitle", { agent: agentName })}
        description={t("editor.memory.turnOffDescription")}
        confirmLabel={t("editor.memory.turnOff")}
        onConfirm={async () => {
          editor.setMemory("");
        }}
      />
      <ConfirmDialog
        open={confirmChange}
        variant="default"
        onOpenChange={(open) => {
          setConfirmChange(open);
          // Cancel/Escape closes without confirming — clear the abandoned
          // pick so the trigger falls back to `selected?.name` again and a
          // reopen doesn't show (or Confirm doesn't apply) a stale choice.
          if (!open) setPendingPick(null);
        }}
        title={t("editor.memory.changeStoreTitle")}
        description={
          <div className="space-y-3">
            <p>{t("editor.memory.changeStoreDescription")}</p>
            {Picker}
          </div>
        }
        confirmLabel={t("editor.memory.changeStore")}
        onConfirm={async () => {
          if (pendingPick) {
            editor.setMemory(pendingPick.id);
            setPendingPick(null);
          }
        }}
      />
    </div>
  );
}

function Header({ on, t }: { on: boolean; t: ReturnType<typeof useTranslations> }) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium">
      <Bookmark className="size-4 text-muted-foreground" aria-hidden="true" />
      {t("editor.memory.title")}
      <Badge variant={on ? "default" : "outline"} className="font-normal">
        {on ? t("editor.memory.on") : t("editor.memory.off")}
      </Badge>
    </p>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-medium">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
