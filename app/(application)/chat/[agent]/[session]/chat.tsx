"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMutation, useQuery } from "@apollo/client";
import { ChatRequestOptions, DefaultChatTransport, DynamicToolUIPart, FileUIPart, lastAssistantMessageIsCompleteWithToolCalls, UIMessage } from "ai";
import { useChat } from '@ai-sdk/react';
import * as React from "react";
import { useContext, useEffect, useState, useMemo } from "react";
import { UserContext } from "@/app/(application)/authenticated";
import { StopIcon } from "@radix-ui/react-icons";
import { AgentMessage, AgentSession } from "@EXULU_SHARED/models/agent-session";
import { Message, MessageContent } from '@/components/ai-elements/message';
import { Actions, Action } from '@/components/ai-elements/actions';
import { Loader } from '@/components/ai-elements/loader';
import TextareaAutosize from "react-textarea-autosize";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  GET_AGENT_MESSAGES,
  GET_USER_BY_ID,
  UPDATE_AGENT_SESSION_RBAC,
} from "@/queries/queries";
import { getToken } from "@/util/api"
import { Agent } from "@EXULU_SHARED/models/agent";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ConfigContext } from "@/components/config-context";
import { Workflow, Plus, RefreshCcwIcon, CopyIcon, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast"
import { SaveWorkflowModal } from "@/components/save-workflow-modal";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";
import { Response } from '@/components/ai-elements/response';
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/source";
import { useIsMobile } from "@/hooks/use-mobile";
import { z } from 'zod';
import { RBACControl } from "@/components/rbac";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loading } from "@/components/ui/loading";
import { Badge } from "@/components/ui/badge";
import { checkChatSessionWriteAccess } from "@/lib/check-chat-session-write-access";
import UppyDashboard, { FileItem, getPresignedUrl } from "@/components/uppy-dashboard";
import { Item } from "@/types/models/item";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import {
  Context,
  ContextTrigger,
  ContextContent,
  ContextContentHeader,
  ContextContentBody,
  ContextContentFooter,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextCacheUsage,
} from '@/components/ai-elements/context';
import { Progress } from "@/components/ui/progress";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtImage,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from '@/components/ai-elements/chain-of-thought';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
  ToolInput,
} from '@/components/ai-elements/tool';
import { Skeleton } from "@/components/ui/skeleton";

