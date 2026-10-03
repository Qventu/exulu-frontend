"use client";

import { useMutation, useQuery } from "@apollo/client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { DetailSection } from "@/components/primitives/detail-section";
import { EmptyState } from "@/components/primitives/empty-state";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { RelativeTime } from "@/components/primitives/relative-time";
import { SidePanel } from "@/components/primitives/side-panel";
import { RBACControl } from "@/components/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import {
  BULK_UPDATE_MEMORY_RBAC, DELETE_MEMORY_ITEM, GET_MEMORY_BASE_CONTRIBUTORS, GET_MEMORY_CONFLICTS_FOR_MEMORY, GET_MEMORY_ITEM_BY_ID, GET_MEMORY_USAGE, GET_SOURCE_MESSAGES, GET_SOURCE_SESSION, MEMORY_ITEM_KEY,
} from "../../../queries";
import { type MemoryContext, type MemoryContributor, type MemoryItem, creatorName, hasSourceSession, visibilityKey } from "../../components/memory-list-data";
import { VisibilityLabel } from "../../components/memory-table";
import { type UsageEntry, usageEntryLabel, usageLabel } from "../../components/usage-data";
import { detailActions, sourceQuote } from "./memory-detail-data";

type Rbac = { rights_mode: "private" | "users" | "roles" | "teams" | "public"; users: { id: number; rights: "read" | "write" }[]; roles: { id: string; rights: "read" | "write" }[]; teams: { id: string; rights: "read" | "write" }[] };

function SourceConversation({ sessionId }: { sessionId: string }) {
  const t = useTranslations("memory");
  const session = useQuery<{ agent_sessionById: { id: string; agent: string } | null }>(GET_SOURCE_SESSION, { variables: { id: sessionId } });
  const s = session.data?.agent_sessionById;
  // agent_messagesPagination is NOT RBAC-scoped (see the security follow-up in
  // docs/superpowers/plans/2026-09-30-memory-recall-followups.md), so the
  // messages are only ever requested once agent_sessionById — which is scoped —
  // has proved this viewer may read the session. Never in parallel with it.
  const messages = useQuery<{ agent_messagesPagination: { items: { id: string; content: string; createdAt: string }[] } }>(GET_SOURCE_MESSAGES, { skip: !s, variables: { session: sessionId } });
  const quote = sourceQuote(messages.data?.agent_messagesPagination.items ?? []);
  if (session.loading && !session.data) return <Skeleton className="h-16 w-full" />;
  if (!s) return <p className="text-sm text-muted-foreground">{t("detail.noSource")}</p>;
  if (messages.loading && !messages.data) return <Skeleton className="h-16 w-full" />;
  if (!quote) return <p className="text-sm text-muted-foreground">{t("detail.noSource")}</p>;
  return (
    <div className="flex flex-col gap-2">
      <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground">“{quote}”</blockquote>
      <Link href={`/chat/${s.agent}/${s.id}`} className="text-sm underline">{t("detail.openConversation")}</Link>
    </div>
  );
}

