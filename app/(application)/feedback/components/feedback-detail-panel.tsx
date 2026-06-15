"use client";

/**
 * FeedbackDetailPanel — the right-pane (or Sheet) body for a selected feedback
 * item: type indicator, meta strip (user / agent / session with copy-id),
 * Open-in-Chat, the feedback text, and the read-only conversation rendered by
 * MessageRenderer.
 *
 * Wrapped by <ListDetail/> in the parent (FeedbackList) — this component is
 * just the body. Delete is gated through the shared ConfirmDialog, opened
 * from the OverflowMenu.
 */

import { useMutation, useQuery } from "@apollo/client";
import { ExternalLink, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { CopyButton } from "@/components/primitives/copy-button";
import { Loading } from "@/components/primitives/loading";
import { OverflowMenu } from "@/components/primitives/overflow-menu";
import { RelativeTime } from "@/components/primitives/relative-time";
import { MessageRenderer } from "@/components/message-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DELETE_FEEDBACK,
  GET_AGENT_BY_ID,
  GET_AGENT_MESSAGES,
  GET_AGENT_SESSION_BY_ID,
  GET_FEEDBACK,
  GET_USER_BY_ID,
} from "@/queries/queries";
import { cn } from "@/lib/utils";

import type { FeedbackItem } from "./use-feedback-query";

export interface FeedbackDetailPanelProps {
  feedback: FeedbackItem;
  onDeleted?: () => void;
}

export function FeedbackDetailPanel({
  feedback,
  onDeleted,
}: FeedbackDetailPanelProps) {
  const t = useTranslations("feedbackReview");

  const [deleteOpen, setDeleteOpen] = React.useState(false);

  // Same four queries as the old sheet — skip-guarded against missing ids.
  const { data: messagesData, loading: messagesLoading } = useQuery(
    GET_AGENT_MESSAGES,
    {
      variables: {
        page: 1,
        limit: 1000,
        filters: [{ session: { eq: feedback.session } }],
      },
      skip: !feedback.session,
    },
  );
  const { data: userData } = useQuery(GET_USER_BY_ID, {
    variables: { id: feedback.user?.toString() },
    skip: !feedback.user,
  });
  const { data: sessionData } = useQuery(GET_AGENT_SESSION_BY_ID, {
    variables: { id: feedback.session },
    skip: !feedback.session,
  });
  const { data: agentData } = useQuery(GET_AGENT_BY_ID, {
    variables: { id: feedback.agent },
    skip: !feedback.agent,
  });

  const [deleteFeedback] = useMutation(DELETE_FEEDBACK, {
    refetchQueries: [GET_FEEDBACK, "GetFeedback"],
  });

  const positive = feedback.score === 1;
  const user = userData?.userById;
  const agent = agentData?.agentById;
  const session = sessionData?.agent_sessionById;

  const messages = React.useMemo(() => {
    const raw = messagesData?.agent_messagesPagination?.items ?? [];
    return raw
      .map((msg: { content: string }) => {
        try {
          return JSON.parse(msg.content);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }, [messagesData]);

  const userDisplayName = user?.name || user?.email || `User ${feedback.user}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header — type indicator + RelativeTime + overflow menu */}
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full",
              positive
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {positive ? (
              <ThumbsUp className="size-3.5" />
            ) : (
              <ThumbsDown className="size-3.5" />
            )}
          </span>
          <span className="text-sm font-medium">
            {positive ? t("typePositive") : t("typeNegative")}
          </span>
          <span className="text-sm text-muted-foreground">·</span>
          <RelativeTime
            date={feedback.createdAt}
            className="text-sm text-muted-foreground"
          />
          {feedback.status ? (
            <Badge variant="outline" className="ml-1">
              {feedback.status}
            </Badge>
          ) : null}
        </div>
        <OverflowMenu
          align="end"
          items={[
            {
              label: t("detailPanel.deleteAction"),
              icon: Trash2,
              destructive: true,
              onSelect: () => setDeleteOpen(true),
            },
          ]}
        />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
        {/* Meta grid */}
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-[auto,1fr]">
          <dt className="text-muted-foreground">{t("detailPanel.metaUser")}</dt>
          <dd className="flex min-w-0 items-center gap-2">
            <span className="truncate">{userDisplayName}</span>
            {feedback.user ? (
              <CopyButton
                value={String(feedback.user)}
                label={t("detailPanel.copyUserId")}
                size="icon"
                className="size-7"
              />
            ) : null}
          </dd>
          <dt className="text-muted-foreground">
            {t("detailPanel.metaAgent")}
          </dt>
          <dd className="flex min-w-0 items-center gap-2">
            <span className="truncate">
              {agent?.name ?? feedback.agent}
            </span>
            <CopyButton
              value={feedback.agent}
              label={t("detailPanel.copyAgentId")}
              size="icon"
              className="size-7"
            />
          </dd>
          <dt className="text-muted-foreground">
            {t("detailPanel.metaSession")}
          </dt>
          <dd className="flex min-w-0 items-center gap-2">
            <span className="truncate font-mono text-xs">
              {session?.title ?? feedback.session}
            </span>
            <CopyButton
              value={feedback.session}
              label={t("detailPanel.copySessionId")}
              size="icon"
              className="size-7"
            />
          </dd>
        </dl>

        <div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/chat/${feedback.agent}/${feedback.session}`}>
              {t("detailPanel.openInChat")}
              <ExternalLink aria-hidden="true" className="ml-2 size-3.5" />
            </Link>
          </Button>
        </div>

        {/* Feedback text */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            {t("detailPanel.feedbackHeading")}
          </h3>
          <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-sm">
            {feedback.description}
          </div>
        </section>

        {/* Conversation */}
        <section className="flex min-h-0 flex-1 flex-col gap-2">
          <h3 className="text-sm font-semibold">
            {t("detailPanel.conversationHeading")}
          </h3>
          {messagesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loading />
            </div>
          ) : messages.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-y-auto rounded-md border p-4">
              <MessageRenderer
                messages={messages}
                showTokens={false}
                config={{ marginTopFirstMessage: "mt-0" }}
                status="idle"
                writeAccess={false}
                agent={agent}
                addToolApprovalResponse={() => {}}
                handleFeedback={() => {}}
              />
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("detailPanel.conversationEmpty")}
            </p>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        variant="destructive"
        title={t("confirmDelete.singleTitle")}
        description={t("confirmDelete.singleDescription")}
        onConfirm={async () => {
          try {
            await deleteFeedback({ variables: { id: feedback.id } });
            toast.success(t("toasts.deleteSuccessSingle"));
            onDeleted?.();
          } catch (err) {
            toast.error(t("toasts.deleteFailure"));
            throw err;
          }
        }}
      />
    </div>
  );
}