export interface ChatProps {
  chatId?: string;
  agentId?: string;
  messages?: UIMessage[];
  input?: string;
  handleInputChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  addToolResult?: any
  handleSubmit?: (
    e: React.FormEvent<HTMLFormElement>,
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
  isLoading: boolean;
  onFilesSelected: (file: any[]) => void;
  error?: undefined | Error;
  stop?: () => void;
}

export function ChatLayout({ session, agent }: { session: AgentSession, agent: Agent }) {

  const [error, setError] = useState<string | null>(null);
  const configContext = React.useContext(ConfigContext);
  const isMobile = useIsMobile();
  const [files, setFiles] = useState<FileUIPart[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const { user } = useContext(UserContext);
  const [copyingTableId, setCopyingTableId] = useState<string | null>(null);
  const [showSaveWorkflowModal, setShowSaveWorkflowModal] = useState(false);
  const [input, setInput] = useState('');
  const [disabledTools, setDisabledTools] = useState<string[]>([]);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast()

  const [rbac, setRbac] = useState({
    rights_mode: session?.rights_mode || 'private',
    users: session?.RBAC?.users || [],
    roles: session?.RBAC?.roles || [],
    projects: session?.RBAC?.projects || []
  })

  const creatorQuery = useQuery(GET_USER_BY_ID, {
    variables: { id: session.created_by },
    skip: !session.created_by
  })


  const [updateAgentSessionRbac, updateAgentSessionRbacResult] = useMutation(UPDATE_AGENT_SESSION_RBAC);
  const [tokenCounts, setTokenCounts] = useState<MessageMetadata>({
    totalTokens: 0,
    reasoningTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0
  });

  useQuery<{
    agent_messagesPagination: {
      items: AgentMessage[]
    };
  }>(GET_AGENT_MESSAGES, {
    returnPartialData: true,
    fetchPolicy: "network-only",
    nextFetchPolicy: "network-only",
    variables: {
      page: 1,
      limit: 50,
      filters: {
        session: {
          eq: session.id
        }
      },
    },
    onCompleted: (data) => {
      if (data?.agent_messagesPagination) {
        const messages = data?.agent_messagesPagination.items.map((item) => (JSON.parse(item.content)))
        setMessages(messages as any[]);
      }
    },
  });

  const {
    messages,
    sendMessage,
    status,
    stop,
    regenerate,
    setMessages,
    addToolResult
  } = useChat({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    // Throttle the messages and data updates to 50ms:
    experimental_throttle: 50,
    async onToolCall({ toolCall }) {
      // Check if it's a dynamic tool first for proper type narrowing
      if (toolCall.dynamic) {
        return;
      }

      if (toolCall.toolName === 'getLocation') {
        const cities = ['New York', 'Los Angeles', 'Chicago', 'San Francisco'];

        // No await - avoids potential deadlocks
        addToolResult({
          tool: 'confirm-tool-call',
          toolCallId: toolCall.toolCallId,
          output: cities[Math.floor(Math.random() * cities.length)],
        });
      }
    },
    onError: (error) => {
      console.log("error!!", error?.message)
      try {
        const { message } = JSON.parse(error?.message)
        setError(message)
      } catch (x) {
        setError(error.message)
      }
    },
    transport: new DefaultChatTransport({
      api: `${configContext?.backend}${agent.slug}/${agent.id}`,
      // only send the last message to the server: we load
      // the history from the database.
      prepareSendMessagesRequest: async ({ messages, id: chatId, body }) => {
        const token = await getToken()
        if (!token) {
          throw new Error("No valid session token available.")
        }
        return {
          body: {
            ...body,
            message: messages[messages.length - 1],
            id: chatId,
            session: session.id,
          }, headers: {
            User: user.id,
            Session: session.id,
            Authorization: `Bearer ${token}`,
            Stream: "true"
          }
        };
      },
    })
  });

  type MessageMetadata = {
    totalTokens: number;
    reasoningTokens: number;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
  }

  useEffect(() => {
    const totalCount = messages?.reduce((acc, message) => {
      const messageMetadata: MessageMetadata = message.metadata as any;
      return acc + (messageMetadata?.totalTokens || 0);
    }, 0);
    const reasoningCount = messages?.reduce((acc, message) => {
      const messageMetadata: MessageMetadata = message.metadata as any;
      return acc + (messageMetadata?.reasoningTokens || 0);
    }, 0);
    const inputCount = messages?.reduce((acc, message) => {
      const messageMetadata: MessageMetadata = message.metadata as any;
      return acc + (messageMetadata?.inputTokens || 0);
    }, 0);
    const outputCount = messages?.reduce((acc, message) => {
      const messageMetadata: MessageMetadata = message.metadata as any;
      return acc + (messageMetadata?.outputTokens || 0);
    }, 0);
    const cachedInputCount = messages?.reduce((acc, message) => {
      const messageMetadata: MessageMetadata = message.metadata as any;
      return acc + (messageMetadata?.cachedInputTokens || 0);
    }, 0);
    setTokenCounts({
      totalTokens: totalCount,
      reasoningTokens: reasoningCount,
      inputTokens: inputCount,
      outputTokens: outputCount,
      cachedInputTokens: cachedInputCount
    })
  }, [messages])

  // Check if conversation has enough content for a workflow
  const canCreateWorkflow = useMemo(() => {
    const userMessages = messages?.filter(m => m.role === 'user') || [];
    const assistantMessages = messages?.filter(m => m.role === 'assistant') || [];
    return userMessages.length >= 1 && assistantMessages.length >= 1;
  }, [messages]);

  const convertTableToCSV = (tableElement: HTMLTableElement): string => {
    const rows = Array.from(tableElement.querySelectorAll('tr'));
    const csvRows: string[] = [];

    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('th, td'));
      const csvRow = cells.map(cell => {
        // Escape quotes and wrap in quotes if contains comma, newline, or quote
        let text = cell.textContent || '';
        text = text.replace(/"/g, '""');
        if (text.includes(',') || text.includes('\n') || text.includes('"')) {
          text = `"${text}"`;
        }
        return text;
      });
      csvRows.push(csvRow.join(','));
    });

    return csvRows.join('\n');
  };

