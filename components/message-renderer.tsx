"use client"

import { DynamicToolUIPart, UIMessage } from "ai"
import { Message, MessageContent } from '@/components/ai-elements/message'
import { Response } from '@/components/ai-elements/response'
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning"
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/source"
import { RefreshCcwIcon, CopyIcon, ChevronDown, ChevronRight, Search, FileText, Database, ListChecks, LayoutList, EditIcon, Trash2Icon, DownloadIcon, ThumbsUp, ThumbsDown, Terminal, FileEdit, HelpCircle, Wrench, Globe, List, FolderOpen, GitBranch, Code2, Volume2, Pause, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { useToast } from "@/components/ui/use-toast"
import { TodoList } from "./ai-elements/todo-list"
import { FileItem } from "./uppy-dashboard"
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "next/navigation"
import { AgenticKnowledgeSourceSearchResults, KnowledgeSourceSearchResultChunk } from "@/types/models/knowledge-source-search-results"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useState, useEffect, useContext, useRef } from "react"
import { ConfigContext } from "@/components/config-context"
import { UserContext } from "@/app/(application)/authenticated"
import { getToken } from "@/util/api"
import { preprocessForTTS, chunkForTTS, TTS_MAX_CONCURRENT } from "@/lib/tts-text"
import { MessageActions, MessageAction } from '@/components/ai-elements/message'
import { Skeleton } from "./ui/skeleton"
import { ChatAddToolApproveResponseFunction } from "ai"
import { GradientText } from "./ui/shadcn-io/gradient-text"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea";
import { CheckIcon, XIcon } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { ToolCallApproval } from "./tool-call-approval"
import { Agent } from "@/types/models/agent"
import { ImageGenerationWidget, type ImageGenerationWidgetConfig } from "./image-generation/image-generation-widget"

interface ItemWithChunks {
  id: string,
  external_id: string,
  name: string,
  updatedAt: string,
  createdAt: string,
  context: {
    name: string,
    id: string
  },
  chunks: KnowledgeSourceSearchResultChunk[]
}

function camelCaseToLabel(camelCaseString) {
  if (!camelCaseString || typeof camelCaseString !== 'string') {
    return ''; // Return empty string for null, undefined, or non-string inputs
  }

  // 1. Insert a space before all capital letters that are not at the start of the string.
  let spacedString = camelCaseString.replace(/([A-Z])/g, ' $1');

  // 2. Trim any leading/trailing spaces (if they were introduced at the beginning).
  let trimmedString = spacedString.trim();

  // 3. Capitalize the first letter of the resulting string.
  let finalLabel = trimmedString.charAt(0).toUpperCase() + trimmedString.slice(1);

  return finalLabel;
}

interface MessageRendererProps {
  messages: UIMessage[]
  status?: "streaming" | "idle" | "error" | "submitted" | "ready"
  handleFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void
  className?: string
  showActions?: boolean
  showEdit?: boolean
  agent?: Agent
  showRemove?: boolean
  showTokens?: boolean
  addToolApprovalResponse?: ChatAddToolApproveResponseFunction
  onRegenerate?: () => void
  onUpdate?: (messages: UIMessage[]) => void
  UntypedToolPartComponent?: React.ComponentType<{
    agent: Agent
    untypedToolPart: DynamicToolUIPart
    callId: string
    addToContext: (item: any) => void
    addToolApprovalResponse: ChatAddToolApproveResponseFunction
  }>
  addToContext?: (item: any) => void
  writeAccess?: boolean
  AgentVisualComponent?: React.ComponentType<any>
  onQuestionAnswer?: (questionId: string, answerId: string, answerText: string) => void
  // The image_generation widget needs to inject a system message into the
  // live chat after the user selects images, so the assistant sees it on
  // its next turn without requiring a refetch. Optional — passed by chat
  // pages that own a useChat() instance.
  setMessages?: (updater: (prev: UIMessage[]) => UIMessage[]) => void
  config?: {
    marginTopFirstMessage?: string
    customAssistantClassnames?: string
  }
}

