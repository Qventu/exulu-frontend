"use client";

/**
 * Merge a near-duplicate group into one memory (spec §5.3). Fetches a
 * suggestion once per open; falls back to the first member's wording and the
 * group's common type when the suggestion mutation fails (the demo link
 * never maps it — `lib/demo/resolvers.ts` — but the card already disables
 * the Merge button that opens this panel in demo mode, so that path is only
 * ever hit by a real failure).
 */
import { useMutation } from "@apollo/client";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { SidePanel } from "@/components/primitives/side-panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isDemoMode } from "@/lib/demo/flag";

import { RESOLVE_MEMORY_CONFLICT, SUGGEST_MEMORY_MERGE } from "../../../queries";
import { type MemoryContext, memoryTypeOptions } from "../../components/memory-list-data";
import { type Conflict, commonType } from "./conflicts-data";

/** Radix Select rejects "" as an item value; this reserved value means "no type". */
const NO_TYPE_VALUE = "__none";

export interface MergePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Conflict;
  context: MemoryContext;
  onMerged: () => void;
}

export function MergePanel({ open, onOpenChange, group, context, onMerged }: MergePanelProps) {
  const t = useTranslations("memory");
  const tc = useTranslations("common");
  const [information, setInformation] = React.useState("");
  const [type, setType] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [suggest, suggestState] = useMutation(SUGGEST_MEMORY_MERGE);
  const [resolve] = useMutation(RESOLVE_MEMORY_CONFLICT);
  const fetchedFor = React.useRef<string | null>(null);

  // Fetch the suggestion once per open; re-arm the next time this panel opens.
  React.useEffect(() => {
    if (!open) {
      fetchedFor.current = null;
      setInformation("");
      setType(null);
      return;
    }
    if (fetchedFor.current === group.id) return;
    fetchedFor.current = group.id;
    suggest({ variables: { id: group.id } })
      .then((res) => {
        const suggestion = res.data?.memoryConflictSuggestMerge;
        if (!suggestion) throw new Error("no suggestion");
        setInformation(suggestion.information);
        setType(suggestion.type ?? null);
      })
      .catch(() => {
        setInformation(group.members[0]?.information ?? "");
        setType(commonType(group.members));
        toast.error(t("conflicts.suggestFailed"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-running on every `group`/`suggest`/`t` identity change would refetch mid-edit.
  }, [open, group.id]);

  // Members whose author the viewer cannot see still have one: never credit zero authors.
  const authorCount = Math.max(1, new Set(
    group.members.map((m) => m.author?.id).filter((id): id is number => typeof id === "number"),
  ).size);
  const typeOptions = memoryTypeOptions(context);

  // ConfirmDialog: resolve closes it, reject keeps it open.
  const confirmMerge = async () => {
    try {
      await resolve({ variables: { id: group.id, action: "MERGE", merged: { information, type } } });
      toast.success(t("conflicts.resolved"));
      onOpenChange(false);
      onMerged();
    } catch (err) {
      toast.error(t("detail.failed"));
      throw err instanceof Error ? err : new Error("merge failed");
    }
  };

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={t("conflicts.mergeTitle")}
      description={t("conflicts.mergeHint")}
      resizable={false}
      storageKey="memory-conflicts-merge"
    >
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`merge-wording-${group.id}`}>{t("conflicts.wording")}</Label>
          <Textarea
            id={`merge-wording-${group.id}`}
            value={information}
            onChange={(e) => setInformation(e.target.value)}
            disabled={suggestState.loading}
            rows={5}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`merge-type-${group.id}`}>{t("conflicts.type")}</Label>
          <Select value={type ?? NO_TYPE_VALUE} onValueChange={(v) => setType(v === NO_TYPE_VALUE ? null : v)}>
            <SelectTrigger id={`merge-type-${group.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TYPE_VALUE}>{t("conflicts.noType")}</SelectItem>
              {typeOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">{t("conflicts.mergeCredits", { count: authorCount })}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button disabled={!information.trim() || suggestState.loading || isDemoMode()} onClick={() => setConfirmOpen(true)}>
            {t("conflicts.mergeAction")}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("conflicts.mergeConfirmTitle", { count: group.members.length })}
        description={t("conflicts.mergeConfirmDescription")}
        onConfirm={confirmMerge}
      />
    </SidePanel>
  );
}
