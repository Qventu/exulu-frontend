"use client";

import { useMutation } from "@apollo/client";
import type { UIMessage } from "ai";
import { Brain, ChevronDownIcon, Globe, Lock, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { Button } from "@/components/ui/button";
import type { Agent } from "@/types/models/agent";

import { DELETE_MEMORY_ITEM } from "../queries";
import { canForget, parseRecalledMemories, type RecalledMemory } from "./recalled-memories-data";

/**
 * "Recalled N memories" block under an assistant answer (spec §2.5, §4.2).
 * Reuses the Sources collapsible so it visually sits alongside the existing
 * inline-citation badge. Renders nothing when the message carries no
 * recalledMemories metadata (guests, unless the agent's `guests.showRecalled`
 * config opts in — memory-section.tsx — or an answer that recalled nothing).
 *
 * `guestMode` (final-review finding 4): when `guests.showRecalled` is on, a
 * guest still gets this block, but "Open" points at the authenticated
 * `/data/...` item page they cannot reach, and "Forget" mutates memory they
 * have no write access to — both are suppressed for guests.
 */
export function RecalledMemories({ message, guestMode = false }: { message: UIMessage; agent: Agent; guestMode?: boolean }) {
  const t = useTranslations("chat");
  const { user } = React.useContext(UserContext);
  const memories = parseRecalledMemories(message.metadata);
  const [pending, setPending] = React.useState<RecalledMemory | null>(null);
  const [forgotten, setForgotten] = React.useState<Set<string>>(new Set());
  const [deleteItem] = useMutation(DELETE_MEMORY_ITEM(pending?.contextId ?? memories[0]?.contextId ?? ""));

  const visible = memories.filter((m) => !forgotten.has(m.id));
  if (visible.length === 0) return null;

  return (
    <Sources data-demo-id="chat-recalled-memories">
      <SourcesTrigger count={visible.length}>
        <Brain className="size-4" aria-hidden="true" />
        <p className="font-medium">{t("memory.recalledTrigger", { count: visible.length })}</p>
        <ChevronDownIcon className="h-4 w-4" />
      </SourcesTrigger>
      <SourcesContent className="w-full gap-3">
        <p className="text-xs text-muted-foreground">{t("memory.recalledHint")}</p>
        <ol className="space-y-2">
          {visible.map((m, i) => {
            const Icon = m.rights_mode === "private" ? Lock : Globe;
            const mode = t(`memory.mode.${m.rights_mode}`);
            const mine = !!user?.id && m.createdBy?.id === user.id;
            return (
              <li key={m.id} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p>{m.information}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon className="size-3" aria-hidden="true" />
                    {mine ? t("memory.savedByYou", { mode }) : t("memory.savedBy", { mode, name: m.createdBy?.name ?? "—" })}
                    {m.createdAt && <>· <RelativeTime date={m.createdAt} /></>}
                  </p>
                </div>
                {!guestMode && (
                  <Button asChild variant="ghost" size="sm" className="h-8 text-xs"><Link href={`/data/${m.contextId}/items/${m.id}`}>{t("memory.open")}</Link></Button>
                )}
                {!guestMode && canForget(m, user?.id, !!user?.super_admin) && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive" aria-label={t("memory.forget")} onClick={() => setPending(m)}>
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      </SourcesContent>
      <ConfirmDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)} variant="destructive"
        title={t("memory.forgetConfirmTitle")} description={t("memory.forgetConfirmDescription", { title: pending?.title ?? "" })} confirmLabel={t("memory.forget")}
        onConfirm={async () => {
          if (!pending) return;
          try {
            await deleteItem({ variables: { id: pending.id } });
            setForgotten((s) => new Set(s).add(pending.id));
            toast.success(t("memory.forgotToast"));
            // Only clear on success — ConfirmDialog's own contract is
            // "reject = stay open"; closing (open={!!pending}) here too
            // would undo that on a failed delete.
            setPending(null);
          } catch {
            toast.error(t("memory.forgetFailed"));
            throw new Error("forget failed");
          }
        }} />
    </Sources>
  );
}