export function MessageRenderer({
  messages,
  status = "idle",
  agent,
  className,
  showActions = true,
  showTokens = true,
  showEdit = false,
  showRemove = false,
  onRegenerate,
  onUpdate,
  UntypedToolPartComponent,
  addToContext,
  writeAccess = true,
  AgentVisualComponent,
  onQuestionAnswer,
  config,
  addToolApprovalResponse,
  setMessages,
  handleFeedback
}: MessageRendererProps) {
  const { toast } = useToast()
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editedText, setEditedText] = useState<string>("")

  // Text-to-speech. Sentence-chunked streaming playback: text is split into
  // ~300-char chunks, up to TTS_MAX_CONCURRENT chunks are fetched in parallel,
  // and a single shared HTMLAudioElement plays them sequentially as they
  // arrive. Pause/resume is delegated to the audio element; switching to a
  // different message aborts the current playback. Per-message cache stores
  // each chunk's Blob so replays skip the network entirely.
  //
  // Design doc: docs/superpowers/specs/2026-05-25-text-to-speech-design.md
  const configContext = useContext(ConfigContext)
  const userContext = useContext(UserContext)
  const ttsEnabled = configContext?.tts?.enabled === true
  type TTSState = "idle" | "loading" | "playing" | "paused"
  const [ttsStateByMessage, setTtsStateByMessage] = useState<Record<string, TTSState>>({})
  // Per-message cache: sparse array of Blobs indexed by chunk number. Filled
  // as fetches resolve; persists across pauses and replays.
  const ttsCacheRef = useRef<Map<string, Array<Blob | undefined>>>(new Map())
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const playingMessageIdRef = useRef<string | null>(null)
  // AbortController for the in-flight playback session. Aborted when the user
  // switches messages or unmounts. Cancels both pending fetches and the player
  // loop's wait for the next chunk.
  const playbackAbortRef = useRef<AbortController | null>(null)

  const fetchChunkBlob = async (chunkText: string, signal: AbortSignal): Promise<Blob> => {
    const token = await getToken()
    if (!token) throw new Error("No valid session token available.")
    const res = await fetch(`${configContext?.backend}/speech`, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        User: userContext?.user?.id ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: chunkText }),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ detail: "Speech generation failed." }))
      throw new Error(errBody.detail || "Speech generation failed.")
    }
    return res.blob()
  }

  // Plays one chunk on the shared audio element and resolves when the chunk
  // ends. Pause/resume on the audio element is transparent — pausing keeps
  // this awaiting `ended`; resuming continues from the same position.
  const playOneChunk = (audio: HTMLAudioElement, blob: Blob, signal: AbortSignal): Promise<void> =>
    new Promise((resolve, reject) => {
      const onEnded = () => { cleanup(); resolve() }
      const onError = () => {
        const e = audio.error
        const codeNames: Record<number, string> = {
          1: "ABORTED",
          2: "NETWORK",
          3: "DECODE",
          4: "SRC_NOT_SUPPORTED",
        }
        const detail = e
          ? `${codeNames[e.code] ?? `code ${e.code}`}${e.message ? `: ${e.message}` : ""}`
          : "unknown"
        console.error("[TTS] audio.error", { code: e?.code, message: e?.message, blobType: blob.type, blobSize: blob.size })
        cleanup()
        reject(new Error(`Audio playback error (${detail})`))
      }
      const onAbort = () => { cleanup(); try { audio.pause() } catch { /* ignore */ }; reject(new Error("aborted")) }
      const cleanup = () => {
        audio.removeEventListener("ended", onEnded)
        audio.removeEventListener("error", onError)
        signal.removeEventListener("abort", onAbort)
      }
      audio.addEventListener("ended", onEnded, { once: true })
      audio.addEventListener("error", onError, { once: true })
      signal.addEventListener("abort", onAbort, { once: true })
      if (audio.src.startsWith("blob:")) URL.revokeObjectURL(audio.src)
      audio.src = URL.createObjectURL(blob)
      audio.play().catch((err) => {
        // play() rejection (AbortError, NotAllowedError, NotSupportedError).
        // The error event handler above may also fire — first-to-reject wins.
        reject(err instanceof Error ? err : new Error(String(err)))
      })
    })

  const handleTtsClick = async (message: UIMessage) => {
    // Lazy-init the shared audio element.
    if (!audioElRef.current) {
      audioElRef.current = new Audio()
    }
    const audio = audioElRef.current
    const currentState = ttsStateByMessage[message.id] ?? "idle"

    // Pause/resume on the currently playing message.
    if (currentState === "playing") {
      audio.pause()
      setTtsStateByMessage((s) => ({ ...s, [message.id]: "paused" }))
      return
    }
    if (currentState === "paused" && playingMessageIdRef.current === message.id) {
      try {
        await audio.play()
        setTtsStateByMessage((s) => ({ ...s, [message.id]: "playing" }))
      } catch (err) {
        console.error("[TTS] resume failed", err)
      }
      return
    }

    // Fresh play. Abort any existing playback session (cancels in-flight
    // fetches and the player loop) and reset prior message's state.
    if (playbackAbortRef.current) {
      playbackAbortRef.current.abort()
      playbackAbortRef.current = null
    }
    if (playingMessageIdRef.current && playingMessageIdRef.current !== message.id) {
      const prevId = playingMessageIdRef.current
      setTtsStateByMessage((s) => ({ ...s, [prevId]: "idle" }))
    }
    try { audio.pause() } catch { /* ignore */ }

    // Preprocess + chunk.
    const raw = message.parts?.map((p: any) => p?.text ?? "").join("\n") ?? ""
    const { text, truncated } = preprocessForTTS(raw)
    if (!text) {
      toast({ title: "Nothing to read", description: "Message has no readable text.", variant: "destructive" })
      return
    }
    if (truncated) {
      toast({ title: "Long message truncated", description: "Only the first 4000 characters will be read." })
    }
    const chunks = chunkForTTS(text)
    const cached = ttsCacheRef.current.get(message.id) ?? new Array<Blob | undefined>(chunks.length)
    // Resize cache if chunk count changed (shouldn't happen — text is stable —
    // but defensive in case the message edited).
    if (cached.length !== chunks.length) {
      cached.length = chunks.length
    }
    ttsCacheRef.current.set(message.id, cached)

    const abortController = new AbortController()
    playbackAbortRef.current = abortController
    playingMessageIdRef.current = message.id
    setTtsStateByMessage((s) => ({ ...s, [message.id]: "loading" }))

    // Per-chunk deferred promises. Player awaits slots[i]; fetcher resolves
    // them in completion order (which may differ from chunk order). When the
    // consumer errors out and aborts the controller, in-flight producer tasks
    // will reject the remaining slots with AbortError — slots after the
    // consumer's exit point have no awaiter, so we attach a no-op `.catch` to
    // suppress unhandled-rejection warnings without losing real errors (the
    // consumer still gets the rejection if it does await the slot).
    const slots: Array<{
      promise: Promise<Blob>
      resolve: (b: Blob) => void
      reject: (e: Error) => void
    }> = chunks.map(() => {
      let resolve!: (b: Blob) => void
      let reject!: (e: Error) => void
      const promise = new Promise<Blob>((res, rej) => { resolve = res; reject = rej })
      promise.catch(() => { /* suppress unhandled rejection for un-awaited slots */ })
      return { promise, resolve, reject }
    })

    // Pre-resolve slots for any already-cached chunks.
    cached.forEach((blob, i) => {
      if (blob) slots[i].resolve(blob)
    })

    // Producer: bounded-concurrency fetcher.
    const producer = (async () => {
      const inflight = new Set<Promise<void>>()
      for (let i = 0; i < chunks.length; i++) {
        if (abortController.signal.aborted) break
        if (cached[i]) continue
        while (inflight.size >= TTS_MAX_CONCURRENT) {
          await Promise.race(inflight)
          if (abortController.signal.aborted) return
        }
        const idx = i
        const task = fetchChunkBlob(chunks[idx], abortController.signal)
          .then((blob) => {
            cached[idx] = blob
            slots[idx].resolve(blob)
          })
          .catch((err) => {
            slots[idx].reject(err instanceof Error ? err : new Error(String(err)))
          })
          .finally(() => { inflight.delete(task) })
        inflight.add(task)
      }
      await Promise.allSettled(inflight)
    })()

    // Consumer: sequential playback loop.
    const consumer = (async () => {
      for (let i = 0; i < chunks.length; i++) {
        if (abortController.signal.aborted) return
        let blob: Blob
        try {
          blob = await slots[i].promise
        } catch (err) {
          if (abortController.signal.aborted) return
          throw err
        }
        if (abortController.signal.aborted) return
        if (i === 0) {
          setTtsStateByMessage((s) => ({ ...s, [message.id]: "playing" }))
        }
        try {
          await playOneChunk(audio, blob, abortController.signal)
        } catch (err) {
          if (abortController.signal.aborted) return
          throw err
        }
      }
    })()

    consumer
      .then(() => {
        if (!abortController.signal.aborted) {
          setTtsStateByMessage((s) => ({ ...s, [message.id]: "idle" }))
          playingMessageIdRef.current = null
        }
      })
      .catch((err) => {
        console.error("[TTS] playback failed", err)
        toast({
          title: "Couldn't play message",
          description: err instanceof Error ? err.message : "Audio playback failed.",
          variant: "destructive",
        })
        setTtsStateByMessage((s) => ({ ...s, [message.id]: "idle" }))
        playingMessageIdRef.current = null
        abortController.abort()
      })
      .finally(() => {
        // Leave the producer to wind down on its own (its tasks check the
        // signal). No need to await it here.
        void producer
      })
  }

  // Cleanup on unmount: abort any active playback, pause audio, revoke blob URL.
  useEffect(() => () => {
    playbackAbortRef.current?.abort()
    audioElRef.current?.pause()
    if (audioElRef.current?.src.startsWith("blob:")) {
      URL.revokeObjectURL(audioElRef.current.src)
    }
    audioElRef.current = null
    ttsCacheRef.current.clear()
  }, [])

  const handleStartEdit = (messageId: string, currentText: string) => {
    setEditingMessageId(messageId)
    setEditedText(currentText)
  }

  const handleRemove = (messageId: string) => {
    if (!onUpdate) return
    const index = messages.findIndex(msg => msg.id === messageId)
    const nextMessage = messages[index + 1]
    let updatedMessages = messages.filter(msg => msg.id !== messageId)

    // If the next message is a placeholder message, remove it
    if ((nextMessage?.metadata as any)?.type === 'placeholder') {
      updatedMessages = updatedMessages.filter(msg => msg.id !== nextMessage.id)
    }
    onUpdate(updatedMessages)
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditedText("")
  }

  const handleConfirmEdit = (messageId: string) => {
    if (!onUpdate) return
    const updatedMessages = messages.map(msg => {
      if (msg.id === messageId) {
        return {
          ...msg,
          parts: msg.parts?.map(part =>
            part.type === 'text'
              ? { ...part, text: editedText }
              : part
          )
        }
      }
      return msg
    })

    onUpdate(updatedMessages)
    setEditingMessageId(null)
    setEditedText("")
  }

  const todoToolType = 'tool-todo_write';

  // 1. Find all message indices that contain the specified tool part
  const todoMessageIndices = messages
    ?.map((message, index) => ({
      index,
      hasTodoPart: message.parts?.some(part => part.type.toLowerCase() === todoToolType)
    }))
    .filter(item => item.hasTodoPart)
    .map(item => item.index) ?? [];

  // 2. Determine which messages to keep and which to filter out
  let filteredMessages = messages;

  if (todoMessageIndices.length > 1) {
    // If there is more than one message with the todo part, filter out all but the last one.
    const lastIndex = todoMessageIndices[todoMessageIndices.length - 1];

    // Create a Set of indices to be removed for quick lookup
    const indicesToRemove = new Set(todoMessageIndices.filter(index => index !== lastIndex));

    filteredMessages = messages?.filter((_, index) => !indicesToRemove.has(index));
  }

  // Use filteredMessages in the rendering logic
  const messagesToRender = filteredMessages;

  const streamingTexts = [
    "Generating...",
    "Thinking...",
    "Researching...",
    "Planning...",
    "Writing...",
    "Responding...",
    "Finishing up...",
    "Almost there...",
    "Just a moment...",
  ]

  const [currentTextIndex, setCurrentTextIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTextIndex((prevIndex) => (prevIndex + 1) % streamingTexts.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [streamingTexts.length]);


  // Find the index of the last assistant message
  const lastAssistantMessageIndex = messagesToRender?.map((msg, idx) =>
    msg.role === 'assistant' ? idx : -1
  ).filter(idx => idx !== -1).pop() ?? -1;

  return (
    <>
      {messagesToRender?.map((message, messageIndex) => {
        const isFirstMessage = messageIndex === 0
        const isLastMessage =
          messageIndex === messages.length - 1;
        const isLastAssistantMessage = messageIndex === lastAssistantMessageIndex;
        const messageMetadata = message.metadata as any

        // iterate through all parts and find the ones that have a type of 'text' and contain '<file name="', if so
        // extract the filename and content, and return an array of objects with the filename and content
        // Remove the <file name="...">...</file> from the text and return the text without the file parts
        const files: { s3Key: string, content: string }[] = message.parts?.filter(
          (part) => part.type === 'text' &&
            part.text?.includes('<file name="')
        )?.flatMap((part) => {
          const fileParts = (part as any).text.match(/<file name="([^"]+)">([^<]+)<\/file>/g);
          return fileParts?.map((filePart) => {
            console.log("filePart", filePart);
            const s3Key = filePart.match(/<file name="([^"]+)">/)?.[1] ?? '';
            console.log("s3Key", s3Key);
            const content = filePart.match(/<file name="([^"]+)">([^<]+)<\/file>/)?.[2] ?? '';
            return { s3Key, content } as { s3Key: string, content: string };
          }) ?? []
        }) ?? [];

        const messageElement = (
          <Message
            className={cn(
              message.role === 'assistant' && (
                config?.customAssistantClassnames ? config?.customAssistantClassnames : ''
              ),
              isFirstMessage && (
                config?.marginTopFirstMessage ? config?.marginTopFirstMessage : 'mt-12'
              ), className
            )}
            from={message.role}
            key={message.id}
          >
            <MessageContent id={"message_id_" + message.id}>
              {message.parts?.map((part, i) => {

                if (part.type === 'step-start') {
                  return null
                }

                if (part.type === 'text') {

                  let text = part.text.replace(/<file name="([^"]+)">([^<]+)<\/file>/g, '');

                  // Render structured answer responses from the question_ask tool
                  const answerMatch = text.match(/^\[answer:(.+)\]$/s);
                  if (answerMatch) {
                    const cleanLabel = (raw: string) =>
                      camelCaseToLabel(raw.replace(/_/g, ' ').trim());
                    const answers = answerMatch[1]
                      .split(',')
                      .map((s) => cleanLabel(s.trim()))
                      .filter(Boolean);
                    return (
                      <div
                        key={`${message.id}-${i}`}
                        className="flex flex-wrap gap-1.5 py-1"
                      >
                        {answers.map((answer) => (
                          <span
                            key={answer}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm bg-primary/10 text-primary font-medium"
                          >
                            <CheckIcon className="h-3 w-3 shrink-0" />
                            {answer}
                          </span>
                        ))}
                      </div>
                    );
                  }

                  // Check if text contains JSON citations
                  // Create a more robust regex that matches all field orders
                  const flexibleCitationRegex = /\{[^}]*?item_name\s*:\s*[^,}]+[^}]*?\}/g;
                  const webSearchCitationRegex = /\{[^}]*?url\s*:\s*[^,}]+[^}]*?\}/g;
                  const hasKnowledgeSourceCitations = flexibleCitationRegex.test(text);
                  const hasWebSearchCitations = webSearchCitationRegex.test(text);

                  if (hasKnowledgeSourceCitations) {
                    // Transform JSON citations into cite-marker format
                    text = text.replace(/\{([^}]+)\}/g, (match, content) => {
                      // Check if this looks like a citation object
                      if (!content.includes('item_name')) {
                        return match; // Not a citation, keep original
                      }

                      try {
                        // Parse all fields from the citation object
                        const fields: Record<string, string> = {};
                        const fieldPattern = /(\w+)\s*:\s*([^,}]+?)(?:,|$)/g;
                        let fieldMatch: RegExpExecArray | null;

                        while ((fieldMatch = fieldPattern.exec(content)) !== null) {
                          fields[fieldMatch[1].trim()] = fieldMatch[2].trim();
                        }

                        // Extract required fields
                        const itemName = fields.item_name;
                        const itemId = fields.item_id;
                        const context = fields.context || ''; // Context can be empty
                        const chunkId = fields.chunk_id;
                        const chunkIndex = fields.chunk_index;

                        // Validate that we have all required fields (context and chunk_index are optional)
                        if (itemName && itemId) {
                          // Create citation string: item_name|item_id|chunk_id|chunk_index|context
                          const knowledgeSourceCitationData = `${itemName}|${itemId}|${chunkId || ''}|${chunkIndex || ''}|${context}`;
                          return `<cite-marker-knowledge-source data-citation="${encodeURIComponent(knowledgeSourceCitationData)}"></cite-marker-knowledge-source>`;
                        }

                        return match; // Missing required fields, keep original
                      } catch (error) {
                        console.error('Error parsing citation:', error);
                        return match; // Keep original on error
                      }
                    });
                  }

                  if (hasWebSearchCitations) {
                    text = text.replace(/\{([^}]+)\}/g, (match, content) => {
                      // Check if this looks like a citation object
                      if (!content.includes('url:')) {
                        return match; // Not a citation, keep original
                      }

                      try {
                        // Parse fields more carefully to handle commas in values
                        // Match pattern: field_name: value (where value continues until we hit ", next_field:" or "}")
                        const fields: Record<string, string> = {};
                        const fieldPattern = /(\w+)\s*:\s*(.*?)(?=,\s*\w+\s*:|$)/g;
                        let fieldMatch: RegExpExecArray | null;

                        while ((fieldMatch = fieldPattern.exec(content)) !== null) {
                          const key = fieldMatch[1].trim();
                          const value = fieldMatch[2].trim().replace(/,$/, ''); // Remove trailing comma if present
                          fields[key] = value;
                        }

                        // Extract required fields
                        const url = fields.url;
                        const title = fields.title;
                        const snippet = fields.snippet;

                        // Validate that we have all required fields
                        if (url && title && snippet) {
                          // Create citation string using a delimiter that's unlikely to appear in the content
                          // Using ⟪⟫ as delimiter since it's rare in text
                          const webSearchCitationData = `${url}⟪⟫${title}⟪⟫${snippet}`;
                          return `<cite-marker-web-search data-citation="${encodeURIComponent(webSearchCitationData)}"></cite-marker-web-search>`;
                        }

                        return match; // Missing required fields, keep original
                      } catch (error) {
                        console.error('Error parsing citation:', error);
                        return match; // Keep original on error
                      }
                    });
                  }

                  const isEditing = editingMessageId === message.id

                  return <>
                    {isEditing ? (
                      <div className="items-center gap-2" key={`${message.id}-${i}` + "_edit"}>
                        <div>
                          <Textarea
                            value={editedText}
                            rows={3}
                            onChange={(e) => setEditedText(e.target.value)}
                            className="flex-1 w-full min-w-[500px] resize-none"
                            autoFocus
                          />
                        </div>
                        <div className="flex items-center gap-2 justify-end mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={handleCancelEdit}>
                            <span className="text-destructive">Cancel</span>
                            <XIcon className="size-4 ml-2 text-destructive" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-500"
                            onClick={() => handleConfirmEdit(message.id)}>
                            <span className="text-green-500">Confirm</span>
                            <CheckIcon className="size-4 ml-2 text-green-500" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative" key={`${message.id}-${i}` + "_response_wrapper"}>
                        <Response className="chat-response-container">
                          {text}
                        </Response>
                      </div>
                    )}
                  </>
                }

                if (part.type?.toLowerCase() === 'tool-todo_write') {
                  const dynamicToolPart = part as any;
                  const output = dynamicToolPart.output as {
                    result: {
                      content: string
                      status: "pending" | "in_progress" | "completed" | "cancelled"
                      priority: "high" | "medium" | "low"
                      id: string
                    }[]
                  };
                  if (!output?.result) {
                    return null;
                  }
                  const state: "input-streaming" | "input-available" | "output-available" | "output-error" = dynamicToolPart.state;
                  return (
                    <TodoList todos={output.result} showPriority={true} state={state} />
                  )
                }

                if (part.type?.toLowerCase() === 'tool-question_ask') {
                  const dynamicToolPart = part as any;
                  let rawOutput = dynamicToolPart.output;
                  if (typeof rawOutput === "string") {
                    try { rawOutput = JSON.parse(rawOutput); } catch { return null; }
                  }
                  let result = rawOutput?.result;
                  if (typeof result === "string") {
                    try { result = JSON.parse(result); } catch { return null; }
                  }
                  if (!result) return null;

                  const questionData = result as {
                    questionId: string;
                    question: string;
                    answerOptions: { id: string; text: string }[];
                    status: string;
                  };

                  const laterMessages = messagesToRender.slice(messageIndex + 1);
                  const nextUserMessage = laterMessages.find((m) => m.role === "user");
                  const isAnswered = !!nextUserMessage;

                  const answeredText = nextUserMessage?.parts
                    ?.find((p) => p.type === "text")
                    ?.text ?? undefined;

                  if (isAnswered) {
                    return undefined;
                  }

                  return (
                    <QuestionAsk
                      key={`${message.id}-${i}`}
                      questionId={questionData.questionId}
                      question={questionData.question}
                      answerOptions={questionData.answerOptions}
                      isAnswered={isAnswered}
                      answeredText={answeredText}
                      onAnswer={(answerId, answerText) =>
                        onQuestionAnswer?.(questionData.questionId, answerId, answerText)
                      }
                      disabled={
                        !onQuestionAnswer ||
                        status === "submitted" ||
                        status === "streaming" ||
                        isAnswered
                      }
                    />
                  );
                }

                if (part.type?.toLowerCase() === 'tool-todo_read') {
                  return null;
                }

                if (part.type?.toLowerCase().includes('context_search')) {

                  if (
                    (
                      (part as any)?.state === 'approval-requested' ||
                      (part as any)?.state === 'approval-responded'
                    ) && agent && addToolApprovalResponse
                  ) {
                    return (
                      <ToolCallApproval agent={agent} part={part as any} addToolApprovalResponse={addToolApprovalResponse} />
                    )
                  }

                  const dynamicToolPart = part as any;
                  let output = dynamicToolPart.output as {
                    result: KnowledgeSourceSearchResultChunk[] | AgenticKnowledgeSourceSearchResults
                  };

                  if (typeof output === "string") {
                    output = JSON.parse(output)
                  }
                  if (typeof output?.result === "string") {
                    try {
                      output.result = JSON.parse(output?.result)
                    } catch (error) {
                      // Means the output is not a valid JSON, so treating it as text
                      return null;

                    }
                  }

                  const chunks = Array.isArray(output?.result) ? output?.result : output?.result?.chunks;
                  const reasoning: {
                    text: string;
                    tools: {
                      name: string;
                      id: string;
                      input: any;
                      output: any;
                    }[]
                  }[] = !Array.isArray(output?.result) ? output?.result?.reasoning : [];

                  // Map the chunks to items
                  const itemsMap = new Map<string, ItemWithChunks>();
                  const uniqueContexts = new Set(chunks?.map(chunk => {
                    return chunk.context?.name ? chunk.context.name.replaceAll('_', ' ') : '';
                  }));
                  const contextNames = Array.from(uniqueContexts).join(', ');
                  if (chunks) {
                    for (const chunk of chunks) {

                      if (itemsMap.has(chunk.item_id)) {
                        itemsMap.get(chunk.item_id)?.chunks.push(chunk);
                      } else {
                        itemsMap.set(chunk.item_id, {
                          id: chunk.item_id,
                          updatedAt: chunk.item_updated_at,
                          createdAt: chunk.item_created_at,
                          external_id: chunk.item_external_id,
                          name: chunk.item_name,
                          context: {
                            name: chunk.context?.name,
                            id: chunk.context?.id
                          },
                          chunks: [chunk]
                        });
                      }
                    }
                  }
                  return (
                    <>
                      <ReasoningVisualisation
                        reasoning={reasoning}
                        streaming={status !== "ready" && status !== "error" && isLastMessage && message.role === 'assistant'}
                      />
                      <ContextSearchResults
                        key={`${message.id}-${i}`}
                        input={dynamicToolPart.input}
                        state={dynamicToolPart.state}
                        contextNames={contextNames}
                        streaming={status !== "ready" && status !== "error" && isLastMessage && message.role === 'assistant'}
                        items={Array.from(itemsMap.values())}
                        totalChunks={chunks?.length ?? 0}
                      />
                    </>
                  )
                }

                if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
                  // Image generation tool results carry one of two shapes:
                  //  - { type: 'image_generation_widget', ... }: open the
                  //    interactive widget (current image_generation tool).
                  //  - { type: 'image_generation', url, ... }: render the
                  //    inline result rendered by the older per-model tool.
                  //    Kept so historical messages still render.
                  const dynamicToolPart = part as any;
                  let imageOutput: any = dynamicToolPart.output;
                  if (typeof imageOutput === "string") {
                    try { imageOutput = JSON.parse(imageOutput); } catch { /* not JSON */ }
                  }
                  let imageResult: any = imageOutput?.result;
                  if (typeof imageResult === "string") {
                    try { imageResult = JSON.parse(imageResult); } catch { /* not JSON */ }
                  }
                  if (
                    imageResult &&
                    typeof imageResult === 'object' &&
                    imageResult.type === 'image_generation_widget'
                  ) {
                    return (
                      <ImageGenerationWidget
                        key={`${message.id}-${i}`}
                        config={imageResult as ImageGenerationWidgetConfig}
                        setMessages={setMessages}
                      />
                    );
                  }
                  if (
                    imageResult &&
                    typeof imageResult === 'object' &&
                    imageResult.type === 'image_generation' &&
                    typeof imageResult.url === 'string'
                  ) {
                    return (
                      <ImageGenerationResult
                        key={`${message.id}-${i}`}
                        url={imageResult.url}
                        prompt={imageResult.prompt}
                        revisedPrompt={imageResult.revised_prompt}
                        model={imageResult.model}
                      />
                    );
                  }
                }

                if (
                  (part.type.startsWith('tool-') || part.type === 'dynamic-tool') &&
                  UntypedToolPartComponent &&
                  addToContext &&
                  agent &&
                  addToolApprovalResponse
                ) {
                  const untypedToolPart = part as DynamicToolUIPart
                  const callId = untypedToolPart.toolCallId
                  let output = untypedToolPart.output as {
                    result: KnowledgeSourceSearchResultChunk[] | AgenticKnowledgeSourceSearchResults
                  };

                  if (typeof output === "string") {
                    output = JSON.parse(output)
                  }
                  if (typeof output?.result === "string") {
                    try {
                      output.result = JSON.parse(output?.result)
                    } catch (error) {
                      // Means the output is not a valid JSON, so treating it as text
                      return null;

                    }
                  }

                  const reasoning: {
                    text: string;
                    tools: {
                      name: string;
                      id: string;
                      input: any;
                      output: any;
                    }[]
                  }[] = !Array.isArray(output?.result) ? output?.result?.reasoning : [];
                  return (

                    <>
                      <ReasoningVisualisation
                        reasoning={reasoning}
                        streaming={status !== "ready" && status !== "error" && isLastMessage && message.role === 'assistant'}
                      />
                      <UntypedToolPartComponent
                        key={callId}
                        agent={agent}
                        addToolApprovalResponse={addToolApprovalResponse}
                        untypedToolPart={untypedToolPart}
                        callId={callId}
                        addToContext={addToContext}
                      />
                    </>
                  )
                }

                if (part.type === 'file') {
                  if (part.mediaType?.startsWith('image/')) {
                    return (
                      <Image
                        key={`${message.id}-${i}`}
                        src={part.url}
                        width={300}
                        height={300}
                        alt={"Generated image"}
                      />
                    )
                  }
                }

                if (part.type === 'source-url') {
                  return (
                    <Sources key={`${message.id}-${i}`}>
                      <SourcesTrigger
                        count={message.parts?.filter(
                          (part) => part.type === 'source-url'
                        ).length}
                      />
                      <SourcesContent key={`${message.id}`}>
                        {message.parts?.map((part, i) => {
                          switch (part.type) {
                            case 'source-url':
                              return (
                                <Source
                                  key={`${message.id}-${i}`}
                                  href={part.url}
                                  title={part.title}
                                />
                              )
                          }
                        })}
                      </SourcesContent>
                    </Sources>
                  )
                }

                if (part.type === 'reasoning') {
                  return (
                    <Reasoning
                      key={`${message.id}-${i}`}
                      className="w-full"
                      defaultOpen={false}
                      isStreaming={status === 'streaming'}
                    >
                      <ReasoningTrigger />
                      <ReasoningContent>{part.text}</ReasoningContent>
                    </Reasoning>
                  )
                }

                return null
              })}

              {files.length > 0 && (
                <div className="grid grid-cols-6 min-w-[500px] gap-2 mt-3 mb-3">
                  {files.map((file) => (
                    <FileItem key={file.s3Key + "_file_item_" + message.id} s3Key={file.s3Key} onRemove={() => { }} active={false} disabled={false} />
                  ))}
                </div>
              )}

              {status !== "ready" && status !== "error" && isLastMessage && message.role === 'assistant' && (
                <div className="pointer-events-none">
                  <Skeleton className="w-[500px] rounded h-[35px] rounded-lg">
                    <GradientText
                      text={streamingTexts[currentTextIndex]}
                      gradient="linear-gradient(90deg, #404040 0%, #a3a3a3 50%, #d4d4d4 100%)"
                      className="my-auto w-full h-full flex"
                    />
                  </Skeleton>
                </div>
              )}

              {(
                ((showActions && message.role === 'assistant') || showEdit || showRemove) &&
                !editingMessageId &&
                (message.metadata as any)?.type !== 'placeholder'
              ) && (
                  <MessageActions className="mt-2">
                    {(showActions && message.role === 'assistant' && onRegenerate) && (
                      <MessageAction
                        className="mr-1"
                        onClick={() => onRegenerate()}
                        label="Retry"
                        disabled={!writeAccess}
                      >
                        <RefreshCcwIcon className="size-3" />
                      </MessageAction>
                    )}
                    {showActions && message.role === 'assistant' && (
                      <MessageAction
                        className="mr-1"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            message.parts?.map((part: any) => part?.text || "").join('\n')
                          )
                          toast({
                            title: "Copied message",
                            description: "The message was copied to your clipboard.",
                          })
                        }}
                        label="Copy"
                      >
                        <CopyIcon className="size-3" />
                      </MessageAction>
                    )}
                    {ttsEnabled && showActions && message.role === 'assistant' && (
                      <MessageAction
                        className="mr-1"
                        onClick={() => handleTtsClick(message)}
                        label={
                          (ttsStateByMessage[message.id] ?? "idle") === "playing"
                            ? "Pause"
                            : (ttsStateByMessage[message.id] ?? "idle") === "paused"
                              ? "Resume"
                              : "Read aloud"
                        }
                      >
                        {ttsStateByMessage[message.id] === "loading" && <Loader2 className="size-3 animate-spin" />}
                        {ttsStateByMessage[message.id] === "playing" && <Pause className="size-3" />}
                        {(!ttsStateByMessage[message.id] || ttsStateByMessage[message.id] === "idle" || ttsStateByMessage[message.id] === "paused") && <Volume2 className="size-3" />}
                      </MessageAction>
                    )}
                    {showActions && message.role === 'assistant' && (
                      <MessageAction
                        className="mr-1"
                        onClick={() => {
                          const messageText = message.parts?.map((part: any) => part?.text || "").join('\n')

                          // Create a blob with the text content
                          const blob = new Blob([messageText], { type: 'text/plain' })
                          const url = URL.createObjectURL(blob)

                          // Create a temporary link and trigger download
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `message-${new Date().getTime()}.txt`
                          document.body.appendChild(a)
                          a.click()

                          // Cleanup
                          document.body.removeChild(a)
                          URL.revokeObjectURL(url)

                          toast({
                            title: "Downloaded message",
                            description: "The message was downloaded as a text file.",
                          })
                        }}
                        label="Download"
                      >
                        <DownloadIcon className="size-3" />
                      </MessageAction>
                    )}
                    {showEdit && message.role === 'user' && (
                      <MessageAction
                        className="mr-1"
                        label="Edit"
                        onClick={() => handleStartEdit(
                          message.id,
                          message.parts?.map((part: any) => part?.text || "").join('\n')
                        )}
                      >
                        <EditIcon className="size-3" />
                      </MessageAction>
                    )}
                    {showRemove && (
                      <MessageAction
                        className="mr-1"
                        label="Remove"
                        onClick={() => handleRemove(message.id)}
                      >
                        <Trash2Icon className="size-3" />
                      </MessageAction>
                    )}
                    {
                      agent?.feedback && (
                        <>
                          <MessageAction
                            className="mr-1"
                            label="Feedback"
                            onClick={() => handleFeedback?.(message.id, 'positive')}
                          >
                            <ThumbsUp className="size-3" />
                          </MessageAction>
                          <MessageAction
                            className="mr-1"
                            label="Feedback"
                            onClick={() => handleFeedback?.(message.id, 'negative')}
                          >
                            <ThumbsDown className="size-3" />
                          </MessageAction>
                        </>
                      )
                    }
                    {(showTokens && message.role === 'assistant' && messageMetadata?.totalTokens) && (
                      <small className="text-muted-foreground">
                        {Intl.NumberFormat('en-US').format(messageMetadata?.totalTokens)} tokens
                      </small>
                    )}
                  </MessageActions>

                )}
            </MessageContent>
          </Message >
        );

        // Wrap the last assistant message with AgentVisual on the left
        if (isLastAssistantMessage && message.role === 'assistant' && AgentVisualComponent && agent) {
          return (
            <div key={message.id + '_wrapper'} className="flex items-start gap-3 w-full">
              <div className="shrink-0 mt-1">
                <AgentVisualComponent agent={agent} status={status} className="w-12 h-12" />
              </div>
              {messageElement}
            </div>
          );
        }

        return messageElement;
      })}
    </>
  )
}

