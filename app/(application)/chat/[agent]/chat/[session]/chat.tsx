"use client"

import { useQuery } from "@apollo/client";
import { ChatRequestOptions } from "ai";
import { useChat, Message } from '@ai-sdk/react';
import * as React from "react";
import { FormEvent, useContext, useEffect, useState, useMemo } from "react";
import { UserContext } from "@/app/(application)/authenticated";
import ChatBottombar from "@/app/(application)/chat/[agent]/chat/components/chat-bottombar";
import { AgentMessage, AgentSession } from "@EXULU_SHARED/models/agent-session";
import {
  GET_AGENT_MESSAGES,
  GET_AGENT_SESSION_BY_ID,
  GET_AGENT_SESSIONS,
} from "@/queries/queries";
import { getToken } from "@/util/api"
import { Agent } from "@EXULU_SHARED/models/agent";
import Image from "next/image";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import CodeDisplayBlock from "@/components/custom/code-display-block";
import { ConfigContext } from "@/components/config-context";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Copy, Check, Workflow, Plus } from "lucide-react";
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useToast } from "@/components/ui/use-toast"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SaveWorkflowModal } from "@/components/save-workflow-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface ChatProps {
  chatId?: string;
  agentId?: string;
  messages?: Message[];
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
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [copyingTableId, setCopyingTableId] = useState<string | null>(null);
  const [showSaveWorkflowModal, setShowSaveWorkflowModal] = useState(false);
  const { toast } = useToast()

  const bottomRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 5; // More precise detection
    
    setShouldAutoScroll(isAtBottom);
  };


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

  let [search, setSearch]: any = useState({ searchString: null });

  const sessionsQuery = useQuery(GET_AGENT_SESSIONS, {
    returnPartialData: true,
    fetchPolicy: "network-only",
    nextFetchPolicy: "network-only",
    variables: {
      page: 1,
      limit: 40,
    },
  });

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
    agentMessagePagination: {
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
        thread_id: id
      },
    },
    onCompleted: (data) => {
      console.log("messages", data?.agentMessagePagination.items)
      if (data?.agentMessagePagination) {
        console.log("messages", data?.agentMessagePagination.items)
        setMessages(data?.agentMessagePagination.items as any[]);
      }
    },
  });

  console.log("[EXULU] messages query", messagesQuery)
  console.log("[EXULU] session query", sessionQuery.data)

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
    setMessages,
    addToolResult
  } = useChat({
    api: `${configContext?.backend}${agent.slug}/${agent.id}`,
    headers: {
      Authorization: localStorage.getItem("token") ?? "",
      Session: localStorage.getItem("session") ?? "",
      Stream: "true"
    },
    body: {
      threadId: sessionQuery?.data?.agent_sessionById?.id,
      resourceId: user.id,
    }
    // Use the newer streaming protocol that supports tool calls
  });

  // Check if conversation has enough content for a workflow
  const canCreateWorkflow = useMemo(() => {
    const userMessages = messages?.filter(m => m.role === 'user') || [];
    const assistantMessages = messages?.filter(m => m.role === 'assistant') || [];
    return userMessages.length >= 1 && assistantMessages.length >= 1;
  }, [messages]);

  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  }, [messages, shouldAutoScroll]);

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
    e: FormEvent<HTMLFormElement>,
    options?: ChatRequestOptions,
  ) => {
    e.preventDefault();
    setMessages([...messages]);

    // Reset auto-scroll when user sends a new message
    setShouldAutoScroll(true);

    const token = await getToken()

    console.log("token", token)

    if (!token) {
      throw new Error("No valid session token available.")
    }

    // Prepare the options object with additional
    // body data, to pass the model.                
    const requestOptions: ChatRequestOptions = {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Session: localStorage.getItem("session") ?? "",
        Stream: "true"
      }
    };

    handleSubmit(e, requestOptions);
  };

  useEffect(() => {
    let variables: any = {
      page: 1,
      limit: 40,
    };
    if (search && search?.length > 2) {
      variables.filters = { nameSearch: search };
    } else {
      variables.filters = null;
    }
    sessionsQuery.refetch(variables);
  }, [search]);

  return (
    <>
      <div className="relative flex h-full flex-col bg-muted/50 p-4 overflow-y-scroll w-full">
        <div className="flex-1" />

        {!sessionQuery.loading && sessionQuery.data?.agent_sessionById && (
          <>

            {messages?.length === 0 ?
              <div className="size-full flex justify-center items-center">
                <div className="flex flex-col gap-4 items-center max-w-2xl w-full px-4">
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
                </div>
              </div> : <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                id="scroller"
                className="size-full overflow-y-scroll overflow-x-hidden justify-end"
              >
                <div className="w-full flex flex-col overflow-hidden min-h-full justify-end">
                  {messages?.map((message, index) => {
                    const imageRegex = /(https?:\/\/[^\s]+?\.(?:webp|png|jpeg|svg))/gi;
                    const images = message.content?.match(imageRegex) || [];
                    return (
                      <motion.div
                        key={index}
                        layout
                        initial={{ opacity: 0, scale: 1, y: 20, x: 0 }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, scale: 1, y: 20, x: 0 }}
                        transition={{
                          opacity: { duration: 0.1 },
                          layout: {
                            type: "spring",
                            bounce: 0.3,
                            duration: messages.indexOf(message) * 0.05 + 0.2,
                          },
                        }}
                        className={cn(
                          "flex flex-col gap-2 p-4 whitespace-pre-wrap",
                          message?.role === "user" ? "items-end" : "items-start",
                        )}
                      >
                        <div className="flex gap-3 items-center">
                          {message?.role === "user" && (
                            <div className="flex items-end gap-3">
                              <span className="bg-accent p-3 rounded-md max-w-xs sm:max-w-2xl overflow-x-auto">
                                {message.content}
                              </span>
                            </div>
                          )}
                          {(message?.role === "assistant" ||
                            message.role === "system") && (
                              <div className="flex gap-2">
                                <Avatar className="flex justify-start items-center overflow-hidden">
                                  <AvatarImage
                                    src="/exulu_logo.svg"
                                    alt="user"
                                    width={6}
                                    height={6}
                                    className="object-contain invert dark:invert-0"
                                  />
                                  <AvatarFallback>AI</AvatarFallback>
                                </Avatar>
                                <span className="p-3 rounded-md max-w-xs sm:max-w-2xl overflow-x-auto">
                                  {/* Check if the message content contains a code block */}
                                  {message.parts && message.parts.map((part, index) => {
                                    console.log("!!part.type!!", part.type);
                                    if (part.type === 'text') {
                                      return part.text && typeof part.text === 'string' ? part.text.split("```").map((part, index) => {
                                        if (index % 2 === 0) {
                                          return (
                                            <React.Fragment key={index}>
                                              <ReactMarkdown
                                                  remarkPlugins={[remarkGfm]}
                                                  components={{
                                                    table: ({ children, ...props }) => {
                                                      const tableId = `table-${Math.random().toString(36).substr(2, 9)}`;
                                                      const isCopying = copyingTableId === tableId;
                                                      
                                                      return (
                                                        <TooltipProvider>
                                                          <div className="chat-table-wrapper group relative">
                                                            <Tooltip>
                                                              <TooltipTrigger asChild>
                                                                <button
                                                                  onClick={(e) => {
                                                                    e.preventDefault();
                                                                    const tableElement = e.currentTarget.parentElement?.querySelector('table');
                                                                    if (tableElement) {
                                                                      copyTableAsCSV(tableElement, tableId);
                                                                    }
                                                                  }}
                                                                  disabled={isCopying}
                                                                  className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-background border border-border rounded-md p-2 hover:bg-accent hover:text-accent-foreground shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                  {isCopying ? (
                                                                    <Check className="h-4 w-4 text-green-600" />
                                                                  ) : (
                                                                    <Copy className="h-4 w-4" />
                                                                  )}
                                                                </button>
                                                              </TooltipTrigger>
                                                              <TooltipContent>
                                                                <p>Copy as CSV</p>
                                                              </TooltipContent>
                                                            </Tooltip>
                                                            <table className="chat-table" {...props}>
                                                              {children}
                                                            </table>
                                                          </div>
                                                        </TooltipProvider>
                                                      );
                                                    }
                                                  }}
                                              >{part}</ReactMarkdown>
                                            </React.Fragment>
                                          );
                                        } else {
                                          return (
                                            <pre className="whitespace-pre-wrap" key={index}>
                                              <CodeDisplayBlock code={part} lang="" />
                                            </pre>
                                          );
                                        }
                                      }) : null
                                    }
                                    if (part.type === 'file' && part.mimeType.startsWith('image/')) {
                                      return (
                                        <img key={index} src={`data:${part.mimeType};base64,${part.data}`} />
                                      );
                                    }
                                    if (part.type === 'reasoning') {
                                      return <pre key={index}>{
                                        part.details.map(detail => detail.type === 'text' ? detail.text : '<redacted>').join('\n')
                                      }</pre>;
                                    }
                                    if (part.type === 'tool-invocation') {

                                      const callId = part.toolInvocation.toolCallId;

                                      switch (part.toolInvocation.toolName) {
                                        case 'askForConfirmation': {
                                          switch (part.toolInvocation.state) {
                                            case 'call':
                                              return (
                                                <div key={callId}>
                                                  {part.toolInvocation.args.message}
                                                  <div>
                                                    <button
                                                      onClick={() =>
                                                        addToolResult({
                                                          toolCallId: callId,
                                                          result: 'Yes, confirmed.',
                                                        })
                                                      }
                                                    >
                                                      Yes
                                                    </button>
                                                    <button
                                                      onClick={() =>
                                                        addToolResult({
                                                          toolCallId: callId,
                                                          result: 'No, denied',
                                                        })
                                                      }
                                                    >
                                                      No
                                                    </button>
                                                  </div>
                                                </div>
                                              );
                                            case 'result':
                                              return (
                                                <div key={callId}>
                                                  Location access allowed:{' '}
                                                  {part.toolInvocation.result}
                                                </div>
                                              );
                                          }
                                          break;
                                        }
                                      }

                                      return (
                                        <div key={index} className="border rounded-lg p-4 bg-muted/50 mt-2">
                                          <div className="flex items-center gap-2 mb-3">
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                            <span className="font-semibold text-sm">Tool: {part.toolInvocation.toolName}</span>
                                            <span className={cn(
                                              "px-2 py-1 rounded-full text-xs font-medium",
                                              part.toolInvocation.state === 'result'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                            )}>
                                              {part.toolInvocation.state}
                                            </span>
                                          </div>

                                          {part.toolInvocation.args && Object.keys(part.toolInvocation.args).length > 0 && (
                                            <div className="mb-3">
                                              <h4 className="text-sm font-medium mb-2">Arguments:</h4>
                                              <div className="bg-background rounded border p-2">
                                                {Object.entries(part.toolInvocation.args).map(([key, value]) => (
                                                  <div key={key} className="flex gap-2 text-sm">
                                                    <span className="font-mono text-muted-foreground">{key}:</span>
                                                    <span className="font-mono">{JSON.stringify(value)}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {part.toolInvocation.state === 'result' && (
                                            <Collapsible 
                                              open={expandedResults.has(callId)}
                                              onOpenChange={(open) => {
                                                if (open) {
                                                  setExpandedResults(prev => new Set([...Array.from(prev), callId]));
                                                } else {
                                                  setExpandedResults(prev => {
                                                    const newSet = new Set(Array.from(prev));
                                                    newSet.delete(callId);
                                                    return newSet;
                                                  });
                                                }
                                              }}
                                            >
                                              <CollapsibleTrigger asChild>
                                                <div className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors">
                                                  <h4 className="text-sm font-medium">Result:</h4>
                                                  {expandedResults.has(callId) ? (
                                                    <ChevronDown className="h-4 w-4" />
                                                  ) : (
                                                    <ChevronRight className="h-4 w-4" />
                                                  )}
                                                </div>
                                              </CollapsibleTrigger>
                                              <CollapsibleContent>
                                                <div className="bg-background rounded border p-3 mt-2">
                                                  {typeof part.toolInvocation.result === 'object' ? (
                                                    <div className="space-y-2">
                                                      {Object.entries(part.toolInvocation.result).map(([key, value]) => (
                                                        <div key={key} className="flex gap-2 text-sm">
                                                          <span className="font-mono text-muted-foreground min-w-0 shrink-0">{key}:</span>
                                                          <span className="font-mono break-all">{JSON.stringify(value)}</span>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <pre className="text-sm font-mono whitespace-pre-wrap">{JSON.stringify(part.toolInvocation.result, null, 2)}</pre>
                                                  )}
                                                </div>
                                              </CollapsibleContent>
                                            </Collapsible>
                                          )}
                                        </div>
                                      );
                                    }
                                  })
                                  }

                                  {/* {images?.length ?
                          images.map((img) => {
                            return (
                              <Image
                                className="rounded"
                                width={200}
                                height={200}
                                src={img}
                                alt={""}
                              />
                            );
                          }) : null} */}

                                  {isLoading ?
                                    messages.indexOf(message) === messages.length - 1 && (
                                      <span className="animate-pulse" aria-label="Typing">
                                        ...
                                      </span>
                                    ) : null}
                                </span>
                              </div>
                            )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                <div id="anchor" ref={bottomRef}></div>
              </div>
            }
            
            {/* Save as Workflow button - appears when conversation has content */}
            {canCreateWorkflow && (
              <div className="flex justify-between items-center px-4 py-2 border-t bg-muted/20">
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

            <ChatBottombar
              agentId={sessionQuery.data?.agent_sessionById.agentId}
              messages={messages}
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={onSubmit}
              isLoading={isLoading}
              error={error}
              stop={stop}
              onFilesSelected={onFilesSelected} />
          </>
        )}

        {/* Save Workflow Modal */}
        <SaveWorkflowModal
          isOpen={showSaveWorkflowModal}
          onClose={() => setShowSaveWorkflowModal(false)}
          messages={messages || []}
          sessionTitle={sessionQuery.data?.agent_sessionById?.title}
        />
      </div>
    </>
  );
}
