"use client";

/**
 * Composer — "The Quiet Column" composer card (chat.md items 36, 60–70, 72–74, 76–78;
 * replaces the chat.tsx composer region, lines 1074–1394 — all w-[850px] widths removed).
 *
 * Exactly four always-visible controls: ＋ (AttachMenu) · autosize textarea ·
 * mic (flag-gated) · send/stop. The send button is THE purple accent of the
 * screen. Everything else is ghost/muted.
 *
 * Above the card: follow-up suggestion chips in a single scrollable row (63).
 * Inside the card, under the textarea: PinnedContextRow (67/68) and the
 * attachment FileItem grid (74). Below the card: managed-context one-time
 * dismissible hint (72), budget-exceeded destructive bar (73, block half),
 * character counter ≥90% (60), and the AI disclaimer (76).
 *
 * Read-only sessions replace the whole region with one muted bar (36 + 78).
 * Esc closes composer overlays in priority order (77); the textarea's own
 * Esc clears the input (60). `?promptId=` deep links autofill once via
 * GET_PROMPT_BY_ID from chat/queries.ts (65).
 *
 * All conversation state lives in the ChatSessionController (single-instance
 * rule); composer-local state is only the input string, the recording state
 * machine, and the overlay open flags.
 */

import * as React from "react";
import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQuery } from "@apollo/client";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import TextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";
import { ArrowUp, Info, Lock, Mic, Square, Wallet, X } from "lucide-react";

import { UserContext } from "@/app/(application)/authenticated";
import { ConfigContext } from "@/components/shell/config-context";
import { useLanguage } from "@/components/shell/language-provider";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/primitives/loading";
import { FileItem } from "@/components/primitives/file-picker";
import { ItemsSelectionModal } from "@/components/items-selection-modal";
import { getToken } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useIncrementPromptUsage } from "@/hooks/use-prompts";
import { PromptLibrary } from "@/types/models/prompt-library";

import { GET_PROMPT_BY_ID } from "../queries";
import type { ChatSessionController } from "../hooks";
import { CHAT_COLUMN } from "./chat-shell";
import { AttachMenu } from "./attach-menu";
import { ContextBanner } from "./context-banner";
import { CapabilitySheet } from "./capability-sheet";
import { PinnedContextRow } from "./pinned-context-row";
import { PromptSelectorModal } from "./prompt-selector-modal";
import { SavePresetModal } from "./save-preset-modal";

export interface ComposerProps {
  controller: ChatSessionController;
}

/** localStorage key for the one-time managed-context hint dismissal (item 72).
 *  NEW key, additive — flagged in the builder report (the stable-key contract
 *  lists only the pre-approval + files-panel + history-rail keys). */
const managedHintKey = (agentId: string) =>
  `chat.managedContextHint.dismissed.${agentId}`;