export function MemoryDetail({ context, itemId }: { context: MemoryContext; itemId: string }) {
  const t = useTranslations("memory");
  const tc = useTranslations("common");
  const router = useRouter();
  const { user } = React.useContext(UserContext) as { user?: { id?: number; super_admin?: boolean } };
  const withSource = hasSourceSession(context);

  const item = useQuery<{ [key: string]: MemoryItem | null }>(GET_MEMORY_ITEM_BY_ID(context.id, withSource), { variables: { id: itemId }, fetchPolicy: "cache-and-network" });
  const memory = item.data?.[MEMORY_ITEM_KEY(context.id)] ?? null;
  const contributors = useQuery<{ memoryBaseContributors: MemoryContributor[] }>(GET_MEMORY_BASE_CONTRIBUTORS, { fetchPolicy: "cache-first", variables: { contextId: context.id } });
  const [updateRbac, updateState] = useMutation(BULK_UPDATE_MEMORY_RBAC(context.id));
  const [deleteItem] = useMutation(DELETE_MEMORY_ITEM(context.id));
  const usage = useQuery<{ memoryUsage: { count: number; lastUsedAt: string | null; recent: UsageEntry[] } | null }>(GET_MEMORY_USAGE, { variables: { contextId: context.id, memoryId: itemId, limit: 5 }, skip: !memory });
  const conflicts = useQuery<{ memoryConflictsForMemory: { open: { id: string }[]; mergedFrom: { id: string; information: string }[] } | null }>(
    GET_MEMORY_CONFLICTS_FOR_MEMORY,
    { variables: { contextId: context.id, memoryId: itemId }, skip: !memory },
  );

  const [accessOpen, setAccessOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Rbac | null>(null);
  const [privateOpen, setPrivateOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  if (item.loading && !item.data) {
    return <PageShell><Skeleton className="h-8 w-64" /><Skeleton className="h-40 w-full" /></PageShell>;
  }
  if (!memory) {
    return (
      <PageShell>
        <EmptyState title={t("empty.notAvailableTitle")} description={t("empty.notAvailableDescription")} action={{ label: t("empty.back"), href: `/memory/${context.id}` }} />
      </PageShell>
    );
  }

  const actions = detailActions(memory, user);
  const creator = creatorName(contributors.data?.memoryBaseContributors ?? [], memory.created_by) ?? t("detail.unknownUser");

  // ConfirmDialog's contract: resolve → it closes itself; reject → it stays
  // open (components/primitives/confirm-dialog.tsx). Toast + rethrow on
  // failure so the user can retry without losing the open dialog; no explicit
  // setXOpen(false) on success — the dialog handles that itself.
  const makePrivate = async () => {
    try {
      await updateRbac({ variables: { ids: [memory.id], rights_mode: "private", rbac: null } });
      toast.success(t("detail.madePrivate"));
      void item.refetch();
    } catch {
      toast.error(t("detail.failed"));
      throw new Error("make private failed");
    }
  };
  const saveAccess = async () => {
    if (!draft) { setAccessOpen(false); return; }
    try {
      await updateRbac({ variables: { ids: [memory.id], rights_mode: draft.rights_mode, rbac: { users: draft.users, roles: draft.roles, teams: draft.teams } } });
      toast.success(t("detail.accessSaved"));
      setAccessOpen(false);
      void item.refetch();
    } catch { toast.error(t("detail.failed")); }
  };
  const remove = async () => {
    try {
      await deleteItem({ variables: { id: memory.id } });
      toast.success(t("detail.deleted"));
      router.push(`/memory/${context.id}`);
    } catch {
      toast.error(t("detail.failed"));
      throw new Error("delete failed");
    }
  };

  return (
    <PageShell>
      <PageHeader
        breadcrumb={{ label: context.name, href: `/memory/${context.id}` }}
        title={memory.information ?? memory.name ?? ""}
      />
      <div className="-mt-4 flex items-center gap-2">
        <Badge variant="outline"><VisibilityLabel mode={memory.rights_mode} /></Badge>
        {memory.type && <Badge variant="secondary">{memory.type}</Badge>}
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <DetailSection title={t("detail.whySaved")} defaultOpen>
            <p className="text-sm">{memory.description?.trim() || <span className="text-muted-foreground">{t("detail.notRecorded")}</span>}</p>
          </DetailSection>
          <DetailSection title={t("detail.source")} defaultOpen>
            {memory.source_session ? <SourceConversation sessionId={memory.source_session} /> : <p className="text-sm text-muted-foreground">{t("detail.noSource")}</p>}
          </DetailSection>
        </div>
        <div className="flex flex-col gap-4">
          <DetailSection title={t("detail.details")} defaultOpen>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("detail.whoCanSee")}</dt>
              <dd className="flex items-center gap-2">
                <VisibilityLabel mode={memory.rights_mode} />
                {actions.canEdit && <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setAccessOpen(true)}>{t("detail.change")}</Button>}
              </dd>
              <dt className="text-muted-foreground">{t("detail.createdBy")}</dt>
              <dd>{creator}</dd>
              <dt className="text-muted-foreground">{t("detail.created")}</dt>
              <dd>{memory.createdAt ? <RelativeTime date={memory.createdAt} /> : "—"}</dd>
              <dt className="text-muted-foreground">{t("detail.updated")}</dt>
              <dd>{memory.updatedAt ? <RelativeTime date={memory.updatedAt} /> : "—"}</dd>
            </dl>
            {conflicts.data?.memoryConflictsForMemory?.open?.length ? (
              <p className="mt-3 text-sm">
                {t("conflicts.partOfOpen")} · <Link href={`/memory/${context.id}/conflicts`} className="underline">{t("conflicts.open")}</Link>
              </p>
            ) : null}
            {conflicts.data?.memoryConflictsForMemory?.mergedFrom?.length ? (
              <div className="mt-3 text-sm">
                <p>{t("conflicts.mergedFrom", { count: conflicts.data.memoryConflictsForMemory.mergedFrom.length })}</p>
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  {conflicts.data.memoryConflictsForMemory.mergedFrom.map((m) => <li key={m.id}>{m.information}</li>)}
                </ul>
              </div>
            ) : null}
          </DetailSection>
          <DetailSection title={t("usage.section")} defaultOpen>
            {usage.loading && !usage.data ? (
              <Skeleton className="h-16 w-full" />
            ) : usage.error ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {t("usage.loadFailed")}
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => { void usage.refetch(); }}>{tc("retry")}</Button>
              </div>
            ) : (() => {
              const data = usage.data?.memoryUsage ?? { count: 0, lastUsedAt: null, recent: [] };
              const label = usageLabel(data);
              if (label.kind === "never") return <p className="text-sm text-muted-foreground">{t("usage.neverUsedLong")}</p>;
              return (
                <div className="flex flex-col gap-2 text-sm">
                  <p>
                    {t("usage.usedInCount", { count: label.count })}
                    {label.lastUsedAt && <> · {t("usage.lastPrefix")} <RelativeTime date={label.lastUsedAt} /></>}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {data.recent.map((e) => (
                      <li key={e.messageId} className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
                        <span>{usageEntryLabel(e, t("usage.guest"), t("usage.unknownAgent"))}</span>
                        <RelativeTime date={e.usedAt} />
                        {e.title !== null && e.sessionId && e.agent && (
                          <Link href={`/chat/${e.agent.id}/${e.sessionId}`} className="underline">{e.title || t("usage.openConversation")}</Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </DetailSection>
          <div className="flex flex-wrap gap-2">
            {actions.canEdit && <Button variant="outline" asChild><Link href={`/data/${context.id}/items/${memory.id}`}>{t("detail.editWording")}</Link></Button>}
            {actions.canMakePrivate && <Button variant="outline" onClick={() => setPrivateOpen(true)}>{t("detail.makePrivate")}</Button>}
            {actions.canDelete && <Button variant="destructive" onClick={() => setDeleteOpen(true)}>{t("detail.delete")}</Button>}
          </div>
        </div>
      </div>

      <SidePanel open={accessOpen} onOpenChange={setAccessOpen} title={t("detail.accessTitle")}>
        <div className="flex flex-col gap-4 p-4">
          <RBACControl
            subjectLabel={t("detail.accessSubject")}
            initialRightsMode={visibilityKey(memory.rights_mode)}
            initialUsers={(memory.RBAC?.users ?? undefined) as { id: string; rights: "read" | "write" }[] | undefined}
            initialRoles={(memory.RBAC?.roles ?? undefined) as { id: string; rights: "read" | "write" }[] | undefined}
            onChange={(rights_mode, users, roles, teams) => setDraft({ rights_mode, users, roles, teams: teams ?? [] })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAccessOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={saveAccess} disabled={updateState.loading}>{tc("save")}</Button>
          </div>
        </div>
      </SidePanel>
      <ConfirmDialog open={privateOpen} onOpenChange={setPrivateOpen} title={t("detail.makePrivateTitle")} description={t("detail.makePrivateDescription")} confirmLabel={t("detail.makePrivate")} onConfirm={makePrivate} />
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} variant="destructive" title={t("detail.deleteTitle")} description={t("detail.deleteDescription")} confirmLabel={t("detail.delete")} onConfirm={remove} />
    </PageShell>
  );
}
