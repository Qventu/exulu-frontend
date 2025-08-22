"use client"

import { useQuery } from "@apollo/client";
import { ChatRequestOptions, DefaultChatTransport, UIMessage } from "ai";
import { useChat } from '@ai-sdk/react';
import * as React from "react";
import { FormEvent, useContext, useEffect, useState, useMemo } from "react";
import { UserContext } from "@/app/(application)/authenticated";
import { PaperPlaneIcon, StopIcon } from "@radix-ui/react-icons";
import { AgentMessage, AgentSession } from "@EXULU_SHARED/models/agent-session";
import { Message, MessageContent } from '@/components/ai-elements/message';
import { Actions, Action } from '@/components/ai-elements/actions';
import { Loader } from '@/components/ai-elements/loader';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input';
import TextareaAutosize from "react-textarea-autosize";
import {
  GET_AGENT_MESSAGES,
  GET_AGENT_SESSION_BY_ID,
  GET_AGENT_SESSIONS,
} from "@/queries/queries";
import { getToken } from "@/util/api"
import { Agent } from "@EXULU_SHARED/models/agent";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import CodeDisplayBlock from "@/components/custom/code-display-block";
import { ConfigContext } from "@/components/config-context";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Copy, Check, Workflow, Plus, RefreshCcwIcon, CopyIcon, ArrowUp } from "lucide-react";
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useToast } from "@/components/ui/use-toast"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SaveWorkflowModal } from "@/components/save-workflow-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";
import { Response } from '@/components/ai-elements/response';
import { threadId } from "worker_threads";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/source";

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