const getToolIcon = (name: string) => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('readfile') || lower === 'read_file' || lower === 'read') return FileText;
  if (lower.includes('writefile') || lower === 'write_file' || lower === 'write') return FileEdit;
  if (lower === 'edit' || lower.includes('replace') || lower.includes('update')) return EditIcon;
  if (lower === 'bash' || lower === 'shell' || lower === 'exec' || lower.includes('command') || lower.includes('terminal')) return Terminal;
  if (lower.includes('question') || lower.includes('ask')) return HelpCircle;
  if (lower.includes('search') || lower.includes('grep') || lower.includes('find')) return Search;
  if (lower.includes('listdir') || lower === 'ls' || lower === 'list_files' || lower === 'list') return List;
  if (lower.includes('folder') || lower.includes('directory') || lower.includes('dir_')) return FolderOpen;
  if (lower.includes('todo')) return ListChecks;
  if (lower.includes('web') || lower.includes('fetch') || lower.includes('url') || lower.includes('http')) return Globe;
  if (lower.includes('delete') || lower.includes('remove') || lower.includes('rm_') || lower === 'rm') return Trash2Icon;
  if (lower.includes('git')) return GitBranch;
  if (lower.includes('code') || lower.includes('script')) return Code2;
  if (lower.includes('context') || lower.includes('knowledge')) return Database;
  return Wrench;
};

