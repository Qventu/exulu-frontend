"use client";

/**
 * /transcriptions/[itemId] — the reading view (task-10 brief, Step 9 / design
 * §4.3), and (task-12 brief, Step 8) the correction page: `?edit=1` requests
 * edit mode, but `TranscriptDocument` only renders it editable when the
 * viewer actually has write access.
 *
 * Write access is derived with `canWriteTranscriptItem` (types.ts) — a
 * client-side mirror of the backend's `validateWriteAccess`, the same gate
 * `transcriptions_itemsUpdateOneById` runs server-side. It was asked to reuse
 * whatever check `data/[ctx]/components/use-item-editor.ts` uses for this;
 * that file doesn't actually derive write access itself (it renders Edit
 * unconditionally and just lets the server reject the mutation) — see
 * `canWriteTranscriptItem`'s doc comment for why that's too late here: a
 * viewer who can only read must never see a Save button that's guaranteed to
 * fail. If the derivation is ever wrong anyway, the save handler below still
 * catches a server rejection and shows a plain message, never the raw
 * GraphQL error.
 *
 * Save routing: the generic item-update mutation persists `corrected_segments`
 * but never re-renders `transcript_text` — the field agent retrieval and
 * `/data` actually read. So when the saving user owns the job behind this
 * item (`shouldFinalizeItemSave`, types.ts), the save goes through
 * `FINALIZE_TRANSCRIPTION_JOB` instead, exactly as the review page does,
 * which re-renders and re-embeds server-side. Everyone else — a shared
 * editor who didn't create the job, or an item with no job at all — keeps
 * using the item-update path (a finalize call would only be rejected
 * server-side by `assertOwnsTranscriptionJob` anyway).
 *
 * Conflict guard: refetches on window focus, and if the item's `updatedAt`
 * moved since the edit session's baseline, confirms before overwriting it.
 */
import { useMutation } from "@apollo/client";
import { useTranslations } from "next-intl";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { PageShell } from "@/components/primitives/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

import { TranscriptDocument, type TranscriptDraft } from "../components/transcript-document";
import { useTranscriptItem } from "../hooks";
import { FINALIZE_TRANSCRIPTION_JOB, UPDATE_TRANSCRIPT_ITEM } from "../queries";
import { canWriteTranscriptItem, shouldFinalizeItemSave } from "../types";

/** A server rejection from `validateWriteAccess` (src/graphql/mutations/index.ts)
 *  always mentions "permission", except the private-record branch, which
 *  says "Only the creator can edit ...". Matching either turns that raw
 *  message into the same plain explanation the read-only banner already uses. */
const WRITE_ACCESS_ERROR = /permission|creator can edit/i;

export default function TranscriptItemPage() {
  // useSearchParams needs a Suspense boundary for prerendering.
  return (
    <React.Suspense fallback={null}>
      <TranscriptItemPageInner />
    </React.Suspense>
  );
}