export function ChatLayout({ session: id, type, agent, token }: { session: string | null, type: string | null, agent: Agent, token: string }) {

  const configContext = React.useContext(ConfigContext);
  const [isMobile, setIsMobile] = useState(false);
  const [files, setFiles] = useState<any[] | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const { user, setUser } = useContext(UserContext);
  const [copyingTableId, setCopyingTableId] = useState<string | null>(null);
  const [showSaveWorkflowModal, setShowSaveWorkflowModal] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast()

  console.log("[EXULU] agent", agent)

  useEffect(() => {
    const checkScreenWidth = () => {
      setIsMobile(window.innerWidth <= 1023);
    };

    // Initial check
    checkScreenWidth();

    // Event listener for screen width changes
    window.addEventListener("resize", checkScreenWidth);

    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener("resize", checkScreenWidth);
    };
  }, []);


  const sessionQuery = useQuery<{
    agent_sessionById: AgentSession;
  }>(GET_AGENT_SESSION_BY_ID, {
    returnPartialData: true,
    fetchPolicy: "network-only",
    nextFetchPolicy: "network-only",
    variables: {
      id: id
    },
  });

  const messagesQuery = useQuery<{
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
          eq: id
        }
      },
    },
    onCompleted: (data) => {
      console.log("messages", data?.agent_messagesPagination.items)
      if (data?.agent_messagesPagination) {
        console.log("messages", data?.agent_messagesPagination.items)
        const messages = data?.agent_messagesPagination.items.map((item) => (JSON.parse(item.content)))
        setMessages(messages as any[]);
      }
    },
  });

  console.log("[EXULU] messages query", messagesQuery)
  console.log("[EXULU] session query", sessionQuery.data)

  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
    regenerate,
    setMessages,
    addToolResult
  } = useChat({
    transport: new DefaultChatTransport({
      api: `${configContext?.backend}${agent.slug}/${agent.id}`,
      // only send the last message to the server: we load
      // the history from the database.
      prepareSendMessagesRequest: async ({ messages, id: chatId }) => {
        const token = await getToken()
        console.log("token", token)
        if (!token) {
          throw new Error("No valid session token available.")
        }
        return {
          body: {
            message: messages[messages.length - 1],
            id: chatId,
            session: id
          }, headers: {
            User: user.id,
            Session: id,
            Authorization: `Bearer ${token}`,
            Stream: "true"
          }
        };
      },
    })
  });

  // Check if conversation has enough content for a workflow
  const canCreateWorkflow = useMemo(() => {
    const userMessages = messages?.filter(m => m.role === 'user') || [];
    const assistantMessages = messages?.filter(m => m.role === 'assistant') || [];
    return userMessages.length >= 1 && assistantMessages.length >= 1;
  }, [messages]);

  console.log("ChatList render - messages:", messages);
  console.log("ChatList render - messages length:", messages?.length);

  // Debug messages
  console.log("Current messages:", messages);
  console.log("Messages length:", messages?.length);

  useEffect(() => {
    console.log("Messages changed:", messages);
    console.log("Messages array:", JSON.stringify(messages, null, 2));
  }, [messages]);

  const onFilesSelected = (files: any[]) => {
    setFiles(files);
  };

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
      console.error('Failed to copy table:', err);
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
    });
    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  return (
    <div className="flex flex-col w-full">


      <div className="mx-auto relative size-full pb-6">

        <div className="flex flex-col h-full w-full">
          {!sessionQuery.loading && sessionQuery.data?.agent_sessionById && (
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
              {messages?.length === 0 ?
                <div className="size-full flex justify-center items-center">
                  <div className="flex flex-col gap-4 items-center max-w-2xl w-full px-4 my-auto">
                    <Image
                      src="/exulu_logo.svg"
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
              <ConversationContent className="px-6">
                {messages?.length > 0 ?
                  <>
                    {messages?.map((message, messageIndex) => {
                      const isFirstMessage =
                        messageIndex === 0;
                      return (
                        <Message className={cn(isFirstMessage && 'mt-10')} from={message.role} key={message.id}>
                          <MessageContent>
                            {message.parts.map((part, i) => {
                              switch (part.type) {
                                case 'source-url':
                                  <Sources>
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
                                case 'text':
                                  const isLastMessage =
                                    messageIndex === messages.length - 1;
                                  return (
                                    <div key={`${message.id}-${i}`}>
                                      <Response>
                                        {part.text}
                                      </Response>
                                      {message.role === 'assistant' && isLastMessage && (
                                        <Actions className="mt-2">
                                          <Action
                                            onClick={() => regenerate()}
                                            label="Retry"
                                          >
                                            <RefreshCcwIcon className="size-3" />
                                          </Action>
                                          <Action
                                            onClick={() =>
                                              navigator.clipboard.writeText(part.text)
                                            }
                                            label="Copy"
                                          >
                                            <CopyIcon className="size-3" />
                                          </Action>
                                        </Actions>
                                      )}
                                    </div>
                                  );
                                case 'reasoning':
                                  return (
                                    <Reasoning
                                      key={`${message.id}-${i}`}
                                      className="w-full"
                                      isStreaming={status === 'streaming'}
                                    >
                                      <ReasoningTrigger />
                                      <ReasoningContent>{part.text}</ReasoningContent>
                                    </Reasoning>
                                  );
                                default:
                                  return null;
                              }
                            })}
                          </MessageContent>
                        </Message>
                      )
                    })}
                  </>
                  : null}

                {status === "streaming" ? <Loader /> : null}

              </ConversationContent>
            </Conversation>
          )}
          {sessionQuery.loading && <div className="size-full flex justify-center items-center"><Loader /></div>}
          <form
            onSubmit={onSubmit}
            className="w-full items-center flex relative gap-2 px-6"
          >
            {/*{agent?.extensions?.length ? (
              <div className="flex">
                <FileUpload
                  splice={10}
                  onSelect={(file) => {
                    setFile(file);
                    onFilesSelected([file]);
                  }}
                  extensions={agent?.extensions}
                  collection={"files"}
                  metaData={{
                    userEmail: user.email,
                    userId: user.id,
                    query: [],
                  }}
                />
              </div>
            ) : null}*/}
            <TextareaAutosize
              autoComplete="off"
              autoFocus={true}
              value={input}
              ref={inputRef}
              onKeyDown={handleKeyPress}
              onChange={(e) => setInput(e.target.value)}
              name="message"
              placeholder={`Ask me anything...`}
              className="border-input max-h-20 px-5 py-4 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 w-full border rounded flex items-center h-14 resize-none overflow-hidden dark:bg-card/35"
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
          </form>
          {/* Save Workflow Modal */}
          <SaveWorkflowModal
            isOpen={showSaveWorkflowModal}
            onClose={() => setShowSaveWorkflowModal(false)}
            messages={messages || []}
            sessionTitle={sessionQuery.data?.agent_sessionById?.title}
          />
        </div>
      </div>
    </div>
  );
}
