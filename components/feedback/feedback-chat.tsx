"use client";

import { useContext, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useTranslations } from "next-intl";
import TextareaAutosize from "react-textarea-autosize";
import { ArrowLeft, ArrowUp } from "lucide-react";
import { StopIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";

import { ConfigContext } from "@/components/shell/config-context";
import { UserContext } from "@/app/(application)/authenticated";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MessageRenderer } from "@/components/message-renderer";

type Props = {
  kind: "bug" | "feature";
  sessionId: string;
  onBack: () => void;
};

export function FeedbackChat({ kind, sessionId, onBack }: Props) {
  const config = useContext(ConfigContext);
  const { user } = useContext(UserContext) ?? {};
  const t = useTranslations();
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");

  const fb = config?.feedback;
  if (!fb?.enabled) return null;

  // Same-origin proxy route; FEEDBACK_TOKEN is injected server-side there and
  // never reaches the browser.
  const api = `/api/feedback/${kind}`;

  const feedbackContext = useMemo(
    () => ({
      userEmail: user?.email ?? null,
      pageUrl: typeof window !== "undefined" ? window.location.href : null,
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
      kind,
    }),
    [user?.email, kind]
  );

  const { messages, sendMessage, status, stop } = useChat({
    experimental_throttle: 50,
    onError: (e: any) => {
      try {
        const parsed = JSON.parse(e?.message);
        setError(parsed?.detail ?? parsed?.message ?? e?.message);
      } catch {
        setError(e?.message ?? t("feedback.errorFallback"));
      }
    },
    transport: new DefaultChatTransport({
      api,
      prepareSendMessagesRequest: async ({ messages, body }) => ({
        body: {
          ...body,
          message: messages[messages.length - 1],
          id: sessionId,
          session: sessionId,
          feedbackContext,
        },
        headers: {
          User: user?.id ?? "anonymous",
          Session: sessionId,
          Stream: "true",
        },
      }),
    }),
  });

  const isBusy = status === "submitted" || status === "streaming";

  const handleSend = () => {
    const text = input.trim();
    if (!text || isBusy) return;
    setError(null);
    sendMessage({ text });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const placeholder =
    kind === "bug"
      ? t("feedback.placeholderBug")
      : t("feedback.placeholderFeature");
  const emptyState =
    kind === "bug"
      ? t("feedback.emptyStateBug")
      : t("feedback.emptyStateFeature");

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex items-center px-6 py-2 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-8 px-2 -ml-2 text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          <span className="ml-1">{t("feedback.back")}</span>
        </Button>
      </div>

      <Conversation className="flex-1 min-h-0">
        <ConversationContent className="px-6">
          {messages.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-12">
              {emptyState}
            </div>
          ) : (
            <MessageRenderer
              messages={messages}
              status={status}
              showActions={false}
              showTokens={false}
              showEdit={false}
              showRemove={false}
            />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error && (
        <div className="px-6 pb-2">
          <Alert variant="destructive">
            <ExclamationTriangleIcon className="h-4 w-4" />
            <AlertTitle>{t("feedback.errorTitle")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="border-t px-6 py-4">
        <div className="flex items-end gap-2">
          <TextareaAutosize
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            minRows={1}
            maxRows={6}
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            disabled={isBusy && status === "submitted"}
          />
          {isBusy ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={() => stop()}
              aria-label={t("feedback.stop")}
            >
              <StopIcon className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              disabled={!input.trim()}
              aria-label={t("feedback.send")}
            >
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
