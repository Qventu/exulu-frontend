"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMutation, useQuery } from "@apollo/client";
import { ChatRequestOptions, DefaultChatTransport, DynamicToolUIPart, FileUIPart, UIMessage } from "ai";
import { useChat } from '@ai-sdk/react';
import * as React from "react";
import { useContext, useEffect, useState, useMemo } from "react";
import { UserContext } from "@/app/(application)/authenticated";
import { StopIcon } from "@radix-ui/react-icons";
import { AgentSession } from "@EXULU_SHARED/models/agent-session";
import { ChatAddToolApproveResponseFunction, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import TextareaAutosize from "react-textarea-autosize";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  GET_USER_BY_ID,
  UPDATE_AGENT_SESSION_RBAC,
  GET_PROMPT_BY_ID,
  GET_PROJECT_BY_ID,
  CREATE_AGENT_SESSION,
  GET_AGENT_SESSIONS,
  UPDATE_AGENT_SESSION_ITEMS,
  CREATE_FEEDBACK,
} from "@/queries/queries";
import { getToken } from "@/util/api"
import { Agent } from "@EXULU_SHARED/models/agent";
import { ConfigContext } from "@/components/config-context";
import { ArrowUp, ChevronsUpDown, FileText, Form, Plus } from "lucide-react";
import { SaveWorkflowModal } from "@/components/save-workflow-modal";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CardContent, CardHeader } from "@/components/ui/card";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { RBACControl } from "@/components/rbac";
import { useToast } from "@/components/ui/use-toast";
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
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextCacheUsage,
} from '@/components/ai-elements/context';
import { Progress } from "@/components/ui/progress";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
  ToolInput,
} from '@/components/ai-elements/tool';
import { Skeleton } from "@/components/ui/skeleton";
import { MessageRenderer } from "@/components/message-renderer";
import { Response } from '@/components/ai-elements/response';
import AgentVisual from "@/components/lottie";
import Logo from "@/components/logo";
import { PromptSelectorModal } from "./components/prompt-selector-modal";
import { PromptVariableForm } from "./components/prompt-variable-form";
import { PromptLibrary } from "@/types/models/prompt-library";
import { extractVariables, fillPromptVariables } from "@/lib/prompts";
import { useIncrementPromptUsage } from "@/hooks/use-prompts";
import { Project } from "@/types/models/project";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ToolCallApproval } from "@/components/tool-call-approval";
import { ItemsSelectionModal } from "@/components/items-selection-modal";
import { SessionItem } from "@/components/project-details";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Wrench } from "lucide-react";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function ChatLayout({
  session,
  agent,
  initialMessages,
}: {
  session: AgentSession | null;
  agent: Agent;
  initialMessages: UIMessage[];
}) {

  const [error, setError] = useState<string | null>(null);
  const configContext = React.useContext(ConfigContext);
  const [files, setFiles] = useState<FileUIPart[] | null>(null);
  const [fileItems, setFileItems] = useState<string[] | null>(null);
  const { toast } = useToast();
  const [sessionItems, setSessionItems] = useState<string[] | null>(session?.session_items || null);
  const { user } = useContext(UserContext);
  const [showSaveWorkflowModal, setShowSaveWorkflowModal] = useState(false);
  const [input, setInput] = useState('');
  const [disabledTools, setDisabledTools] = useState<string[]>([]);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  // Calculate max input length as 80% of agent's context window (rough char estimate: 1 token ≈ 4 chars)
  const MAX_INPUT_LENGTH = agent.maxContextLength ? Math.floor((agent.maxContextLength * 0.8) * 4) : 50000;
  const [currentSession, setCurrentSession] = useState<AgentSession | null>(session);
  const [createAgentSession] = useMutation(CREATE_AGENT_SESSION, {
    refetchQueries: [
      GET_AGENT_SESSIONS,
      "GetAgentSessions",
      GET_USER_BY_ID,
      "GetUserById"
    ],
  });
  const currentSessionRef = React.useRef<AgentSession | null>(session);

  // Keep ref in sync with state
  React.useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  // Reset current session when the session prop changes (e.g., navigating to /new)
  React.useEffect(() => {
    setCurrentSession(session);
    setWriteAccess(session ? checkChatSessionWriteAccess(session, user) : true);
    if (session) {
      setRbac({
        rights_mode: session.rights_mode || 'private',
        users: session.RBAC?.users || [],
        roles: session.RBAC?.roles || [],
      });
    }
  }, [session, user]);

  const searchParams = useSearchParams();
  const initialPromptId = searchParams.get("promptId");

  // Prompt selector state
  const [promptSelectorOpen, setPromptSelectorOpen] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<{
    session: string;
    agent: string;
    score: number;
  } | null>(null);
  const [feedbackDescription, setFeedbackDescription] = useState("");
  const [promptVariableFormOpen, setPromptVariableFormOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptLibrary | null>(null);
  const [incrementPromptUsage] = useIncrementPromptUsage();

  const [writeAccess, setWriteAccess] = useState<boolean>(currentSession ? checkChatSessionWriteAccess(currentSession, user) : true);
  const [toolsSheetOpen, setToolsSheetOpen] = useState(false);

  const [rbac, setRbac] = useState({
    rights_mode: currentSession?.rights_mode || 'private',
    users: currentSession?.RBAC?.users || [],
    roles: currentSession?.RBAC?.roles || [],
    // projects: currentSession?.RBAC?.projects || []
  })

  const creatorQuery = useQuery(GET_USER_BY_ID, {
    variables: { id: currentSession?.created_by },
    skip: !currentSession?.created_by
  })

  const projectQuery = useQuery<{
    projectById: Project;
  }>(GET_PROJECT_BY_ID, {
    variables: { id: currentSession?.project },
    skip: !currentSession?.project
  })

  // Fetch initial prompt if provided
  const { data: initialPromptData } = useQuery<{
    prompt_library_itemById: PromptLibrary;
  }>(GET_PROMPT_BY_ID, {
    variables: { id: initialPromptId },
    skip: !initialPromptId,
  });

  // Track if we've already processed the initial prompt
  const [initialPromptProcessed, setInitialPromptProcessed] = useState(false);

  const [updateAgentSessionRbac, updateAgentSessionRbacResult] = useMutation(UPDATE_AGENT_SESSION_RBAC);
  const [updateAgentSessionItems, updateAgentSessionItemsResult] = useMutation(UPDATE_AGENT_SESSION_ITEMS);
  const [createFeedback, createFeedbackResult] = useMutation(CREATE_FEEDBACK);


  // Global keyboard navigation
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Close modals/sheets in priority order
        if (feedbackModal) {
          setFeedbackModal(null);
          setFeedbackDescription("");
        } else if (promptVariableFormOpen) {
          setPromptVariableFormOpen(false);
        } else if (promptSelectorOpen) {
          setPromptSelectorOpen(false);
        } else if (toolsSheetOpen) {
          setToolsSheetOpen(false);
        } else if (showSaveWorkflowModal) {
          setShowSaveWorkflowModal(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [feedbackModal, promptVariableFormOpen, promptSelectorOpen, toolsSheetOpen, showSaveWorkflowModal]);


  const [tokenCounts, setTokenCounts] = useState<MessageMetadata>({
    totalTokens: 0,
    reasoningTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0
  });
  const {
    messages,
    sendMessage,
    status,
    stop,
    regenerate,
    setMessages,
    addToolApprovalResponse
  } = useChat({
    messages: initialMessages,
    sendAutomaticallyWhen: ({ messages: currentMessages }) => {
      const lastMessage = currentMessages.at(-1);
      const shouldContinue =
        lastMessage?.parts?.some(
          (part) =>
            "state" in part &&
            part.state === "approval-responded" &&
            "approval" in part &&
            (part.approval as { approved?: boolean })?.approved === true
        ) ?? false;
      return shouldContinue;
    },
    // Throttle the messages and data updates to 50ms:
    experimental_throttle: 50,
    async onToolCall({ toolCall }) {
      // Check if it's a dynamic tool first for proper type narrowing
      if (toolCall.dynamic) {
        return;
      }
    },
    onError: (error) => {
      if (process.env.NODE_ENV === 'development') {
        console.error("[Chat Error]", error?.message);
      }
      try {
        const { message } = JSON.parse(error?.message)
        setError(message)
      } catch (x) {
        setError(error?.message || "An unexpected error occurred. Please try again.")
      }
    },
    onData: (data) => {
      if (process.env.NODE_ENV === 'development') {
        console.log("[Chat Data]", data);
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
        const session = currentSessionRef.current;
        if (!session) {
          throw new Error("No session available.")
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

  // Prompt selector handlers
  const handleSelectPrompt = (prompt: PromptLibrary) => {
    const variables = extractVariables(prompt.content);

    if (variables.length > 0) {
      // Prompt has variables, show form
      setSelectedPrompt(prompt);
      setPromptVariableFormOpen(true);
    } else {
      // No variables, insert directly
      insertPromptIntoChat(prompt.content);

      // Increment usage count
      incrementPromptUsage({
        variables: {
          id: prompt.id,
          usage_count: (prompt.usage_count || 0) + 1,
        },
      });
    }
  };

  const createSession = async () => {
    try {
      const result = await createAgentSession({
        variables: {
          agent: agent.id,
          user: user.id,
          title: input.substring(0, 50), // Use first 50 chars of message as title
          rights_mode: 'private',
          RBAC: {
            users: [],
            roles: [],
          }
        }
      });

      if (result.data?.agent_sessionsCreateOne?.item) {
        const newSession = result.data.agent_sessionsCreateOne.item as AgentSession;
        newSession.created_by = user.id;
        setCurrentSession(newSession);
        setWriteAccess(true);

        // Update URL quietly without triggering Next.js routing
        window.history.replaceState(null, '', `/chat/${agent.id}/${newSession.id}`);

        return newSession;
      } else {
        setError("Failed to create session. Please try again.");
        return;
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Failed to create session:", error);
      }
      const errorMessage = error instanceof Error ? error.message : "Failed to create session. Please check your connection and try again.";
      setError(errorMessage);
      toast({
        title: "Session Creation Failed",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }
  }

  const handleSubmitVariables = (values: Record<string, string>) => {
    if (!selectedPrompt) return;

    const filledPrompt = fillPromptVariables(selectedPrompt.content, values);
    insertPromptIntoChat(filledPrompt);

    // Increment usage count
    incrementPromptUsage({
      variables: {
        id: selectedPrompt.id,
        usage_count: (selectedPrompt.usage_count || 0) + 1,
      },
    });

    setPromptVariableFormOpen(false);
    setSelectedPrompt(null);
  };

  const insertPromptIntoChat = (promptText: string) => {
    // Append to existing input or replace if empty
    setInput((prev) => (prev ? `${prev}\n\n${promptText}` : promptText));

    // Focus the input
    inputRef.current?.focus();
  };

  // Handle initial prompt auto-fill when navigating from empty state
  useEffect(() => {
    if (initialPromptData?.prompt_library_itemById && !initialPromptProcessed) {
      const prompt = initialPromptData.prompt_library_itemById;
      setInitialPromptProcessed(true);
      handleSelectPrompt(prompt);
    }
  }, [initialPromptData, initialPromptProcessed]);

  const onSubmit = async (
    e: React.FormEvent,
    options?: ChatRequestOptions,
  ) => {
    e.preventDefault();

    let sessionToUse = currentSession;

    // If there's no session, create one first
    if (!sessionToUse) {
      const createdSession = await createSession();
      if (!createdSession) {
        toast({
          title: "Error",
          description: "Failed to create session. Please try again.",
          variant: "destructive",
        });
        return;
      }
      sessionToUse = createdSession;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log("[EXULU] Current session", currentSession);
    }
    const approvedTools = localStorage.getItem(`pre-approved-tool-calls-${currentSession?.id}`) || [];

    if (process.env.NODE_ENV === 'development') {
      console.log("[EXULU] Approved tools", approvedTools);
    }

    sendMessage({
      text: input,
      files: files || []
    }, {
      body: {
        disabledTools: disabledTools,
        approvedTools: approvedTools
      },
    });
    setInput('');
    setFiles(null);
    setFileItems(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Prevent submission if already submitting or empty
      if (status !== "submitted" && status !== "streaming" && input?.trim()) {
        onSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
    if (e.key === "Escape") {
      // Clear input on Escape
      if (input) {
        setInput('');
        e.preventDefault();
      }
    }
  };

  const toggleTool = (id: string) => {
    setDisabledTools(prev =>
      prev.includes(id)
        ? prev.filter(name => name !== id)
        : [...prev, id]
    );
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackModal) return;

    try {
      await createFeedback({
        variables: {
          input: {
            session: feedbackModal.session,
            score: feedbackModal.score,
            agent: feedbackModal.agent,
            description: feedbackDescription,
            user: user.id,
          },
        },
      });

      toast({
        title: "Feedback submitted",
        description: "Thank you for your feedback!",
      });

      setFeedbackModal(null);
      setFeedbackDescription("");
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Failed to submit feedback:", error);
      }
      toast({
        title: "Error submitting feedback",
        description: error instanceof Error ? error.message : "Failed to submit feedback. Please check your connection and try again.",
        variant: "destructive",
      });
    }
  };

  // Calculate number of active tools
  const activeToolsCount = useMemo(() => {
    return (agent.tools?.length || 0) - disabledTools.length;
  }, [agent.tools, disabledTools]);

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
    if (!fileItems) {
      setFiles(null)
      return;
    }
    updateMessageFiles(fileItems.map(item => ({
      s3key: item,
      name: item,
      type: "file"
    })))
  }, [fileItems])

  return (
    <div className="h-full w-full">
      {/* Main conversation area */}
      <div className="grow flex flex-col flex-1 relative h-[100vh] overflow-hidden">
        {/* Animated gradient at top - moved outside Conversation to prevent scroll interference */}

        {agent.maxContextLength ? (
          <div className={`absolute w-full top-0 z-10 pointer-events-none bg-white dark:bg-black`}>
            <Progress className="w-full rounded-none pointer-events-auto" value={tokenCounts.totalTokens / agent.maxContextLength * 100} />
          </div>
        ) : null}
        {/* Context/token counter - moved outside Conversation to prevent scroll interference */}
        <div className={`flex justify-between absolute left-0 right-0 items-center px-4 py-2 border-b z-10 dark:bg-black bg-white ${agent.maxContextLength ? 'top-4' : 'top-0'}`}>
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-xs">
              {agent.modelName}
            </Badge>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Form className="w-4 h-4" />
              Turn this conversation into a reusable template
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!canCreateWorkflow}
            onClick={() => setShowSaveWorkflowModal(true)}
            aria-label="Save conversation as reusable template">
            <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
            Save as Template
          </Button>
        </div>

        {agent.maxContextLength ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`absolute w-full top-0 z-10`}>
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
        ) : null}
        {/* @ts-ignore */}
        <Conversation>
          {messages?.length === 0 ?
            <div className="size-full flex justify-center items-center overflow-y-hidden">
              <div className="flex flex-col gap-4 items-center max-w-2xl w-full px-4 my-auto">
                <Logo alt="Logo" width={120} height={120} className="h-30 w-40 object-contain" />
                {
                  !agent.welcomemessage && (
                    <p className="text-center text-lg text-muted-foreground">
                      How can I help you today?
                    </p>
                  )
                }

                <AgentVisual agent={agent} status={status} className="w-80" />
                {
                  agent.welcomemessage && (
                    <Message
                      className="mt-12"
                      from="assistant"
                      key="welcome-message"
                    >
                      <MessageContent id={"message_id_welcome_message"}>
                        <Response className="chat-response-container">{agent.welcomemessage}</Response></MessageContent></Message>
                  )
                }
              </div>
            </div> : null}
          {/* @ts-ignore */}
          <ConversationContent className="px-6 max-w-[850px] mx-auto">
            {messages?.length > 0 ? (
              <MessageRenderer
                handleFeedback={(messageId: string, feedback: 'positive' | 'negative') => {
                  if (process.env.NODE_ENV === 'development') {
                    console.log("Feedback submitted -", "messageId:", messageId, "feedback:", feedback);
                  }
                  setFeedbackModal({
                    session: currentSession?.id || '',
                    agent: agent.id,
                    score: feedback === 'positive' ? 1 : 0,
                  })
                }}
                addToolApprovalResponse={addToolApprovalResponse}
                messages={messages}
                showTokens={true}
                config={{
                  marginTopFirstMessage: 'mt-20'
                }}
                status={status}
                onRegenerate={regenerate}
                UntypedToolPartComponent={UntypedToolPart}
                AgentVisualComponent={AgentVisual}
                agent={agent}
                addToContext={(item) => {
                  setFileItems([...(fileItems || []), item])
                }}
                writeAccess={writeAccess}
              />
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
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
          <>
            <form
              onSubmit={onSubmit}
              className="px-6 border-input flex mx-5 p-5 flex-col gap-2 mb-2">
              <div className="items-center flex flex-col relative gap-2 w-full">
                <div className="flex relative gap-2 w-[850px]">
                  <TextareaAutosize
                    autoComplete="off"
                    autoFocus={true}
                    minRows={1}
                    maxLength={MAX_INPUT_LENGTH}
                    value={input}
                    ref={inputRef}
                    onKeyDown={handleKeyPress}
                    onChange={(e) => setInput(e.target.value)}
                    name="message"
                    placeholder={`Ask me anything...`}
                    className="border max-h-40 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 w-full items-center h-28 resize-none overflow-hidden bg-card/35"
                    aria-label="Chat message input"
                    aria-describedby={input.length > MAX_INPUT_LENGTH * 0.9 ? "input-length-warning" : undefined}
                  />
                  {status !== "streaming" ? (
                    <Button
                      className="shrink-0"
                      variant="secondary"
                      size="icon"
                      type="submit"
                      disabled={status === "submitted" || !input?.trim()}
                      aria-label="Send message"
                    >
                      <ArrowUp className=" size-6 text-muted-foreground" />
                    </Button>
                  ) : (
                    <Button
                      className="shrink-0"
                      variant="secondary"
                      size="icon"
                      type="button"
                      onClick={stop}
                      aria-label="Stop generating response"
                    >
                      <StopIcon className="size-6 text-muted-foreground" />
                    </Button>
                  )}
                </div>
                {/* Character count warning when approaching limit */}
                {input.length > MAX_INPUT_LENGTH * 0.9 && (
                  <div id="input-length-warning" className="text-xs text-muted-foreground w-[850px] flex justify-end" role="status" aria-live="polite">
                    {input.length} / {MAX_INPUT_LENGTH} characters
                    {input.length >= MAX_INPUT_LENGTH && (
                      <span className="text-destructive ml-2">Maximum length reached</span>
                    )}
                  </div>
                )}
                <div className="items-center flex relative gap-2 w-[850px]">
                  {/* {
                  configContext?.fileUploads?.s3endpoint && (<UppyDashboard
                    id={`chat-${currentSession?.id || 'new'}`}
                    selectionLimit={10}
                    allowedFileTypes={[
                      ...agent.capabilities?.audio || [],
                      ...agent.capabilities?.video || [],
                      ...agent.capabilities?.files || [],
                      ...agent.capabilities?.images || [],
                    ]}
                    dependencies={[]}
                    onConfirm={(items) => {
                      setFileItems(items)
                    }}
                  />)
                } */}

                  {/* Select or add items to knowledge bases */}
                   <ItemsSelectionModal onConfirm={async (data) => {
                    console.log("data", data)
                    let sessionToUse = currentSession;
                    // Call update session mutation to add the item to the session
                    if (currentSession?.id === "new" || !currentSession) {
                      // Create the session first
                      const createdSession = await createSession();
                      if (!createdSession) {
                        toast({
                          title: "Error",
                          description: "Failed to create session. Please try again.",
                          variant: "destructive",
                        });
                        return;
                      }
                      sessionToUse = createdSession;
                    }
                    const update = [...(sessionItems || []), ...data.map((x) => `${x.context.id}/${x.item.id}`)];
                    updateAgentSessionItems({
                      variables: {
                        id: sessionToUse?.id,
                        session_items: update
                      }
                    })
                    setSessionItems(update);
                  }} buttonText="" tooltipText="Select or create items from/for knowledge sources to add to the chat." />

                  {/* Tools button */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0 relative"
                          onClick={() => setToolsSheetOpen(true)}
                          aria-label={`Configure tools (${activeToolsCount} active)`}
                        >
                          <Wrench className="h-4 w-4" />
                          {activeToolsCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center" aria-hidden="true">
                              {activeToolsCount}
                            </span>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{activeToolsCount} {activeToolsCount === 1 ? 'tool' : 'tools'} active</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          onClick={() => setPromptSelectorOpen(true)}
                          aria-label="Insert prompt from library"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Insert prompt from library</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 w-[850px] mx-auto">
                {/* Show  selected files */}
                {fileItems?.map((item) => (
                  <FileItem s3Key={item} disabled={true} active={false} onRemove={() => {
                    setFileItems(fileItems?.filter((i) => i !== item))
                  }} />
                ))}
                {sessionItems?.map((item) => (
                  <SessionItem gid={item} onRemove={async () => {
                    const update = sessionItems?.filter((i) => i !== item);

                    let sessionToUse = currentSession;
                    if (currentSession?.id === "new" || !currentSession) {
                      const createdSession = await createSession();
                      if (!createdSession) {
                        toast({
                          title: "Error",
                          description: "Failed to create session. Please try again.",
                          variant: "destructive",
                        });
                        return;
                      }
                      sessionToUse = createdSession;
                    }

                    updateAgentSessionItems({
                      variables: {
                        id: sessionToUse?.id,
                        session_items: update
                      }
                    })
                    setSessionItems(update)
                  }} />
                ))}
              </div>
            </form>
            {/* Disclaimer text */}
            <p className="text-xs text-center text-muted-foreground mb-5">
              AI can make mistakes. Check important info.
            </p>
          </>
        )}
        {/* Save Workflow Modal */}
        <SaveWorkflowModal
          isOpen={showSaveWorkflowModal}
          onClose={() => setShowSaveWorkflowModal(false)}
          messages={messages || []}
          agentId={agent.id}
          sessionTitle={currentSession?.title || 'New Chat'}
        />

        {/* Prompt Selector Modal */}
        <PromptSelectorModal
          open={promptSelectorOpen}
          onOpenChange={setPromptSelectorOpen}
          onSelectPrompt={handleSelectPrompt}
          agentId={agent.id}
        />

        {/* Prompt Variable Form */}
        {selectedPrompt && (
          <PromptVariableForm
            open={promptVariableFormOpen}
            onOpenChange={setPromptVariableFormOpen}
            variables={extractVariables(selectedPrompt.content)}
            promptName={selectedPrompt.name}
            onSubmit={handleSubmitVariables}
          />
        )}
        {/* Feedback Modal */}
        <Dialog open={!!feedbackModal} onOpenChange={(open) => {
          if (!open) {
            setFeedbackModal(null);
            setFeedbackDescription("");
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {feedbackModal?.score === 1 ? "What did you like?" : "What could be improved?"}
              </DialogTitle>
              <DialogDescription>
                {feedbackModal?.score === 1
                  ? "Let us know what worked well in this response."
                  : "Help us understand what went wrong so we can improve."}
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Enter your feedback here..."
              value={feedbackDescription}
              onChange={(e) => setFeedbackDescription(e.target.value)}
              className="min-h-[100px]"
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setFeedbackModal(null);
                  setFeedbackDescription("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitFeedback}
                disabled={createFeedbackResult.loading || !feedbackDescription.trim()}
              >
                {createFeedbackResult.loading ? "Submitting..." : "Submit Feedback"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Agent Details Sheet */}
        {writeAccess && (
          <Sheet open={toolsSheetOpen} onOpenChange={setToolsSheetOpen}>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{agent.name}</SheetTitle>
                {agent.description && (
                  <SheetDescription>
                    {agent.description?.length > 100 ? agent.description?.substring(0, 100) + "..." : agent.description}
                  </SheetDescription>
                )}
              </SheetHeader>

              <div className="mt-6 space-y-4">
                {
                  messages?.length > 0 && (
                    <div>
                      <AgentVisual agent={agent} status={status} className="w-full" />
                    </div>
                  )
                }

                {currentSession && (
                  <div>
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
                            {creatorQuery.data.userById.name ? <p className="text-sm font-medium capitalize">
                              {creatorQuery.data.userById.name}
                            </p> : <p className="text-sm font-medium">{creatorQuery.data.userById.email}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {currentSession?.project && (
                  <div>
                    <div className="border rounded">
                      {
                        projectQuery.loading && (
                          <div className="flex flex-row justify-between p-3">
                            <p className="text-sm font-medium">This chat is part of a project:</p>
                            <Loading className="ml-2" />
                          </div>
                        )
                      }
                      {projectQuery.data?.projectById && !projectQuery.loading && (
                        <div className="flex flex-col p-3 gap-2">
                          <p className="text-sm font-medium">Project</p>
                          <Link
                            href={`/projects/${currentSession.project}`}
                            className="text-sm text-primary hover:underline"
                          >
                            {projectQuery.data.projectById.name}
                          </Link>
                          {projectQuery.data.projectById.description && (
                            <p className="text-xs text-muted-foreground">
                              {projectQuery.data.projectById.description}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-muted-foreground pb-2">
                    You can disable tools for individual messages in this session by clicking the switch:
                  </p>
                  <TooltipProvider>
                    <div className="space-y-1">
                      {agent.tools && agent.tools.length > 0 ? (
                        agent.tools.map((tool, index) => {
                          const isEnabled = !disabledTools.includes(tool.id);
                          return (
                            <Tooltip key={tool.name + "_" + index}>
                              <TooltipTrigger asChild>
                                <div className="p-2 rounded-md border text-xs bg-background flex items-center justify-between">
                                  <p className="font-medium flex items-center gap-2 capitalize">
                                    {tool.name.replace(/_/g, " ")}
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

                {currentSession && (
                  <div>
                    <Collapsible className="border rounded">
                      <CardHeader className="px-3 py-1">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <p className="text-sm font-medium">
                              Access control ({currentSession.rights_mode || "private"})
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
                            allowedModes={['private', 'users', 'roles']}
                            initialRightsMode={currentSession.rights_mode}
                            initialUsers={currentSession.RBAC?.users}
                            initialRoles={currentSession.RBAC?.roles}
                            // initialProjects={currentSession.RBAC?.projects}
                            onChange={(rights_mode, users, roles) => {
                              setRbac({
                                rights_mode,
                                users,
                                roles,
                                // projects
                              })
                            }}
                          />
                          <Button disabled={updateAgentSessionRbacResult.loading} onClick={() => {
                            updateAgentSessionRbac({
                              variables: {
                                id: currentSession.id,
                                rights_mode: rbac.rights_mode,
                                RBAC: {
                                  users: rbac.users,
                                  roles: rbac.roles,
                                  // projects: rbac.projects
                                }
                              }
                            })
                          }}>Save access rights {updateAgentSessionRbacResult.loading && <Loading className="ml-2" />} </Button>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
}


export const UntypedToolPart = ({
  agent,
  untypedToolPart,
  callId,
  addToContext,
  addToolApprovalResponse
}: {
  agent: Agent,
  untypedToolPart: DynamicToolUIPart,
  callId: string,
  addToContext: (item: string) => void,
  addToolApprovalResponse: ChatAddToolApproveResponseFunction
}) => {

  if (process.env.NODE_ENV === 'development') {
    console.log("Tool Call -", "type:", untypedToolPart.type, "state:", untypedToolPart.state);
  }
  const output = untypedToolPart.output as any;
  // Replace - and _, replace 'tool-' prefix
  let styleToolName = untypedToolPart.type?.replace(/ /g, "-")
  styleToolName = styleToolName?.replace(/tool-/g, "")
  styleToolName = styleToolName?.replace(/_/g, " ")
  styleToolName = styleToolName?.charAt(0).toUpperCase() + styleToolName?.slice(1)

  if (untypedToolPart?.state === 'approval-requested' || untypedToolPart?.state === 'approval-responded') {
    return (
      <ToolCallApproval agent={agent} part={untypedToolPart} addToolApprovalResponse={addToolApprovalResponse} />
    );
  }

  return <Tool key={callId} className="mt-3" defaultOpen={false}>
    <ToolHeader title={styleToolName} className="capitalize" type={styleToolName as `tool-${string}`} state={untypedToolPart.state} />
    <ToolContent>
      <ToolInput input={untypedToolPart.input} />
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
    </ToolContent>
  </Tool >
}