"use client"

import { DynamicToolUIPart, UIMessage } from "ai"
import { Message, MessageContent } from '@/components/ai-elements/message'
import { Actions, Action } from '@/components/ai-elements/actions'
import { Response } from '@/components/ai-elements/response'
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning"
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/source"
import { RefreshCcwIcon, CopyIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { useToast } from "@/components/ui/use-toast"
import { TodoList } from "./ai-elements/todo-list"

interface MessageRendererProps {
  messages: UIMessage[]
  status?: "streaming" | "idle" | "error" | "submitted" | "ready"
  className?: string
  showActions?: boolean
  onRegenerate?: () => void
  onAddToolResult?: (args: { tool: string; toolCallId: string; output: string }) => void
  UntypedToolPartComponent?: React.ComponentType<{
    untypedToolPart: DynamicToolUIPart
    callId: string
    addToContext: (item: any) => void
  }>
  addToContext?: (item: any) => void
  writeAccess?: boolean
  config?: {
    marginTopFirstMessage?: string
    customAssistantClassnames?: string
  }
}

export function MessageRenderer({
  messages,
  status = "idle",
  className,
  showActions = true,
  onRegenerate,
  onAddToolResult,
  UntypedToolPartComponent,
  addToContext,
  writeAccess = true,
  config
}: MessageRendererProps) {
  const { toast } = useToast()

  return (
    <>
      {messages?.map((message, messageIndex) => {
        const isFirstMessage = messageIndex === 0
        const messageMetadata = message.metadata as any
        const isLastMessage = messageIndex === messages.length - 1

        return (
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
            <MessageContent>
              {message.parts.map((part, i) => {
                if (part.type === 'step-start') {
                  return null
                }

                if (part.type === 'text') {
                  return (
                    <div key={`${message.id}-${i}`}>
                      <Response className="chat-response-container">
                        {part.text}
                      </Response>
                    </div>
                  )
                }

                if (part.type === 'tool-askForConfirmation' && onAddToolResult) {
                  const callId = part.toolCallId

                  switch (part.state) {
                    case 'input-streaming':
                      return (
                        <div key={callId}>Loading confirmation request...</div>
                      )
                    case 'input-available':
                      return (
                        <div key={callId}>
                          {(part.input as { message: string }).message}
                          <div>
                            <button
                              onClick={() =>
                                onAddToolResult({
                                  tool: 'askForConfirmation',
                                  toolCallId: callId,
                                  output: 'Yes, confirmed',
                                })
                              }
                            >
                              Yes
                            </button>
                            <button
                              onClick={() =>
                                onAddToolResult({
                                  tool: 'askForConfirmation',
                                  toolCallId: callId,
                                  output: 'No, denied',
                                })
                              }
                            >
                              No
                            </button>
                          </div>
                        </div>
                      )
                    case 'output-available':
                      return (
                        <div key={callId}>
                          Tool call allowed: {part.output as string}
                        </div>
                      )
                    case 'output-error':
                      return <div key={callId}>Error: {part.errorText}</div>
                  }
                }

                if (part.type?.toLowerCase() === 'tool-todo_write' || part.type?.toLowerCase() === 'tool-todo_read') {
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

                if (
                  (part.type.startsWith('tool-') || part.type === 'dynamic-tool') &&
                  UntypedToolPartComponent &&
                  addToContext
                ) {
                  const untypedToolPart = part as DynamicToolUIPart
                  const callId = untypedToolPart.toolCallId
                  return (
                    <UntypedToolPartComponent
                      key={callId}
                      untypedToolPart={untypedToolPart}
                      callId={callId}
                      addToContext={addToContext}
                    />
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
                        count={message.parts.filter(
                          (part) => part.type === 'source-url'
                        ).length}
                      />
                      <SourcesContent key={`${message.id}`}>
                        {message.parts.map((part, i) => {
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
                      isStreaming={status === 'streaming'}
                    >
                      <ReasoningTrigger />
                      <ReasoningContent>{part.text}</ReasoningContent>
                    </Reasoning>
                  )
                }

                return null
              })}

              {showActions && message.role === 'assistant' && (
                <Actions className="mt-2">
                  {onRegenerate && (
                    <Action
                      onClick={() => onRegenerate()}
                      label="Retry"
                      disabled={!writeAccess}
                    >
                      <RefreshCcwIcon className="size-3" />
                    </Action>
                  )}
                  <Action
                    onClick={() => {
                      navigator.clipboard.writeText(
                        message.parts.map((part: any) => part?.text || "").join('\n')
                      )
                      toast({
                        title: "Copied message",
                        description: "The message was copied to your clipboard.",
                      })
                    }}
                    label="Copy"
                  >
                    <CopyIcon className="size-3" />
                  </Action>
                  {messageMetadata?.totalTokens && (
                    <small className="text-muted-foreground">
                      {Intl.NumberFormat('en-US').format(messageMetadata?.totalTokens)} tokens
                    </small>
                  )}
                </Actions>
              )}
            </MessageContent>
          </Message>
        )
      })}
    </>
  )
}