const getToolPreview = (input: any): string | null => {
  if (!input || typeof input !== 'object') return null;
  if (typeof input.path === 'string') return input.path;
  if (typeof input.file_path === 'string') return input.file_path;
  if (typeof input.filename === 'string') return input.filename;
  if (typeof input.command === 'string') return input.command;
  if (typeof input.query === 'string') return input.query;
  if (typeof input.url === 'string') return input.url;
  if (typeof input.question === 'string') return input.question;
  if (typeof input.prompt === 'string') return input.prompt;
  if (typeof input.text === 'string') return input.text;
  const firstStringValue = Object.values(input).find(
    (v) => typeof v === 'string' && v.length > 0 && v.length < 300
  );
  return typeof firstStringValue === 'string' ? firstStringValue : null;
};

const parseToolOutput = (output: any): any => {
  if (output == null) return null;
  if (typeof output === 'string') {
    try { return JSON.parse(output); } catch { return output; }
  }
  if (typeof output === 'object' && 'result' in output) {
    const result = (output as any).result;
    if (typeof result === 'string') {
      try { return JSON.parse(result); } catch { return result; }
    }
    return result;
  }
  if (typeof output === 'object' && 'content' in output && Object.keys(output).length === 1) {
    return (output as any).content;
  }
  return output;
};

