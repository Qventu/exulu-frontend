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

import { isDemoMode } from "@/lib/demo/flag";
import { toolLabel } from "@/lib/demo/overlays";
import type {
  ChatAddToolApproveResponseFunction,
  DynamicToolUIPart,
  UIMessage,
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
import type { ClaimCheckSourceType } from "@/lib/api/claim-check";
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
import { ClaimCheck, type ClaimCheckState } from "./claim-check";
import { collectSources, parseClaimCheckTrigger } from "./claim-check-data";
import { MemoryCard } from "./memory-card";
import { isMemoryToolPart } from "./memory-card-data";
import { MemoryStack } from "./memory-stack";
import { SkillCard } from "./skill-card";
import { isSkillToolPart } from "./skill-card-data";
import { RecalledMemories } from "./recalled-memories";
import { ToolCallApproval } from "./tool-call-approval";
import { ToolCallApprovalGroup } from "./tool-call-approval-group";
import { summarizeToolGroup } from "./tool-call-group-data";
import { ToolCallResultGroup } from "./tool-call-result-group";
import { ToolTrace } from "./tool-trace";
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
  sessionId: string,
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
    // The demo names the tool in German ("Wissenssuche", "Gedächtnis-Eintrag
    // gespeichert"); the product shows the raw name with underscores spaced.
    const rawToolName = (untypedToolPart.type ?? "").replace(/^tool-/, "");
    const toolTitle = isDemoMode() ? toolLabel(rawToolName) : styleToolName;

    // Memory cards (spec §4.1) replace the generic approval card for
    // tool-memory_* parts. No "Allow for this chat" — the card is the
    // consent. Guests never see memory cards.
    // Skill cards (create / publish a version) work the same way: the card is
    // the consent, and it carries the visibility choice back to the tool.
    if (isSkillToolPart(untypedToolPart)) {
      if (guestMode) return null;
      return <SkillCard key={callId} part={untypedToolPart} agent={_agent} sessionId={sessionId} addToolApprovalResponse={addToolApprovalResponse} />;
    }

    if (isMemoryToolPart(untypedToolPart)) {
      if (guestMode) return null;
      return (
        <MemoryCard key={callId} part={untypedToolPart} agent={_agent} addToolApprovalResponse={addToolApprovalResponse} />
      );
    }

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
      <Tool key={callId} className="mt-3" defaultOpen={false} data-demo-id="chat-tool-trace">
        <ToolHeader
          title={toolTitle}
          // The product title-cases a tool name ("Context Search"); a German
          // label is a phrase and must keep its own casing.
          className={isDemoMode() ? undefined : "capitalize"}
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

/**
 * Builds the GroupedToolPartComponent handed to MessageRenderer: one card for
 * a run of identical consecutive tool calls (message-renderer-tool-groups.ts
 * decides what counts as a run).
 *
 * Three outcomes, in order:
 *  1. a member carries an auth short-circuit (credential form / oauth connect)
 *     — those need their own actionable card, so the run degrades to the
 *     per-part renderer. Only this factory can tell: the extractors are
 *     route-local, which is why the renderer delegates the check here.
 *  2. anything still awaiting approval — the batch approval card, which
 *     answers every pending id at once.
 *  3. otherwise — the collapsed results card.
 */
function makeGroupedToolPart(
  UntypedToolPart: ReturnType<typeof makeUntypedToolPart>,
  onApproveForChat: (toolId: string) => void,
) {
  const GroupedToolPart = ({
    agent,
    toolType,
    parts,
    addToContext,
    addToolApprovalResponse,
  }: {
    agent: Agent;
    toolType: string;
    parts: DynamicToolUIPart[];
    addToContext: (item: string) => void;
    addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  }) => {
    const summary = summarizeToolGroup(parts);

    if (summary.hasAuthShortCircuit) {
      return (
        <>
          {parts.map((part, index) => (
            <UntypedToolPart
              key={part.toolCallId ?? `${toolType}-${index}`}
              agent={agent}
              untypedToolPart={part}
              callId={part.toolCallId ?? `${toolType}-${index}`}
              addToContext={addToContext}
              addToolApprovalResponse={addToolApprovalResponse}
            />
          ))}
        </>
      );
    }

    if (summary.pendingApprovalIds.length > 0) {
      return (
        <ToolCallApprovalGroup
          parts={parts}
          toolType={toolType}
          addToolApprovalResponse={addToolApprovalResponse}
          onApproveForChat={onApproveForChat}
        />
      );
    }

    return <ToolCallResultGroup parts={parts} toolType={toolType} />;
  };
  GroupedToolPart.displayName = "GroupedToolPart";
  return GroupedToolPart;
}

/**
 * Threads guestMode into RecalledMemories (final-review finding 4) the same
 * way makeUntypedToolPart closes over it for MemoryCard above —
 * RecalledMemoriesComponent's frozen shape (message-renderer.tsx) has no
 * guestMode prop, so the factory closure carries it instead.
 */
function makeRecalledMemories(guestMode: boolean) {
  const RecalledMemoriesForColumn = ({ message, agent }: { message: UIMessage; agent: Agent }) => (
    <RecalledMemories message={message} agent={agent} guestMode={guestMode} />
  );
  RecalledMemoriesForColumn.displayName = "RecalledMemoriesForColumn";
  return RecalledMemoriesForColumn;
}

/**
 * Carries the per-message claim-check state and guestMode in a closure, the
 * same way makeRecalledMemories does — MessageRenderer's component props are a
 * frozen shape and take only { message, agent }.
 *
 * Also derives `sourceNames` (id -> name) and `sourceTypes` (id -> type) from
 * the message's own retrieval parts: `collectSources` (F2) re-reads the same
 * tool output the message already carries, so this costs nothing extra. An
 * id whose source carries no name is skipped rather than falling back to the
 * id itself — a raw source id must never reach the panel, which already
 * falls back to the quote alone when a name is absent. `sourceTypes` is what
 * lets the panel say "memory" or "web" instead of implying every source is a
 * knowledge-base document (F3).
 */
export function makeClaimCheck(claimChecks: Record<string, ClaimCheckState>, guestMode: boolean) {
  const ClaimCheckForColumn = ({ message }: { message: UIMessage; agent: Agent }) => {
    const state = claimChecks[message.id] ?? null;
    // `collectSources` re-parses this turn's tool outputs — ~89,000
    // characters on a real turn — and this component re-renders constantly,
    // because the AI SDK hands back a NEW `messages` array on nearly every
    // streamed tick. Two guards: no check state means no panel and so
    // nothing to label (the common case, and every message during a
    // stream), and for the one message that does have a check the labels are
    // memoised on its id. Keyed on `message.id` rather than `message`
    // precisely because the object identity churns while the tool parts a
    // FINISHED turn carries never change — and a check only exists once the
    // turn finished.
    const { sourceNames, sourceTypes } = useMemo(() => {
      const names: Record<string, string> = {};
      const types: Record<string, ClaimCheckSourceType> = {};
      if (!state) return { sourceNames: names, sourceTypes: types };
      const trigger = parseClaimCheckTrigger(message.metadata);
      if (trigger) {
        for (const source of collectSources(message, trigger.sources)) {
          if (source.name && source.id) names[source.id] = source.name;
          if (source.id && source.type) types[source.id] = source.type;
        }
      }
      return { sourceNames: names, sourceTypes: types };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [message.id, state]);
    return (
      <ClaimCheck
        state={state}
        guestMode={guestMode}
        sourceNames={sourceNames}
        sourceTypes={sourceTypes}
      />
    );
  };
  ClaimCheckForColumn.displayName = "ClaimCheckForColumn";
  return ClaimCheckForColumn;
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
        controller.session?.id ?? "",
      ),
    [controller.approveToolForChat, handleCredentialResume, guestMode, controller.session?.id],
  );
  const GroupedToolPartComponent = useMemo(
    () =>
      makeGroupedToolPart(
        UntypedToolPartComponent,
        controller.approveToolForChat,
      ),
    [UntypedToolPartComponent, controller.approveToolForChat],
  );
  /* eslint-enable react-hooks/refs */

  const RecalledMemoriesComponent = useMemo(
    () => makeRecalledMemories(guestMode),
    [guestMode],
  );

  const ClaimCheckComponent = useMemo(
    () => makeClaimCheck(controller.claimChecks, guestMode),
    [controller.claimChecks, guestMode],
  );

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
      <Conversation data-demo-id="chat-messages">
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
              GroupedToolPartComponent={GroupedToolPartComponent}
              // A run of consecutive tool calls of any kind (the sequential
              // agent loop) folds into one trace card — tool-trace.tsx.
              ToolTraceComponent={ToolTrace}
              // Consecutive pending "remember" approvals render under one
              // "Save all" bar (spec §4.1). Guests never see memory cards —
              // omitting the prop makes MessageRenderer fall back to
              // per-part rendering, where MemoryCard's own guestMode check
              // (above) returns null for each part.
              MemoryStackComponent={guestMode ? undefined : MemoryStack}
              // "Recalled N memories" block (spec §2.5, §4.2). Always
              // passed — the backend already omits recalledMemories
              // metadata for guests unless the agent allows it (memory-
              // section.tsx guests.showRecalled), so the component itself
              // renders nothing in the common case. When that config IS on,
              // the factory-wrapped component still carries guestMode
              // through so RecalledMemories can suppress Open/Forget
              // (final-review finding 4) rather than link/mutate against
              // routes a guest has no access to.
              RecalledMemoriesComponent={RecalledMemoriesComponent}
              // "Checked the answer" panel (spec §5, §5.1), rendered directly
              // after recalled-memories so the two sit together under the
              // answer. The factory closes over controller.claimChecks (keyed
              // by message id, fired on stream end) and guestMode, mirroring
              // RecalledMemoriesComponent above — MessageRenderer's frozen
              // component-prop shape has no room for either.
              ClaimCheckComponent={ClaimCheckComponent}
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