function TranscriptItemPageInner() {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const itemId = params?.itemId as string | undefined;
  const { user } = React.useContext(UserContext);

  const { item, loading, error, refetch } = useTranscriptItem(itemId ?? "");
  const mode = searchParams.get("edit") === "1" ? "edit" : "read";

  const [updateItem] = useMutation(UPDATE_TRANSCRIPT_ITEM);
  const [finalizeJob] = useMutation(FINALIZE_TRANSCRIPTION_JOB);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [staleConfirmOpen, setStaleConfirmOpen] = React.useState(false);
  const pendingDraftRef = React.useRef<TranscriptDraft | null>(null);
  // Captured on every read → edit transition (including landing straight on
  // `?edit=1`), then left alone while editing continues — NOT re-armed by
  // the conflict guard's own focus refetch, which is what makes it a
  // baseline rather than a value that always matches the latest fetch. A
  // successful save re-establishes it too, so a second edit in the same
  // session doesn't warn about its own prior save.
  const baselineUpdatedAtRef = React.useRef<string | null>(null);
  const prevModeForBaselineRef = React.useRef<"read" | "edit" | null>(null);
  React.useEffect(() => {
    if (item && mode === "edit" && prevModeForBaselineRef.current !== "edit") {
      baselineUpdatedAtRef.current = item.updatedAt;
    }
    prevModeForBaselineRef.current = mode;
  }, [mode, item]);

  // Conflict guard: refetch on focus so `item.updatedAt` is current by the
  // time a Save actually checks it against the baseline above.
  React.useEffect(() => {
    if (mode !== "edit") return;
    const onFocus = () => void refetch();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [mode, refetch]);

  if (!itemId) return null;

  if (loading && !item) {
    return (
      <PageShell variant="full-bleed">
        {/* full-bleed has no padding of its own — without this the skeletons
            run straight into the navigation rail. */}
        <div className="space-y-6 p-4 md:p-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)_300px]">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (!loading && (error || !item)) {
    return (
      <PageShell variant="content">
        <EmptyState
          variant="error"
          title={t("document.loadFailed")}
          description={error?.message}
          action={{ label: tCommon("retry"), onClick: () => void refetch() }}
        />
      </PageShell>
    );
  }

  if (!item) return null;

  const canWrite = canWriteTranscriptItem(item, user);

  // Generic item-update path: writes corrected_segments (and the other
  // editable fields) but does NOT re-render transcript_text — see
  // `shouldFinalizeItemSave`'s doc comment in types.ts for why the owner
  // path below must go through finalize instead.
  const saveViaItemUpdate = async (draft: TranscriptDraft) => {
    const input: Record<string, unknown> = {
      name: draft.title,
      speakers: draft.speakers,
      project_id: draft.projectId,
      rights_mode: draft.rightsMode,
      RBAC: { users: draft.rbacUsers, roles: draft.rbacRoles },
    };
    // null = untouched (TranscriptDraft's contract) — omit the key so an
    // unedited transcript's corrected_segments is left exactly as it was.
    if (draft.correctedSegments !== null) {
      input.corrected_segments = draft.correctedSegments;
    }
    await updateItem({ variables: { id: item.id, input } });
  };

  const performSave = async (draft: TranscriptDraft) => {
    try {
      if (shouldFinalizeItemSave(item, user) && item.job_id) {
        const finalizeInput: Record<string, unknown> = {
          title: draft.title,
          speakers: draft.speakers,
          project_id: draft.projectId,
          target_rights_mode: draft.rightsMode,
          target_rbac_users: draft.rbacUsers,
          target_rbac_roles: draft.rbacRoles,
        };
        if (draft.correctedSegments !== null) {
          finalizeInput.corrected_segments = draft.correctedSegments;
        }
        try {
          await finalizeJob({ variables: { id: item.job_id, input: finalizeInput } });
        } catch {
          // Finalize failed for some reason (unexpected job status, a
          // permission edge case, a transient error) — fall back to the
          // item-update path rather than leaving the owner unable to save at
          // all. Only the outer catch below reports a failure to the user,
          // so this never produces a second error toast.
          await saveViaItemUpdate(draft);
        }
      } else {
        await saveViaItemUpdate(draft);
      }
      toast.success(t("toasts.updated"));
      await refetch();
      router.replace(`/transcriptions/${item.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (WRITE_ACCESS_ERROR.test(message)) {
        toast.error(t("document.writeAccessDenied"));
      } else {
        toast.error(t("toasts.saveFailed"), {
          description: message || undefined,
        });
      }
      throw err; // TranscriptDocument keeps edit mode open
    }
  };

  const handleSave = async (draft: TranscriptDraft) => {
    if (
      baselineUpdatedAtRef.current &&
      item.updatedAt !== baselineUpdatedAtRef.current
    ) {
      pendingDraftRef.current = draft;
      setStaleConfirmOpen(true);
      return;
    }
    await performSave(draft);
  };

  const handleConfirmStaleSave = async () => {
    if (!pendingDraftRef.current) return;
    const draft = pendingDraftRef.current;
    pendingDraftRef.current = null;
    await performSave(draft);
  };

  return (
    <>
      <TranscriptDocument
        item={item}
        mode={mode}
        canWrite={canWrite}
        published
        onSave={mode === "edit" ? handleSave : undefined}
        onDiscard={mode === "edit" ? () => setDiscardOpen(true) : undefined}
      />
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={tCommon("unsavedChangesTitle")}
        description={tCommon("leaveWithoutSavingDescription")}
        confirmLabel={tCommon("leaveWithoutSaving")}
        onConfirm={async () => {
          router.replace(`/transcriptions/${item.id}`);
        }}
      />
      <ConfirmDialog
        open={staleConfirmOpen}
        onOpenChange={setStaleConfirmOpen}
        title={t("document.staleConflictTitle")}
        description={t("document.staleConflictDescription")}
        confirmLabel={t("document.staleConflictConfirm")}
        onConfirm={handleConfirmStaleSave}
      />
    </>
  );
}