const formatOutputForDisplay = (output: any): string => {
  if (output == null) return '';
  if (typeof output === 'string') return output;
  try {
    return JSON.stringify(output, null, 2);
  } catch {
    return String(output);
  }
};

const ToolCallChip = ({ tool }: { tool: { name: string; id: string; input: any; output: any } }) => {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = getToolIcon(tool.name);
  const preview = getToolPreview(tool.input);
  const parsedOutput = parseToolOutput(tool.output);
  const hasInput = tool.input && typeof tool.input === 'object' && Object.keys(tool.input).length > 0;
  const hasOutput = parsedOutput != null && parsedOutput !== '';
  const expandable = hasInput || hasOutput;

  return (
    <div className="border rounded-md bg-card/50 overflow-hidden">
      <button
        type="button"
        onClick={() => expandable && setIsOpen((v) => !v)}
        disabled={!expandable}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors",
          expandable && "hover:bg-accent/40 cursor-pointer",
          !expandable && "cursor-default"
        )}
      >
        <div className="p-1 rounded bg-primary/10 shrink-0">
          <Icon className="h-3 w-3 text-primary" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-xs font-medium text-foreground shrink-0">
            {camelCaseToLabel(tool.name)}
          </span>
          {preview && (
            <span className="text-[11px] text-muted-foreground truncate font-mono">
              {preview}
            </span>
          )}
        </div>
        {expandable && (
          <ChevronDown
            className={cn(
              "h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
            strokeWidth={1.5}
          />
        )}
      </button>
      {expandable && isOpen && (
        <div className="border-t px-2.5 py-2 space-y-2 bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-200">
          {hasInput && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Input
              </div>
              <pre className="text-[11px] font-mono bg-background/60 rounded p-2 whitespace-pre-wrap break-all max-h-48 overflow-auto border">
                {JSON.stringify(tool.input, null, 2)}
              </pre>
            </div>
          )}
          {hasOutput && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Output
              </div>
              <pre className="text-[11px] font-mono bg-background/60 rounded p-2 whitespace-pre-wrap break-all max-h-48 overflow-auto border">
                {formatOutputForDisplay(parsedOutput)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ReasoningVisualisation = ({
  reasoning,
  streaming
}: {
  streaming: boolean;
  reasoning: {
    text: string;
    tools: {
      name: string;
      id: string;
      input: any;
      output: any;
    }[]
  }[];
}) => {

  const [showAllReasoning, setShowAllReasoning] = useState(false);

  // Render a single reasoning step
  const renderReasoningStep = (step: {
    text: string; tools: {
      name: string;
      id: string;
      input: any;
      output: any;
    }[]
  }, index: number, animate: boolean = true) => (
    <div
      key={index}
      className={cn(
        "flex items-start gap-2",
        animate && "animate-in fade-in slide-in-from-left-3 duration-500"
      )}
      style={animate ? { animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' } : undefined}
    >
      <div
        className={cn(
          "w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary shrink-0 mt-0.5",
          animate && "animate-in zoom-in duration-300"
        )}
        style={animate ? { animationDelay: `${index * 100 + 200}ms`, animationFillMode: 'backwards' } : undefined}
      >
        {index + 1}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {step.text && (
          <div className="text-muted-foreground text-xs leading-relaxed">
            {step.text}
          </div>
        )}
        {step.tools.length > 0 && (
          <div
            className={cn(
              "space-y-1",
              animate && "animate-in fade-in duration-300"
            )}
            style={animate ? { animationDelay: `${index * 100 + 400}ms`, animationFillMode: 'backwards' } : undefined}
          >
            {step.tools.map((tool) => (
              <ToolCallChip key={tool.id} tool={tool} />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (<>
    {/* Sequential Reasoning Steps Visualization */}
    {reasoning && reasoning.length > 0 && (
      <div className="mt-3 space-y-3">
        {streaming ? (
          // Show latest 5 steps while streaming with animations
          <>
            {reasoning.length > 5 && !showAllReasoning && (
              <button
                onClick={() => setShowAllReasoning(true)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group w-full"
              >
                <div className="flex-1 border-t border-dashed border-muted-foreground/30 group-hover:border-foreground/30 transition-colors" />
                <span className="shrink-0">{reasoning.length - 5} more reasoning {reasoning.length - 5 === 1 ? 'step' : 'steps'} - show all</span>
                <div className="flex-1 border-t border-dashed border-muted-foreground/30 group-hover:border-foreground/30 transition-colors" />
              </button>
            )}
            {showAllReasoning
              ? reasoning.map((step, index) => renderReasoningStep(step, index, true))
              : reasoning.slice(-5).map((step, index) => {
                const actualIndex = reasoning.length - 5 + index;
                return renderReasoningStep(step, actualIndex >= 0 ? actualIndex : index, true);
              })
            }
          </>
        ) : (
          // Show collapsed view when not streaming
          <>
            {!showAllReasoning && reasoning.length > 1 && (
              <button
                onClick={() => setShowAllReasoning(true)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group w-full"
              >
                <div className="flex-1 border-t border-dashed border-muted-foreground/30 group-hover:border-foreground/30 transition-colors" />
                <span className="shrink-0">{reasoning.length} reasoning {reasoning.length === 1 ? 'step' : 'steps'} - show details</span>
                <div className="flex-1 border-t border-dashed border-muted-foreground/30 group-hover:border-foreground/30 transition-colors" />
              </button>
            )}

            {showAllReasoning && (
              // Show all steps without animation when expanded
              <>
                {reasoning.map((step, index) => renderReasoningStep(step, index, false))}
                {reasoning.length > 1 && (
                  <button
                    onClick={() => setShowAllReasoning(false)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-7"
                  >
                    Show less
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    )}
  </>)
}

const ContextSearchResults = ({
  streaming,
  contextNames,
  input,
  items,
  state,
  totalChunks,
}: {
  streaming: boolean;
  contextNames: string;
  input: Record<string, any>;
  items: ItemWithChunks[];
  totalChunks: number;
  state: "input-streaming" | "input-available" | "output-available" | "output-error" | "approval-requested" | "approval-responded"
}) => {

  const [isOpen, setIsOpen] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  const uniqueContexts = new Set(items.map(item => item.context.name));
  const displayItems = showAllItems ? items : items.slice(0, 3);

  return (
    <>

      {
        state === "output-available" && items?.length > 0 && !streaming && (
          <div className="my-3 border rounded-lg overflow-hidden bg-card">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Search className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-sm flex items-center gap-2">
                        Context search results {contextNames}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        {uniqueContexts.size > 0 && (
                          <span className="flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            {uniqueContexts.size} {uniqueContexts.size === 1 ? 'context' : 'contexts'}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {items.length} {items.length === 1 ? 'item' : 'items'}
                        </span>
                        <span className="flex items-center gap-1">
                          <LayoutList className="h-3 w-3" />
                          {totalChunks} chunks
                        </span>
                      </div>

                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="border-t">
                  {/* Search Parameters */}
                  {(input && Object.keys(input).length > 0) && (
                    <div className="p-4 bg-muted/30 border-b">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Search Parameters</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(input).map(([key, value]) => (
                          <Badge key={key} variant="outline" className="text-xs">
                            <span className="font-medium">{camelCaseToLabel(key)}:</span>
                            <span className="ml-1 font-normal">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Results Grid */}
                  <div className="p-4">
                    {items.length > 0 ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-3">
                          {displayItems.map((item) => (
                            <SearchResultItem key={item.id} item={item} />
                          ))}
                        </div>
                        {items.length > 3 && (
                          <div className="mt-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowAllItems(!showAllItems);
                              }}
                              className="text-sm text-primary hover:underline"
                            >
                              {showAllItems ? 'Show less' : `Show ${items.length - 3} more items`}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No items found.
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
    </>
  );
};

const SearchResultItem = ({ item }: { item: ItemWithChunks }) => {

  const router = useRouter();

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (<Card className="group relative overflow-hidden hover:shadow-md transition-all duration-200 hover:border-primary/50 cursor-pointer" onClick={() => {
    router.push(`/data/${item.context.id}/${item.id}`);
  }}>
    <CardContent className="p-4">
      {/* Item Name */}
      <div className="mb-2">
        <h4 className="font-medium text-sm line-clamp-2">
          {item.name || "Untitled"}
        </h4>
      </div>

      {item.external_id && (
        <small className="text-xs text-muted-foreground">
          {item.context.name} {item.external_id && `| ${item.external_id}`} | {item.id}
        </small>
      )}

      {/* Metadata Section */}
      <div className="space-y-2 pt-2 border-t">
        {/* Context Type */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {item.updatedAt && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDate(item.updatedAt)}
            </span>
          )}
        </div>

        {/* Text Length Indicator */}
        {item.chunks && item.chunks.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="text-xs">• {item.chunks.length} chunks</span>
          </div>
        )}
        {/* TODO provide a dialog modal that allows the user to view the chunks */}
        {/* TODO if metadata includes a source file name, show a link to the file */}
      </div>
    </CardContent>
  </Card>)
}

const QuestionAsk = ({
  questionId: _questionId,
  question,
  answerOptions,
  isAnswered,
  answeredText,
  onAnswer,
  disabled,
}: {
  questionId: string;
  question: string;
  answerOptions: { id: string; text: string }[];
  isAnswered: boolean;
  answeredText?: string;
  onAnswer: (answerId: string, answerText: string) => void;
  disabled: boolean;
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const toggle = (id: string) => {
    if (disabled || submitted) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    if (selectedIds.size === 0 || submitted) return;
    const selected = answerOptions.filter((o) => selectedIds.has(o.id));
    setSubmitted(true);
    onAnswer(
      Array.from(selectedIds).join(","),
      selected.map((o) => o.text).join(", "),
    );
  };

  // Collapsed view after local submission or when a later user message exists (page refresh)
  if (submitted || isAnswered) {
    const selectedOptions = answerOptions.filter((o) => selectedIds.has(o.id));
    return (
      <div className="my-3 border rounded-lg bg-card px-4 py-3 flex items-start gap-3">
        <div className="p-1.5 rounded-md bg-primary/10 shrink-0 mt-0.5">
          <CheckIcon className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground mb-1.5">{question}</div>
          {(() => {
            const answers = selectedOptions.length > 0
              ? selectedOptions.map((o) => o.text)
              : answeredText
                ? answeredText.split(", ").map((t) => t.trim()).filter(Boolean)
                : [];
            return answers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {answers.map((text) => (
                  <span
                    key={text}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary/10 text-primary font-medium"
                  >
                    {text}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic">Answered</div>
            );
          })()}
        </div>
      </div>
    );
  }

  return (
    <div className="my-3 border rounded-lg overflow-hidden bg-card">
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <ListChecks className="h-4 w-4 text-primary" />
          </div>
          <div className="font-medium text-sm">{question}</div>
        </div>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {answerOptions.map((option) => (
          <label
            key={option.id}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors select-none",
              selectedIds.has(option.id)
                ? "border-primary/50 bg-primary/5"
                : "border-border hover:bg-muted/40 hover:border-primary/30",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <Checkbox
              checked={selectedIds.has(option.id)}
              onCheckedChange={() => toggle(option.id)}
              disabled={disabled}
              className="shrink-0"
            />
            <span className="text-sm">{option.text}</span>
          </label>
        ))}
      </div>
      <div className="px-3 pb-3">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={selectedIds.size === 0 || disabled}
          className="w-full">
          Confirm selection
        </Button>
      </div>
    </div>
  );
};

const ImageGenerationResult = ({
  url,
  prompt,
  revisedPrompt,
  model,
}: {
  url: string;
  prompt?: string;
  revisedPrompt?: string;
  model?: string;
}) => {
  return (
    <div className="my-3 border rounded-lg overflow-hidden bg-card">
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={url}
          alt={prompt ?? "Generated image"}
          className="w-full max-w-[640px] h-auto block"
        />
      </a>
      {(prompt || revisedPrompt || model) && (
        <div className="p-3 space-y-1.5 text-xs text-muted-foreground border-t bg-muted/20">
          {model && (
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-foreground">Model:</span>
              <span>{model}</span>
            </div>
          )}
          {prompt && (
            <div>
              <span className="font-medium text-foreground">Prompt:</span>{" "}
              <span>{prompt}</span>
            </div>
          )}
          {revisedPrompt && revisedPrompt !== prompt && (
            <div>
              <span className="font-medium text-foreground">Revised prompt:</span>{" "}
              <span>{revisedPrompt}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

