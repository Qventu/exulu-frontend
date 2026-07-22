"use client";

/**
 * MessageColumn — "The Quiet Column" conversation region (chat.md items
 * 31, 35, 39–59, 75; replaces the conversation region of chat.tsx:983–1055
 * plus the UntypedToolPart export of chat.tsx:1708–1753).
 *
 * - Every surface sits in CHAT_COLUMN (max-w-3xl) — no 850px (U1/U9).
 * - Empty/new-session state is single-focal (item 31, fixes U9):
 *   AgentVisual when the agent has a custom animation, else the Logo —
 *   never both; the welcome message renders as an assistant bubble, the
 *   default greeting as a quiet EmptyState. Starter suggestion chips are
 *   deliberately omitted — the suggestions endpoint needs an existing
 *   exchange, so there is no backend source (recorded deviation).
 * - The read-only badge does NOT live here — it merged into the composer's
 *   read-only bar (item 36, composer owner).
 * - UntypedToolPartComponent is built via a local factory closing over
 *   controller.approveToolForChat so MessageRenderer's frozen prop shape
 *   stays untouched (item 50).
 */

import type {
  ChatAddToolApproveResponseFunction,
  DynamicToolUIPart,
} from "ai";
import { useTranslations } from "next-intl";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { UserContext } from "@/app/(application)/authenticated";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import AgentVisual from "@/components/lottie";
import Logo from "@/components/logo";
import { MessageRenderer } from "@/components/message-renderer";
import { EmptyState } from "@/components/primitives/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/lib/rights";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/models/agent";

import type { ChatSessionController } from "../hooks";
import { CHAT_COLUMN } from "./chat-shell";
import {
  CredentialGuestNotice,
  CredentialRequestCard,
  OauthConnectCard,
} from "./credential-request-card";
import {
  extractCredentialRequest,
  extractOauthRequest,
} from "./credential-request-data";
import {
  extractReferencedItems,
  FeedbackDialog,
  type FeedbackTarget,
} from "./feedback-dialog";
import { ToolCallApproval } from "./tool-call-approval";
import { findTrajectoryRefForFeedback } from "./trajectory-ref";

export interface MessageColumnProps {
  controller: ChatSessionController;
  /** Public /public/agents surfaces: credential/oauth short-circuits render
   *  a sign-in notice instead of the live form (spec §4 — guests must never
   *  receive a usable nonce flow, and the public page keeps the JWT
   *  server-side so a submit could not authenticate anyway). */
  guestMode?: boolean;
}

/**
 * Builds the UntypedToolPartComponent handed to MessageRenderer. The frozen
 * renderer prop shape has no pre-approval channel, so the factory closes over
 * the controller's approveToolForChat (stable localStorage key) instead.
 * Behavior for non-approval states is identical to the legacy UntypedToolPart
 * (chat.tsx:1708–1753): collapsed Tool block with input/output (items 49, L4
 * detail inside).
 *
 * RECORDED DEVIATION (chat.md item 75): the addToContext channel is wired end
 * to end (MessageRenderer → here → controller.addFileItem), but no "Attach to
 * next message" action renders on tool outputs yet — exactly like legacy,
 * where the prop was also discarded. Tool outputs carry no recognizable
 * file/s3-key contract today, so there is nothing reliable to attach;
 * surface the labeled action here once the backend defines one.
 */