  const copyTableAsCSV = async (tableElement: HTMLTableElement, tableId: string) => {
    setCopyingTableId(tableId);

    try {
      const csv = convertTableToCSV(tableElement);
      await navigator.clipboard.writeText(csv);

      toast({
        title: "Table copied!",
        description: "Table data has been copied to clipboard as CSV",
      });

      // Reset the copying state after a short delay
      setTimeout(() => {
        setCopyingTableId(null);
      }, 2000);
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Failed to copy table to clipboard",
        variant: "destructive",
      });
      setCopyingTableId(null);
    }
  };

  const onSubmit = async (
    e: React.FormEvent,
    options?: ChatRequestOptions,
  ) => {
    e.preventDefault();
    sendMessage({
      text: input,
      files: files || []
    }, {
      body: {
        disabledTools: disabledTools,
      },
    });
    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  const toggleTool = (id: string) => {
    setDisabledTools(prev =>
      prev.includes(id)
        ? prev.filter(name => name !== id)
        : [...prev, id]
    );
  };

  const writeAccess = checkChatSessionWriteAccess(session, user);

  const updateMessageFiles = async (items: Item[]) => {
    const files = await Promise.all(items.map(async (item) => {

      if (!item.s3key) {
        // Take all item fields and turn into a data url
        let content = "";
        Object.entries(item).forEach(([key, value]) => {
          content += `${key}: ${value}\n`
        })
        return {
          type: "file" as const,
          mediaType: item.type,
          filename: item.name,
          url: `data:text/plain;base64,${btoa(content)}`
        }
      }

      return {
        type: "file" as const,
        mediaType: item.type,
        filename: item.name,
        url: await getPresignedUrl(item.s3key)
      }

    }))
    setFiles(files)
  }

  useEffect(() => {
    if (!items) {
      setFiles(null)
      return;
    }
    updateMessageFiles(items)
  }, [items])

  return (
    <div className="flex flex-col w-full">
      <div className="mx-auto relative size-full">
        <div className="flex h-full w-full">
          {/* Main conversation area */}
          <div className="flex flex-col flex-1 pb-6">
            {/* @ts-ignore */}
            <Conversation className="overflow-y-hidden">
              {/* Save as Workflow button - appears when conversation has content */}
              {canCreateWorkflow && (
                <div className="flex justify-between absolute top-0 left-0 right-0 items-center px-4 py-2 border-b z-10 dark:bg-black bg-white">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Workflow className="w-4 h-4" />
                    Turn this conversation into a reusable workflow
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSaveWorkflowModal(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Save as Workflow
                  </Button>
                </div>
              )}
              {
                /* Show a bar that fills up depending on the total tokens used */
                agent.maxContextLength &&
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`absolute w-full ${canCreateWorkflow ? 'top-10' : 'top-0'}`}>
                        <Progress className="w-full rounded-none" value={tokenCounts.totalTokens / agent.maxContextLength * 100} />
                        <div className="justify-between flex felx-row">
                          <div></div>
                          <Context
                            maxTokens={agent.maxContextLength || 0}
                            usedTokens={tokenCounts.totalTokens}
                            usage={{
                              inputTokens: tokenCounts.inputTokens,
                              outputTokens: tokenCounts.outputTokens,
                              totalTokens: tokenCounts.totalTokens,
                              cachedInputTokens: tokenCounts.cachedInputTokens,
                              reasoningTokens: tokenCounts.reasoningTokens,
                            }}>
                            <ContextTrigger />
                            <ContextContent>
                              <ContextContentHeader />
                              <ContextContentBody>
                                {/* @ts-ignore */}
                                <ContextInputUsage />
                                {/* @ts-ignore */}
                                <ContextOutputUsage />
                                {/* @ts-ignore */}
                                <ContextReasoningUsage />
                                {/* @ts-ignore */}
                                <ContextCacheUsage />
                              </ContextContentBody>
                            </ContextContent>
                          </Context>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{Intl.NumberFormat('en-US').format(tokenCounts.totalTokens)} / {Intl.NumberFormat('en-US').format(agent.maxContextLength)} tokens in the context window used.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              }
              {messages?.length === 0 ?
                <div className="size-full flex justify-center items-center">
                  <div className="flex flex-col gap-4 items-center max-w-2xl w-full px-4 my-auto">
                    <Image
                      src={configContext?.backend + "/logo.png"}
                      alt="AI"
                      width={120}
                      height={120}
                      className="h-30 w-40 object-contain" /*invert dark:invert-0*/
                    />
                    <p className="text-center text-lg text-muted-foreground">
                      How can I help you today?
                    </p>

                    {/* Workflow Banner for new users */}
                    <Card className="w-full mb-6">
                      <CardHeader className="text-center">
                        <CardTitle className="flex items-center justify-center gap-2">
                          <Workflow className="w-5 h-5" />
                          Create Reusable Workflows
                        </CardTitle>
                        <CardDescription>
                          Turn your conversations into templates that can be reused with different inputs. Perfect for recurring tasks and processes.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          className="text-muted-foreground"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Save as Workflow
                          <span className="ml-2 text-xs">(Available after chatting)</span>
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div> : null}
                {/* @ts-ignore */}
              <ConversationContent className="px-6">
                {messages?.length > 0 ?
                  <>
                    {messages?.map((message, messageIndex) => {
                      const isFirstMessage =
                        messageIndex === 0;
                      const messageMetadata = message.metadata as any;
                      const isLastMessage =
                        messageIndex === messages.length - 1;

                      return (
                        <Message className={cn(isFirstMessage && 'mt-12')} from={message.role} key={message.id}>
                          <MessageContent>
                            {message.parts.map((part, i) => {
                              if (part.type === 'step-start') {
                                // show step boundaries as horizontal lines:
                                /* return messageIndex > 0 ? (
                                  <div key={messageIndex} className="text-gray-500">
                                    <hr className="my-2 border-gray-300" />
                                  </div>
                                ) : null; */
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

                              if (part.type === 'tool-askForConfirmation') {
                                const callId = part.toolCallId;

                                switch (part.state) {
                                  case 'input-streaming':
                                    return (
                                      <div key={callId}>Loading confirmation request...</div>
                                    );
                                  case 'input-available':
                                    return (
                                      <div key={callId}>
                                        {(part.input as { message: string }).message}
                                        <div>
                                          <button
                                            onClick={() =>
                                              addToolResult({
                                                tool: 'askForConfirmation',
                                                toolCallId: callId,
                                                output: 'Yes, confirmed.',
                                              })
                                            }
                                          >
                                            Yes
                                          </button>
                                          <button
                                            onClick={() =>
                                              addToolResult({
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
                                    );
                                  case 'output-available':
                                    return (
                                      <div key={callId}>
                                        Tool call allowed: {part.output as string}
                                      </div>
                                    );
                                  case 'output-error':
                                    return <div key={callId}>Error: {part.errorText}</div>;
                                }
                              }

                              if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
                                const untypedToolPart = part as DynamicToolUIPart;
                                const callId = untypedToolPart.toolCallId;
                                return <UntypedToolPart
                                  untypedToolPart={untypedToolPart}
                                  callId={callId}
                                  addToContext={(item) => {
                                    setItems([...(items || []), item])
                                  }}
                                />
                              }

                              if (part.type === 'file') {
                                if (part.mediaType.startsWith('image/')) {
                                  return <Image src={part.url} width={300} height={300} alt={"Generated image"} />
                                }
                              }

                              if (part.type === 'source-url') {
                                return <Sources>
                                  <SourcesTrigger
                                    count={message.parts.filter(
                                      (part) => part.type === 'source-url'
                                    ).length}
                                  />
                                  <SourcesContent key={`${message.id}`}>
                                    {message.parts.map((part, i) => {
                                      switch (part.type) {
                                        case 'source-url':
                                          return (<Source
                                            key={`${message.id}-${i}`}
                                            href={part.url}
                                            title={part.title}
                                          />)
                                      }
                                    })}
                                  </SourcesContent>
                                </Sources>
                              }
                              if (part.type === 'reasoning') {
                                return <Reasoning
                                  key={`${message.id}-${i}`}
                                  className="w-full"
                                  isStreaming={status === 'streaming'}
                                >
                                  <ReasoningTrigger />
                                  <ReasoningContent>{part.text}</ReasoningContent>
                                </Reasoning>

                              }
                              return null;
                            })}
                            {message.role === 'assistant' && (
                              <Actions className="mt-2">
                                <Action
                                  onClick={() => regenerate()}
                                  label="Retry"
                                  disabled={!writeAccess}
                                >
                                  <RefreshCcwIcon className="size-3" />
                                </Action>
                                <Action
                                  onClick={() => {
                                    navigator.clipboard.writeText(message.parts.map((part: any) => part?.text || "").join('\n'))
                                    toast({
                                      title: "Copied message",
                                      description: "The message was copied to your clipboard.",
                                    });
                                  }}
                                  label="Copy"
                                >
                                  <CopyIcon className="size-3" />
                                </Action>
                                {messageMetadata?.totalTokens && (
                                  <small className="text-muted-foreground">{Intl.NumberFormat('en-US').format(messageMetadata?.totalTokens)} tokens</small>
                                )}
                              </Actions>
                            )}
                          </MessageContent>
                        </Message>
                      )
                    })}
                  </>
                  : null}

                {status === "streaming" ? <Loader /> : null}

              </ConversationContent>
            </Conversation>
            {
              !writeAccess && (
                <div className="px-6 mx-auto mt-3">
                  <Badge variant="outline">Read access only</Badge>
                </div>
              )
            }
            {error && (
              <div className="mx-5">
                <Alert className="mb-3" variant="destructive">
                  <ExclamationTriangleIcon className="size-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    {error}
                  </AlertDescription>
                </Alert>
              </div>
            )}
            {writeAccess && (
              <form
                onSubmit={onSubmit}
                className="px-6 border-input border rounded flex mx-5 p-5 flex-col gap-2">
                <div className="items-center flex relative gap-2 w-full">
                  <UppyDashboard
                    id={`chat-${session.id}`}
                    allowedFileTypes={[
                      ...agent.capabilities?.audio || [],
                      ...agent.capabilities?.video || [],
                      ...agent.capabilities?.files || [],
                      ...agent.capabilities?.images || [],
                    ]}
                    dependencies={[]}
                    onConfirm={(items) => {
                      setItems(items)
                    }}
                  />
                  <TextareaAutosize
                    autoComplete="off"
                    autoFocus={true}
                    minRows={1}
                    value={input}
                    ref={inputRef}
                    onKeyDown={handleKeyPress}
                    onChange={(e) => setInput(e.target.value)}
                    name="message"
                    placeholder={`Ask me anything...`}
                    className="max-h-40 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 w-full items-center h-28 resize-none overflow-hidden dark:bg-card/35"
                  />
                  {status !== "streaming" ? (
                    <Button
                      className="shrink-0"
                      variant="secondary"
                      size="icon"
                      disabled={status === "submitted" || !input?.trim()}
                    >
                      <ArrowUp className=" size-6 text-muted-foreground" />
                    </Button>
                  ) : (
                    <Button
                      className="shrink-0"
                      variant="secondary"
                      size="icon"
                      onClick={stop}
                    >
                      <StopIcon className="size-6 text-muted-foreground" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {/* Show  selected files */}
                  {items?.map((item) => (
                    <FileItem context="files_default_context" item={item} disabled={true} active={false} onRemove={() => {
                      setItems(items?.filter((i) => i.s3key !== item.s3key))
                    }} />
                  ))}
                </div>
              </form>
            )}
            {/* Save Workflow Modal */}
            <SaveWorkflowModal
              isOpen={showSaveWorkflowModal}
              onClose={() => setShowSaveWorkflowModal(false)}
              messages={messages || []}
              sessionTitle={session.title}
            />
          </div>

          {/* Agent Details Sidebar */}
          {writeAccess && (
            <div className="w-80 border-l bg-muted/20 p-4 space-y-4">
              <div>
                <div>
                  {agent.image ? (
                    <img
                      src={agent.image}
                      alt={`${agent.name} agent`}
                      className="w-[100px] h-[100px] object-cover rounded-full mx-auto my-3"
                    />
                  ) : (
                    <div className="text-3xl font-bold text-primary text-center">
                      {agent.name?.charAt(0).toUpperCase() || 'A'}
                    </div>
                  )}
                  <p className="text-sm font-medium text-center">{agent.name}</p>
                </div>
                {agent.description && (
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    {agent.description}
                  </p>
                )}
              </div>
              <hr className="my-2" />
              <div className="mt-1">
                <div className="border rounded">
                  {
                    creatorQuery.loading && (
                      <div className="flex flex-row justify-between p-3">
                        <p className="text-sm font-medium">Session created by</p>
                        <Loading className="ml-2" />
                      </div>
                    )
                  }
                  {creatorQuery.data?.userById && !creatorQuery.loading && (
                    <div className="flex flex-row justify-between p-3">
                      <p className="text-sm font-medium">Session created by</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <p className="text-sm font-medium capitalize">{creatorQuery.data.userById.name}</p>
                        <img src={creatorQuery.data.userById.image} alt={creatorQuery.data.userById.name} className="w-4 h-4 rounded-full" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground pt-2">
                  You can disable tools for individual messages in this session by clicking the switch:</p>
                <TooltipProvider>
                  <div className="space-y-1 pt-2">
                    {agent.tools && agent.tools.length > 0 ? (
                      agent.tools.map((tool) => {
                        const isEnabled = !disabledTools.includes(tool.id);
                        return (
                          <Tooltip key={tool.name}>
                            <TooltipTrigger asChild>
                              <div className="p-2 rounded-md border text-xs bg-background flex items-center justify-between">
                                <p className="font-medium flex items-center gap-2">
                                  {tool.name}
                                </p>
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={() => toggleTool(tool.id)}
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-[200px] text-wrap">{tool.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })
                    ) : (
                      <p className="text-xs text-muted-foreground">No tools enabled.</p>
                    )}
                  </div>
                </TooltipProvider>
              </div>
              <div className="mt-1">
                <Collapsible className="border rounded">
                  <CardHeader className="px-3 py-1">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <p className="text-sm font-medium">
                          Access control ({session.rights_mode})
                        </p>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <ChevronsUpDown className="size-4" />
                          <span className="sr-only">Toggle</span>
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 p-3">
                      <RBACControl
                        allowedModes={['private', 'users', 'roles', 'projects']}
                        initialRightsMode={session.rights_mode}
                        initialUsers={session.RBAC?.users}
                        initialRoles={session.RBAC?.roles}
                        initialProjects={session.RBAC?.projects}
                        onChange={(rights_mode, users, roles, projects) => {
                          setRbac({
                            rights_mode,
                            users,
                            roles,
                            projects
                          })
                        }}
                      />
                      <Button disabled={updateAgentSessionRbacResult.loading} onClick={() => {
                        updateAgentSessionRbac({
                          variables: {
                            id: session.id,
                            rights_mode: rbac.rights_mode,
                            RBAC: {
                              users: rbac.users,
                              roles: rbac.roles,
                              projects: rbac.projects
                            }
                          }
                        })
                      }}>Save access rights {updateAgentSessionRbacResult.loading && <Loading className="ml-2" />} </Button>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


const UntypedToolPart = ({ untypedToolPart, callId, addToContext }: { untypedToolPart: DynamicToolUIPart, callId: string, addToContext: (item: Item) => void }) => {

  const output = untypedToolPart.output as any;
  console.log("output", output)
  // Replace - and _, replace 'tool-' prefix
  let styleToolName = untypedToolPart.type?.replace(/ /g, "-")
  styleToolName = styleToolName?.replace(/tool-/g, "")
  styleToolName = styleToolName?.replace(/_/g, " ")
  styleToolName = styleToolName?.charAt(0).toUpperCase() + styleToolName?.slice(1)

  return <Tool key={callId} className="mt-3" defaultOpen={false}>
    <ToolHeader className="capitalize" type={styleToolName as `tool-${string}`} state={untypedToolPart.state} />
    <ToolContent>
      <ToolInput input={untypedToolPart.input} />
      {
        output?.items?.length ? <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 px-4 pb-4">
          {output.items.map((item) => <FileItem addToContext={(item) => {
            addToContext(item)
          }} context="outputs_default_context" item={item} disabled={true} active={false} />)}
        </div> :
          <ToolOutput
            output={
              output ?
                <Response>
                  {typeof output === 'string' ?
                    output : JSON.stringify(output, null, 2)
                  }
                </Response>
                : !untypedToolPart.errorText && <Skeleton className="h-4 w-full" />
            }
            errorText={untypedToolPart.errorText}
          />
      }
    </ToolContent>
  </Tool>
}