export function Composer({ controller }: ComposerProps) {
  const t = useTranslations("chat");
  const { user } = useContext(UserContext);
  const configContext = useContext(ConfigContext);
  const { locale } = useLanguage();

  const {
    agent,
    status,
    budgetExceeded,
    maxInputLength,
    suggestions,
    writeAccess,
    contextState,
  } = controller;
  const contextBlocked = contextState === "blocked";

  // ── Composer-local state ────────────────────────────────────────────────
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Overlay flags (Esc priority chain, item 77).
  const [promptSelectorOpen, setPromptSelectorOpen] = useState(false);
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [capabilitiesOpen, setCapabilitiesOpen] = useState(false);
  const [savePresetOpen, setSavePresetOpen] = useState(false);

  // Speech-to-text state machine (item 62). Feature hidden unless the shared
  // config enables transcription (EXULU_USE_LITELLM + TRANSCRIPTION_MODEL).
  const transcriptionEnabled = configContext?.transcription?.enabled === true;
  const [recordingState, setRecordingState] = useState<
    "idle" | "recording" | "transcribing"
  >("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Managed-context one-time dismissible hint (item 72). Default-hidden until
  // localStorage is read to avoid a flash for users who already dismissed it.
  const [managedHintDismissed, setManagedHintDismissed] = useState(true);
  useEffect(() => {
    try {
      setManagedHintDismissed(
        window.localStorage.getItem(managedHintKey(agent.id)) === "true",
      );
    } catch {
      setManagedHintDismissed(false);
    }
  }, [agent.id]);
  const dismissManagedHint = () => {
    setManagedHintDismissed(true);
    try {
      window.localStorage.setItem(managedHintKey(agent.id), "true");
    } catch {
      // Private browsing — session-scoped dismissal is fine.
    }
  };

  // ── Prompt insertion (items 65) ─────────────────────────────────────────
  const [incrementPromptUsage] = useIncrementPromptUsage();

  const insertPromptIntoChat = useCallback((promptText: string) => {
    setInput((prev) => (prev ? `${prev}\n\n${promptText}` : promptText));
    inputRef.current?.focus();
  }, []);

  const handleSelectPrompt = useCallback(
    (prompt: PromptLibrary, filledContent: string) => {
      insertPromptIntoChat(filledContent);
      incrementPromptUsage({
        variables: {
          id: prompt.id,
          usage_count: (prompt.usage_count || 0) + 1,
        },
      });
    },
    [incrementPromptUsage, insertPromptIntoChat],
  );

  // ?promptId= deep-link autofill, processed exactly once (item 65).
  const searchParams = useSearchParams();
  const initialPromptId = searchParams.get("promptId");
  const [initialPromptProcessed, setInitialPromptProcessed] = useState(false);
  const { data: initialPromptData } = useQuery<{
    prompt_library_itemById: PromptLibrary;
  }>(GET_PROMPT_BY_ID, {
    variables: { id: initialPromptId },
    skip: !initialPromptId,
  });
  useEffect(() => {
    if (initialPromptData?.prompt_library_itemById && !initialPromptProcessed) {
      const prompt = initialPromptData.prompt_library_itemById;
      setInitialPromptProcessed(true);
      handleSelectPrompt(prompt, prompt.content);
    }
  }, [initialPromptData, initialPromptProcessed, handleSelectPrompt]);

  // ── Esc priority chain for composer overlays (item 77) ─────────────────
  // The context modal is deliberately NOT in this chain: it hosts a nested
  // "New item" Radix dialog, and Radix's own layer handling must close the
  // child first (closing the parent from a document listener would
  // double-close). Radix dismissal still reaches composer state via the
  // controlled onOpenChange. The remaining single-level overlays mirror the
  // legacy chain (chat.tsx:315–332); Esc with no overlay open clears the
  // input via the textarea's own handler (item 60).
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (capabilitiesOpen) {
        setCapabilitiesOpen(false);
      } else if (savePresetOpen) {
        setSavePresetOpen(false);
      } else if (promptSelectorOpen) {
        setPromptSelectorOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [capabilitiesOpen, savePresetOpen, promptSelectorOpen]);

  // ── Send / stop (items 60/61) ───────────────────────────────────────────
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (contextBlocked) {
      toast.error(t("context.blockedToastTitle"), {
        description: t("context.blockedToastDescription"),
      });
      return;
    }
    if (budgetExceeded) {
      toast.error(t("composer.budgetReachedToastTitle"), {
        description: t("composer.budgetReachedToastDescription"),
      });
      return;
    }
    if (!input.trim()) return;

    const text = input;
    // Clear immediately for the instant-send feel; restore on failure so a
    // failed lazy session creation never eats the user's message.
    setInput("");
    try {
      await controller.sendUserMessage(text);
    } catch {
      setInput(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (status !== "submitted" && status !== "streaming" && input?.trim()) {
        void submit();
      }
    }
    if (e.key === "Escape" && input) {
      setInput("");
      e.preventDefault();
    }
  };

  // ── Speech-to-text (item 62; flow moved verbatim from chat.tsx:616–717) ─
  const handleRecordingStop = async () => {
    const mimeType = mediaRecorderRef.current?.mimeType ?? "audio/webm";
    const ext = mimeType.includes("mp4") ? "m4a" : "webm";
    const blob = new Blob(audioChunksRef.current, { type: mimeType });

    // Silently discard empty recordings (clicked stop before audio captured).
    if (blob.size < 1024) {
      setRecordingState("idle");
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      return;
    }

    setRecordingState("transcribing");
    const formData = new FormData();
    formData.append("file", blob, `recording.${ext}`);
    // Pass the user's UI locale as a Whisper language hint — without it,
    // auto-detection often flips short non-English clips to English.
    if (locale) formData.append("language", locale);

    try {
      const token = await getToken();
      if (!token) throw new Error("No valid session token available.");
      const res = await fetch(`${configContext?.backend}/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, User: user.id },
        body: formData,
      });
      if (!res.ok) {
        const errBody = await res
          .json()
          .catch(() => ({ detail: t("composer.transcriptionFailedDescription") }));
        throw new Error(
          errBody.detail || t("composer.transcriptionFailedDescription"),
        );
      }
      const { text } = (await res.json()) as { text?: string };
      if (text) {
        setInput((prev) => (prev ? `${prev} ${text}` : text));
        inputRef.current?.focus();
      }
    } catch (err) {
      toast.error(t("composer.transcriptionFailedTitle"), {
        description:
          err instanceof Error
            ? err.message
            : t("composer.transcriptionFailedDescription"),
      });
    } finally {
      setRecordingState("idle");
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
    }
  };

  const startRecording = async () => {
    // getUserMedia is only available in secure contexts. On http:// (anything
    // other than localhost/127.0.0.1) navigator.mediaDevices is undefined and
    // the browser will not prompt for permission — fail loudly with a clear
    // message instead of a generic "denied".
    if (typeof window !== "undefined" && !window.isSecureContext) {
      toast.error(t("composer.micUnavailableTitle"), {
        description: t("composer.micInsecureContext", {
          origin: window.location.origin,
        }),
      });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error(t("composer.micUnavailableTitle"), {
        description: t("composer.micNoGetUserMedia"),
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = handleRecordingStop;
      mr.start();
      mediaRecorderRef.current = mr;
      setRecordingState("recording");
    } catch (err) {
      const name = (err as { name?: string })?.name ?? "Error";
      const message = err instanceof Error ? err.message : String(err);
      let description = `${name}: ${message}`;
      if (name === "NotAllowedError") {
        description = t("composer.micPermissionDenied");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        description = t("composer.micNotFound");
      } else if (name === "NotReadableError") {
        description = t("composer.micInUse");
      } else if (name === "SecurityError") {
        description = t("composer.micBlocked");
      }
      toast.error(t("composer.micUnavailableTitle"), { description });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  };

  // Clean up any active recorder/stream on unmount so we don't leak the mic.
  useEffect(
    () => () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  // ── Read-only sessions: one muted bar replaces the region (items 36+78) ─
  if (!writeAccess) {
    return (
      <div className="pb-[env(safe-area-inset-bottom)]">
        <div className={cn(CHAT_COLUMN, "pb-4")}>
          <div className="flex items-center gap-2 rounded-lg border bg-muted px-4 py-3 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0" aria-hidden="true" />
            <span>
              {controller.creatorEmail
                ? t("composer.readOnly", { email: controller.creatorEmail })
                : t("composer.readOnlyNoCreator")}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const showCounter = input.length > maxInputLength * 0.9;
  const showSuggestions =
    suggestions.length > 0 && status !== "streaming" && status !== "submitted";

  return (
    <div className="pb-[env(safe-area-inset-bottom)]">
      {/* Suggestion chips — single horizontally scrollable row (item 63) */}
      {showSuggestions && (
        <div
          role="group"
          className={cn(
            CHAT_COLUMN,
            "mb-2 flex gap-2 overflow-x-auto pb-1 scrollbar-subtle",
          )}
          aria-label={t("composer.suggestionsLabel")}
        >
          {suggestions.map((suggestion, i) => (
            <Button
              key={i}
              type="button"
              variant="outline"
              size="sm"
              className="h-9 max-w-[18rem] shrink-0 rounded-full px-3 text-xs md:h-7"
              onClick={() => {
                setInput(suggestion);
                inputRef.current?.focus();
              }}
            >
              <span className="truncate">{suggestion}</span>
            </Button>
          ))}
        </div>
      )}

      <div className={CHAT_COLUMN}>
        {/* Context-window warn/blocked banner (context-window-management §5b) */}
        <ContextBanner controller={controller} />

        {/* Managed-context one-time dismissible hint (item 72) */}
        {controller.managedContextEnabled && !managedHintDismissed && (
          <div className="mb-2 flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-foreground">
                {t("composer.managedContextTitle")}
              </span>{" "}
              — {t("composer.managedContextHint")}
            </span>
            <button
              type="button"
              onClick={dismissManagedHint}
              aria-label={t("composer.dismissHint")}
              className="-my-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-md transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:-my-1 md:-mr-1 md:size-6"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* The composer card (items 60/61/62/64–70/74) */}
        <form
          onSubmit={submit}
          className="relative rounded-lg border bg-card p-2"
        >
          <div className="flex items-end gap-1.5">
            <AttachMenu
              controller={controller}
              onOpenPrompts={() => setPromptSelectorOpen(true)}
              onOpenContext={() => setContextModalOpen(true)}
              onOpenCapabilities={() => setCapabilitiesOpen(true)}
            />
            {/* Skills & tools surface (items 69/70 + 50 revocation). Mounted
                here so its desktop popover anchors beside the ＋ trigger. */}
            <CapabilitySheet
              open={capabilitiesOpen}
              onOpenChange={setCapabilitiesOpen}
              controller={controller}
            />
            <TextareaAutosize
              autoComplete="off"
              autoFocus={true}
              minRows={1}
              maxLength={maxInputLength}
              value={input}
              ref={inputRef}
              onKeyDown={handleKeyDown}
              onChange={(e) => setInput(e.target.value)}
              name="message"
              disabled={budgetExceeded || contextBlocked}
              placeholder={
                contextBlocked
                  ? t("context.placeholderBlocked")
                  : budgetExceeded
                    ? t("composer.placeholderBudgetReached")
                    : t("composer.placeholder")
              }
              className="max-h-40 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2.5 text-base placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              aria-label={t("composer.inputAriaLabel")}
              aria-describedby={showCounter ? "composer-length-warning" : undefined}
            />
            {transcriptionEnabled && (
              <Button
                className="size-11 shrink-0 md:size-9"
                variant="ghost"
                size="icon"
                type="button"
                disabled={
                  recordingState === "transcribing" ||
                  status === "submitted" ||
                  status === "streaming"
                }
                onClick={
                  recordingState === "recording" ? stopRecording : startRecording
                }
                aria-label={
                  recordingState === "recording"
                    ? t("composer.stopRecording")
                    : recordingState === "transcribing"
                      ? t("composer.transcribing")
                      : t("composer.startRecording")
                }
              >
                {recordingState === "idle" && (
                  <Mic className="size-5 text-muted-foreground" aria-hidden="true" />
                )}
                {recordingState === "recording" && (
                  <Square
                    className="size-5 text-destructive motion-safe:animate-pulse"
                    aria-hidden="true"
                  />
                )}
                {recordingState === "transcribing" && (
                  <Loading className="size-5" />
                )}
              </Button>
            )}
            {/* Send / stop swap — send is THE purple accent (item 61) */}
            {status !== "streaming" ? (
              <Button
                className="size-11 shrink-0 md:size-9"
                size="icon"
                type="submit"
                disabled={
                  status === "submitted" ||
                  !input?.trim() ||
                  recordingState !== "idle" ||
                  budgetExceeded ||
                  contextBlocked
                }
                aria-label={t("composer.send")}
              >
                <ArrowUp className="size-5" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                className="size-11 shrink-0 md:size-9"
                size="icon"
                type="button"
                onClick={controller.stop}
                aria-label={t("composer.stop")}
              >
                <Square className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>

          {/* Pinned knowledge scope chips + save-preset affordance (67/68) */}
          <PinnedContextRow
            controller={controller}
            onSavePreset={() => setSavePresetOpen(true)}
          />

          {/* Next-message attachments with per-file remove (item 74) */}
          {controller.fileItems && controller.fileItems.length > 0 && (
            <div
              role="group"
              className="grid grid-cols-3 gap-3 pt-2 sm:grid-cols-4"
              aria-label={t("composer.attachmentsLabel")}
            >
              {controller.fileItems.map((s3Key) => (
                <FileItem
                  key={s3Key}
                  s3Key={s3Key}
                  disabled={true}
                  active={false}
                  onRemove={() => controller.removeFileItem(s3Key)}
                />
              ))}
            </div>
          )}
        </form>

        {/* Budget-exceeded destructive bar (item 73, block half) */}
        {budgetExceeded && (
          <div
            className="mt-2 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            role="status"
            aria-live="polite"
          >
            <Wallet className="size-3.5 shrink-0" aria-hidden="true" />
            {t("composer.budgetReachedNotice")}
          </div>
        )}

        {/* Character counter from 90%, max-reached warning (item 60) */}
        {showCounter && (
          <div
            id="composer-length-warning"
            className="mt-1 flex justify-end text-xs text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {t("composer.charCount", {
              count: input.length,
              max: maxInputLength,
            })}
            {input.length >= maxInputLength && (
              <span className="ml-2 text-destructive">
                {t("composer.maxLengthReached")}
              </span>
            )}
          </div>
        )}

        {/* AI disclaimer (item 76) */}
        <p className="py-2 text-center text-xs text-muted-foreground">
          {t("composer.disclaimer")}
        </p>
      </div>

      {/* ── Overlays (composer-local open state, Esc chain above) ────────── */}

      {/* Prompt selector (item 65) */}
      <PromptSelectorModal
        open={promptSelectorOpen}
        onOpenChange={setPromptSelectorOpen}
        onSelectPrompt={handleSelectPrompt}
        agentId={agent.id}
      />

      {/* Knowledge context / items / presets (items 66/72) — controlled mode;
          all session_items writes go through the controller (dedupe +
          ensureSession live there). */}
      <ItemsSelectionModal
        open={contextModalOpen}
        onOpenChange={setContextModalOpen}
        // Item 72, third placement: the managed-context one-liner inside the
        // Context modal (alongside the ＋-menu subtitle and the composer hint).
        note={
          controller.managedContextEnabled
            ? `${t("composer.managedContextTitle")} — ${t("composer.managedContextHint")}`
            : undefined
        }
        onConfirm={async (data) => {
          await controller.addSessionItems(
            data.map((entry) => `${entry.context.id}/${entry.item.id}`),
          );
        }}
        onSelectContext={async (context) => {
          await controller.addSessionItems([context.id]);
        }}
        onApplyPreset={async (items) => {
          await controller.addSessionItems(items);
        }}
      />

      {/* Save context preset (item 68) */}
      <SavePresetModal
        isOpen={savePresetOpen}
        onClose={() => setSavePresetOpen(false)}
        currentItems={controller.sessionItems || []}
      />
    </div>
  );
}