function makeUntypedToolPart(
  onApproveForChat: (toolId: string) => void,
  onCredentialResume: (provider: string, kind?: "credentials" | "oauth") => void,
  guestMode: boolean,
) {
  const UntypedToolPart = ({
    agent: _agent,
    untypedToolPart,
    callId,
    addToContext: _addToContext,
    addToolApprovalResponse,
  }: {
    agent: Agent;
    untypedToolPart: DynamicToolUIPart;
    callId: string;
    addToContext: (item: string) => void;
    addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  }) => {
    const output = untypedToolPart.output as any;
    // Replace - and _, replace 'tool-' prefix
    let styleToolName = untypedToolPart.type?.replace(/ /g, "-");
    styleToolName = styleToolName?.replace(/tool-/g, "");
    styleToolName = styleToolName?.replace(/_/g, " ");
    styleToolName =
      styleToolName?.charAt(0).toUpperCase() + styleToolName?.slice(1);

    if (
      untypedToolPart?.state === "approval-requested" ||
      untypedToolPart?.state === "approval-responded"
    ) {
      return (
        <ToolCallApproval
          part={untypedToolPart}
          addToolApprovalResponse={addToolApprovalResponse}
          onApproveForChat={onApproveForChat}
        />
      );
    }

    // Auth short-circuits (spec §2.2): render the credential form / connect
    // button instead of the generic collapsed Tool block. Never for guests.
    const credentialRequest = extractCredentialRequest(untypedToolPart);
    const oauthRequest = credentialRequest ? null : extractOauthRequest(untypedToolPart);
    if (credentialRequest || oauthRequest) {
      if (guestMode) {
        return <CredentialGuestNotice key={callId} />;
      }
      const toolCallId = untypedToolPart.toolCallId ?? callId;
      return credentialRequest ? (
        <CredentialRequestCard
          key={callId}
          toolCallId={toolCallId}
          payload={credentialRequest}
          onSubmitted={onCredentialResume}
        />
      ) : (
        <OauthConnectCard
          key={callId}
          toolCallId={toolCallId}
          payload={oauthRequest!}
          providerLabel={styleToolName}
          onSubmitted={(provider) => onCredentialResume(provider, "oauth")}
        />
      );
    }

    return (
      <Tool key={callId} className="mt-3" defaultOpen={false}>
        <ToolHeader
          title={styleToolName}
          className="capitalize"
          type={styleToolName as `tool-${string}`}
          state={untypedToolPart.state}
        />
        <ToolContent>
          <ToolInput input={untypedToolPart.input} />
          <ToolOutput
            output={
              output ? (
                // chunked: tool outputs can stream in while expanded — only
                // the growing last markdown block re-parses per tick.
                <Response chunked>
                  {typeof output === "string"
                    ? output
                    : JSON.stringify(output, null, 2)}
                </Response>
              ) : (
                !untypedToolPart.errorText && (
                  <Skeleton className="h-4 w-full" />
                )
              )
            }
            errorText={untypedToolPart.errorText}
          />
        </ToolContent>
      </Tool>
    );
  };
  UntypedToolPart.displayName = "UntypedToolPart";
  return UntypedToolPart;
}

