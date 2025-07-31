"use client"

import { useQuery } from "@apollo/client";
import { ChatRequestOptions } from "ai";
import { useChat, Message } from '@ai-sdk/react';
import * as React from "react";
import { FormEvent, useContext, useEffect, useState } from "react";
import { UserContext } from "@/app/(application)/authenticated";
import ChatBottombar from "@/app/(application)/playground/[agent]/chat/components/chat-bottombar";
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
  const { user, setUser } = useContext(UserContext);

  const bottomRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
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

  useEffect(() => {
    scrollToBottom();
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

  const onSubmit = async (
    e: FormEvent<HTMLFormElement>,
    options?: ChatRequestOptions,
  ) => {
    e.preventDefault();
    setMessages([...messages]);

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
                <div className="flex flex-col gap-4 items-center">
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
                                            <React.Fragment key={index}>{part}</React.Fragment>
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

                                      console.log("!!part!!", part);
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
                                            <div>
                                              <h4 className="text-sm font-medium mb-2">Result:</h4>
                                              <div className="bg-background rounded border p-3">
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
                                            </div>
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
      </div>
    </>
  );
}