export function MessageColumn({ controller, guestMode = false }: MessageColumnProps) {
  const t = useTranslations("chat");
  const { user } = useContext(UserContext);
  const { agent, messages, status } = controller;

  // Messages-local state: the feedback dialog target (items 57/58).
  const [feedbackTarget, setFeedbackTarget] = useState<FeedbackTarget | null>(
    null,
  );

  // Interim knowledge-curation gate for per-source deactivation (item 58 /
  // U3 fix). One-line predicate swap when role.knowledge lands (FLAGGED).
  const canDeactivateSources = useMemo(
    () => (user ? can(user, { area: "agents", level: "write" }) : false),
    [user],
  );

  // §2.4 auto-resume: one visible follow-up user message via the existing
  // transport (the question_ask pattern) — the model re-invokes the tool,
  // which now finds stored credentials.
  // Refs, not deps: controller.sendUserMessage is a fresh function every
  // render, and a changing dep here would recreate the UntypedToolPart
  // component TYPE each render — React would then remount every generic
  // tool part and wipe the credential card's submitted state mid-stream.
  const sendUserMessageRef = useRef(controller.sendUserMessage);
  const tRef = useRef(t);
  useEffect(() => {
    sendUserMessageRef.current = controller.sendUserMessage;
    tRef.current = t;
  });
  const handleCredentialResume = useCallback(
    (provider: string, kind: "credentials" | "oauth" = "credentials") => {
      void sendUserMessageRef.current(
        tRef.current(
          kind === "oauth"
            ? "credentials.oauthResumeMessage"
            : "credentials.resumeMessage",
          { provider },
        ),
      );
    },
    [],
  );

  /* eslint-disable react-hooks/refs -- false positive: the factory only
     CAPTURES handleCredentialResume; its ref reads happen in a click
     handler, never during render. */
  const UntypedToolPartComponent = useMemo(
    () =>
      makeUntypedToolPart(
        controller.approveToolForChat,
        handleCredentialResume,
        guestMode,
      ),
    [controller.approveToolForChat, handleCredentialResume, guestMode],
  );
  /* eslint-enable react-hooks/refs */

  // Single focal point (item 31, fixes U9): the agent's own visual when one
  // is configured, otherwise the platform logo — never both.
  const hasAgentVisual = Boolean(
    agent.animation_idle || agent.animation_responding,
  );

  const handleFeedback = (
    messageId: string,
    feedback: "positive" | "negative",
  ) => {
    const message = messages?.find((m) => m.id === messageId);
    const referencedItems =
      feedback === "negative" && message ? extractReferencedItems(message) : [];
    const trajectoryId = findTrajectoryRefForFeedback(messages, messageId);
    setFeedbackTarget({
      sessionId: controller.session?.id ?? "",
      agentId: agent.id,
      score: feedback === "positive" ? 1 : 0,
      referencedItems,
      trajectoryId,
    });
  };

  const isEmpty = !messages || messages.length === 0;

  return (
    <>
      <Conversation>
        {isEmpty && (
          <div className="flex size-full items-center justify-center overflow-y-hidden">
            <div
              className={cn(
                CHAT_COLUMN,
                "flex flex-col items-center gap-4 py-8",
              )}
            >
              {hasAgentVisual ? (
                <AgentVisual agent={agent} status={status} className="w-40" />
              ) : (
                <Logo
                  alt={agent.name}
                  width={120}
                  height={60}
                  className="h-16 w-auto object-contain"
                />
              )}
              {agent.welcomemessage ? (
                <Message from="assistant" key="welcome-message" className="mt-4">
                  <MessageContent id="message_id_welcome_message">
                    <Response className="chat-response-container">
                      {agent.welcomemessage}
                    </Response>
                  </MessageContent>
                </Message>
              ) : (
                <EmptyState
                  variant="quiet"
                  title={t("empty.greeting")}
                  className="py-0"
                />
              )}
            </div>
          </div>
        )}
        <ConversationContent className={cn(CHAT_COLUMN, "gap-6")}>
          {!isEmpty ? (
            <MessageRenderer
              messages={messages}
              status={status}
              agent={agent}
              showTokens={true}
              config={{ marginTopFirstMessage: "mt-6" }}
              handleFeedback={handleFeedback}
              addToolApprovalResponse={controller.addToolApprovalResponse}
              onRegenerate={controller.regenerate}
              setMessages={controller.setMessages}
              writeAccess={controller.writeAccess}
              // Item 75: tool outputs can attach a file to the next message.
              addToContext={(item) => controller.addFileItem(item)}
              // Item 47: question_ask answers dispatch through the controller
              // ("[answer:…]" send with empty files).
              onQuestionAnswer={(_questionId, _answerId, answerText) =>
                controller.sendQuestionAnswer(answerText)
              }
              UntypedToolPartComponent={UntypedToolPartComponent}
              AgentVisualComponent={AgentVisual}
            />
          ) : null}
        </ConversationContent>
        {/* Item 35: stick-to-bottom + floating jump button. */}
        <ConversationScrollButton aria-label={t("messages.scrollToBottom")} />
      </Conversation>

      <FeedbackDialog
        target={feedbackTarget}
        onOpenChange={(open) => {
          if (!open) setFeedbackTarget(null);
        }}
        canDeactivateSources={canDeactivateSources}
      />
    </>
  );
}
