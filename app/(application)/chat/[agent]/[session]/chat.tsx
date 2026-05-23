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
import { ChatAddToolApproveResponseFunction, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';
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
  GET_MODELS_LITE,
} from "@/queries/queries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getToken } from "@/util/api"
import { Agent } from "@EXULU_SHARED/models/agent";
import { ConfigContext } from "@/components/config-context";
import { ArrowUp, FileText, Form, Plus, Share2, Copy, Check, Sparkles, FolderOpen } from "lucide-react";
import { SessionFilesPanel } from "@/components/session-files/session-files-panel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { SaveWorkflowModal } from "@/components/save-workflow-modal";
import { Button } from "@/components/ui/button";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { RBACControl } from "@/components/rbac";
import { useToast } from "@/components/ui/use-toast";
import { Loading } from "@/components/ui/loading";
import { Badge } from "@/components/ui/badge";
import { checkChatSessionWriteAccess } from "@/lib/check-chat-session-write-access";
import { FileItem, getPresignedUrl } from "@/components/uppy-dashboard";
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
import { PromptLibrary } from "@/types/models/prompt-library";
import { useIncrementPromptUsage } from "@/hooks/use-prompts";
import { Project } from "@/types/models/project";
import { useSearchParams } from "next/navigation";
import { ToolCallApproval } from "@/components/tool-call-approval";
import { ItemsSelectionModal } from "@/components/items-selection-modal";
import { SessionItemBadge } from "@/components/project-details";
import { SavePresetModal } from "@/components/save-preset-modal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Wrench } from "lucide-react";
import { Switch } from "@/components/ui/switch";
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
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [input, setInput] = useState('');
  const [disabledTools, setDisabledTools] = useState<string[]>([]);
  // Per-request model override. When set (and different from agent.model),
  // the chat client sends X-Exulu-Model-Override on each request.
  const [modelOverride, setModelOverride] = useState<string | null>(null);
  const modelOverrideRef = React.useRef<string | null>(null);
  useEffect(() => {
    modelOverrideRef.current = modelOverride;
  }, [modelOverride]);
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

  const managedContextEnabled = useMemo(() => {
    return agent.tools?.find((tool) => tool.id === "agentic_context_search")?.config.find((c) => c.name === "managed_context")?.variable === "true" ||
      // @ts-ignore
      agent.tools?.find((tool) => tool.id === "agentic_context_search")?.config.find((c) => c.name === "managed_context")?.variable === true;
  }, [agent.tools]);

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
  const [incrementPromptUsage] = useIncrementPromptUsage();
  const [writeAccess, setWriteAccess] = useState<boolean>(currentSession ? checkChatSessionWriteAccess(currentSession, user) : true);
  const [rbac, setRbac] = useState({
    rights_mode: currentSession?.rights_mode || 'private',
    users: currentSession?.RBAC?.users || [],
    roles: currentSession?.RBAC?.roles || [],
    // projects: currentSession?.RBAC?.projects || []
  })
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  // Session files side panel. Open/closed state is persisted in localStorage
  // so it survives page reloads. Default-closed; user opens it explicitly
  // via the header toggle. Read on mount to avoid SSR/CSR mismatch.
  const [sessionFilesPanelOpen, setSessionFilesPanelOpen] = useState(false);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("chat.sessionFilesPanel.open");
      if (stored === "true") setSessionFilesPanelOpen(true);
    } catch {
      // localStorage can throw in private browsing / SSR; default-closed is fine.
    }
  }, []);

  const toggleSessionFilesPanel = async () => {

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

    setSessionFilesPanelOpen((curr) => {
      const next = !curr;
      try {
        window.localStorage.setItem("chat.sessionFilesPanel.open", String(next));
      } catch { }
      return next;
    });
  };

  const creatorQuery = useQuery(GET_USER_BY_ID, {
    variables: { id: currentSession?.created_by },
    skip: !currentSession?.created_by
  })

  // Load models the current user has access to, for the per-request override dropdown.
  const modelsQuery = useQuery(GET_MODELS_LITE, {
    variables: { page: 1, limit: 100 },
    fetchPolicy: "cache-and-network",
  });
  const availableModels: { id: string; name: string; provider: string; active: boolean }[] =
    modelsQuery.data?.modelsPagination?.items ?? [];

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
        } else if (promptSelectorOpen) {
          setPromptSelectorOpen(false);
        } else if (showSaveWorkflowModal) {
          setShowSaveWorkflowModal(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [feedbackModal, promptSelectorOpen, showSaveWorkflowModal]);

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
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
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
        const override = modelOverrideRef.current;
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
            Stream: "true",
            ...(override && override !== agent.model
              ? { "X-Exulu-Model-Override": override }
              : {}),
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
  const handleSelectPrompt = (prompt: PromptLibrary, filledContent: string) => {
    insertPromptIntoChat(filledContent);
    incrementPromptUsage({
      variables: {
        id: prompt.id,
        usage_count: (prompt.usage_count || 0) + 1,
      },
    });
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
      handleSelectPrompt(prompt, prompt.content);
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
    // Resizable layout: the chat column is the left panel, the session
    // files panel (when open) is the right one. Drag the handle to set
    // the split. When the files panel is closed the handle + right panel
    // are unmounted and the chat takes 100%. Persistence of the split
    // across reloads can be added later via onLayoutChange + localStorage.
    <div className="h-full w-full">
      <ResizablePanelGroup
        orientation="horizontal"
        className="h-full w-full"
      >
        <ResizablePanel
          defaultSize="70%"
          minSize="40%"
          id="chat-main"
          className="flex flex-col"
        >
          {/* Main conversation area */}
          <div className="grow flex flex-col flex-1 relative h-[100vh] overflow-hidden min-w-0">
            {/* Animated gradient at top - moved outside Conversation to prevent scroll interference */}

            {agent.maxContextLength ? (
              <div className={`absolute w-full top-0 z-10 pointer-events-none bg-white dark:bg-black`}>
                <Progress className="w-full rounded-none pointer-events-auto" value={tokenCounts.totalTokens / agent.maxContextLength * 100} />
              </div>
            ) : null}
            {/* Context/token counter - moved outside Conversation to prevent scroll interference */}
            <div className={`flex justify-between absolute left-0 right-0 items-center px-4 py-2 border-b z-10 dark:bg-black bg-white ${agent.maxContextLength ? 'top-4' : 'top-0'}`}>
              <div className="flex items-center gap-4">
                <Select
                  value={modelOverride ?? agent.model ?? ""}
                  onValueChange={(v) => {
                    setModelOverride(!v || v === agent.model ? null : v);
                  }}
                  disabled={availableModels.length === 0}
                >
                  <SelectTrigger className="h-7 w-auto min-w-[160px] text-xs">
                    <SelectValue
                      placeholder={agent.modelName || "Select model"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No models available
                      </SelectItem>
                    ) : (
                      availableModels
                        .filter((m) => m.active)
                        .map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {m.provider}
                              </span>
                              <span>{m.name}</span>
                              {m.id === agent.model && (
                                <span className="text-[10px] text-muted-foreground">
                                  (default)
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Form className="w-4 h-4" />
                  Turn this conversation into a reusable template
                </div>
              </div>
              <div className="flex items-center gap-2">
                {writeAccess && currentSession && (
                  <Popover open={sharePopoverOpen} onOpenChange={setSharePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" aria-label="Share this session">
                        <Share2 className="w-4 h-4 mr-2" aria-hidden="true" />
                        Share
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-96 p-4 space-y-4" align="end">
                      <div>
                        <p className="text-sm font-medium mb-1.5">Session link</p>
                        <small className="text-xs text-muted-foreground">
                          Created by {creatorQuery.data?.userById?.email}
                        </small>
                        <div className="flex items-center gap-2">
                          <input
                            readOnly
                            value={typeof window !== "undefined" ? window.location.href : ""}
                            className="flex-1 text-xs bg-muted rounded px-2.5 py-1.5 border border-border text-muted-foreground truncate outline-none"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText(window.location.href);
                              setUrlCopied(true);
                              setTimeout(() => setUrlCopied(false), 2000);
                            }}
                          >
                            {urlCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="border-t pt-4 space-y-3">
                        <p className="text-sm font-medium">Access control</p>
                        <RBACControl
                          allowedModes={['private', 'users', 'roles']}
                          initialRightsMode={currentSession.rights_mode}
                          initialUsers={currentSession.RBAC?.users}
                          initialRoles={currentSession.RBAC?.roles}
                          onChange={(rights_mode, users, roles) => {
                            setRbac({ rights_mode, users, roles });
                          }}
                        />
                        <Button
                          className="w-full"
                          disabled={updateAgentSessionRbacResult.loading}
                          onClick={() => {
                            updateAgentSessionRbac({
                              variables: {
                                id: currentSession.id,
                                rights_mode: rbac.rights_mode,
                                RBAC: {
                                  users: rbac.users,
                                  roles: rbac.roles,
                                },
                              },
                            });
                          }}
                        >
                          Save access rights {updateAgentSessionRbacResult.loading && <Loading className="ml-2" />}
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canCreateWorkflow}
                  onClick={() => setShowSaveWorkflowModal(true)}
                  aria-label="Save conversation as reusable template">
                  <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                  Save as Routine
                </Button>
              </div>
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
                    onQuestionAnswer={(_questionId, _answerId, answerText) => {
                      const approvedTools = localStorage.getItem(`pre-approved-tool-calls-${currentSession?.id}`) || [];
                      sendMessage(
                        { text: "[answer:" + answerText + "]", files: [] },
                        { body: { disabledTools, approvedTools } },
                      );
                    }}
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
              <div className="w-[850px] mx-auto">
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
                    <div className="relative gap-2 w-[850px] bg-card/35 p-3 rounded-lg border border-border">
                      <div className="flex relative gap-2 w-full">
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
                          className="max-h-40 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 w-full items-center h-28 resize-none overflow-hidden bg-card/35 mb-3"
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
                      {/* ── Badges row: pinned scope + tool toggles ───────────── */}
                      <div className="flex flex-wrap items-center gap-1.5 w-full">
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          className="shrink-0 h-7 text-left"
                          onClick={async () => await toggleSessionFilesPanel()}
                          aria-label="Toggle session files panel"
                        >
                          <FolderOpen className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                          Files
                        </Button>
                        <Button type="button" variant="ghost" className="shrink-0 h-7 text-left" onClick={() => setPromptSelectorOpen(true)} aria-label="Insert prompt from library">
                          <FileText className="h-3.5 w-3.5 mr-2" /> Prompts
                        </Button>


                        {/* Add specific items */}
                        <ItemsSelectionModal
                          onConfirm={async (data) => {
                            let sessionToUse = currentSession;
                            if (currentSession?.id === "new" || !currentSession) {
                              const createdSession = await createSession();
                              if (!createdSession) {
                                toast({ title: "Error", description: "Failed to create session. Please try again.", variant: "destructive" });
                                return;
                              }
                              sessionToUse = createdSession;
                            }
                            const update = [...(sessionItems || []), ...data.map((x) => `${x.context.id}/${x.item.id}`)];
                            updateAgentSessionItems({ variables: { id: sessionToUse?.id, session_items: update } });
                            setSessionItems(update);
                          }}
                          onSelectContext={async (context) => {
                            let sessionToUse = currentSession;
                            if (currentSession?.id === "new" || !currentSession) {
                              const createdSession = await createSession();
                              if (!createdSession) {
                                toast({ title: "Error", description: "Failed to create session. Please try again.", variant: "destructive" });
                                return;
                              }
                              sessionToUse = createdSession;
                            }
                            const gid = context.id;
                            if (sessionItems?.includes(gid)) return;
                            const update = [...(sessionItems || []), gid];
                            updateAgentSessionItems({ variables: { id: sessionToUse?.id, session_items: update } });
                            setSessionItems(update);
                          }}
                          onApplyPreset={async (items) => {
                            let sessionToUse = currentSession;
                            if (currentSession?.id === "new" || !currentSession) {
                              const createdSession = await createSession();
                              if (!createdSession) {
                                toast({ title: "Error", description: "Failed to create session. Please try again.", variant: "destructive" });
                                return;
                              }
                              sessionToUse = createdSession;
                            }
                            // Merge with existing items (remove duplicates)
                            const existingItems = new Set(sessionItems || []);
                            const newItems = items.filter(item => !existingItems.has(item));
                            const update = [...(sessionItems || []), ...newItems];
                            updateAgentSessionItems({ variables: { id: sessionToUse?.id, session_items: update } });
                            setSessionItems(update);
                          }}
                          buttonText="Context"
                          tooltipText="Add specific knowledge contexts or items to this chat."
                          buttonType="button"
                          buttonVariant="ghost"
                          buttonSize="sm"
                          buttonClassName="h-7 shrink-0 text-left"
                          iconClassName="h-3.5 w-3.5 mr-1"
                        />

                        {/* Capabilities buttons (Skills + Tools) — open a popover with
                            on/off toggles. Replaces the per-item pill list that used to
                            sit in this row. A small count badge inside the button shows
                            how many items the user has disabled in that category. The
                            button is hidden entirely when the agent has zero items of
                            that kind so we don't show an empty popover. */}
                        {agent.skills && agent.skills.length > 0 && (
                          <CapabilityPopover
                            label="Skills"
                            icon={Sparkles}
                            items={agent.skills}
                            disabledTools={disabledTools}
                            toggleTool={toggleTool}
                            setDisabledTools={setDisabledTools}
                            kind="skill"
                          />
                        )}

                        {agent.tools && agent.tools.length > 0 && (
                          <CapabilityPopover
                            label="Tools"
                            icon={Wrench}
                            items={agent.tools}
                            disabledTools={disabledTools}
                            toggleTool={toggleTool}
                            setDisabledTools={setDisabledTools}
                            kind="tool"
                          />
                        )}

                        {/* Separator between capability buttons and pinned session items. */}
                        {sessionItems && sessionItems.length > 0 && ((agent.tools && agent.tools.length > 0) || (agent.skills && agent.skills.length > 0)) && (
                          <span className="w-px h-4 bg-border mx-0.5" aria-hidden="true" />
                        )}

                        {/* Pinned contexts / items — amber */}
                        {sessionItems?.map((gid) => (
                          <SessionItemBadge
                            key={gid}
                            gid={gid}
                            onRemove={async (removedGid) => {
                              const update = sessionItems.filter((i) => i !== removedGid);
                              let sessionToUse = currentSession;
                              if (currentSession?.id === "new" || !currentSession) {
                                const createdSession = await createSession();
                                if (!createdSession) {
                                  toast({ title: "Error", description: "Failed to create session. Please try again.", variant: "destructive" });
                                  return;
                                }
                                sessionToUse = createdSession;
                              }
                              updateAgentSessionItems({ variables: { id: sessionToUse?.id, session_items: update } });
                              setSessionItems(update);
                            }}
                          />
                        ))}

                        {/* Save current selection as preset */}
                        {sessionItems && sessionItems.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowSavePresetModal(true)}
                            className="h-7 rounded-full text-xs"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Save context preset
                          </Button>
                        )}
                        
                      </div>

                      {/* Managed context notice */}
                      {managedContextEnabled && (
                        <div className="flex items-center gap-3 w-[850px] mx-auto rounded-md px-3 py-2 text-sm">
                          <span className="w-2 h-2 rounded-full bg-gray-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-gray-900 dark:text-gray-300">Managed context</span>
                            <span className="text-gray-700 dark:text-gray-400 ml-1.5">— agent will only search contexts and items you add to this session.</span>
                          </div>
                        </div>
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
                  </div>


                  {/* Attached files (in-progress upload attachments) */}
                  {fileItems && fileItems.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 w-[850px] mx-auto">
                      {fileItems.map((item) => (
                        <FileItem key={item} s3Key={item} disabled={true} active={false} onRemove={() => {
                          setFileItems(fileItems.filter((i) => i !== item));
                        }} />
                      ))}
                    </div>
                  )}
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

            {/* Save Preset Modal */}
            <SavePresetModal
              isOpen={showSavePresetModal}
              onClose={() => setShowSavePresetModal(false)}
              currentItems={sessionItems || []}
            />
          </div>
        </ResizablePanel>
        {sessionFilesPanelOpen && currentSession?.id && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel
              defaultSize="30%"
              minSize="20%"
              maxSize="60%"
              id="chat-files"
            >
              <SessionFilesPanel
                sessionId={currentSession.id}
                onClose={async () => await toggleSessionFilesPanel()}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div >
  );
}

/**
 * Header-row button that opens a popover listing a category of agent
 * capabilities (Skills or Tools), each with an on/off switch. Replaces the
 * inline pill list that used to render every item permanently. A count
 * badge inside the button shows how many items in the category are
 * currently disabled, so the user can tell at a glance that they've turned
 * something off without opening the popover.
 *
 * Wired to the existing `disabledTools` array + `toggleTool` handler — no
 * new state. The set of disabled ids is shared between Skills and Tools
 * because `disabledTools` mixes both at the data layer; that's a pre-
 * existing decision we're keeping for now.
 */
const CapabilityPopover = ({
  label,
  icon: Icon,
  items,
  disabledTools,
  toggleTool,
  setDisabledTools,
  kind,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Array<{ id: string; name: string }>;
  disabledTools: string[];
  toggleTool: (id: string) => void;
  setDisabledTools: React.Dispatch<React.SetStateAction<string[]>>;
  kind: "skill" | "tool";
}) => {
  const disabledCount = items.filter((i) => disabledTools.includes(i.id)).length;
  const allDisabled = disabledCount === items.length;
  const itemIds = items.map((i) => i.id);

  const handleEnableAll = () => {
    setDisabledTools((prev) => prev.filter((id) => !itemIds.includes(id)));
  };
  const handleDisableAll = () => {
    setDisabledTools((prev) => Array.from(new Set([...prev, ...itemIds])));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 h-7 text-left"
          aria-label={`Toggle ${label.toLowerCase()}`}
        >
          <Icon className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
          {label}
          {disabledCount > 0 && (
            <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-[10px] leading-none">
              {disabledCount} off
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <button
            type="button"
            onClick={allDisabled ? handleEnableAll : handleDisableAll}
            className="text-[11px] text-primary hover:underline"
          >
            {allDisabled ? "Enable all" : "Disable all"}
          </button>
        </div>
        <div className="max-h-80 overflow-auto py-1">
          {items.map((item) => {
            const isEnabled = !disabledTools.includes(item.id);
            return (
              <label
                key={item.id}
                className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className={`inline-flex items-center justify-center h-5 w-5 rounded-full shrink-0 ${
                      isEnabled
                        ? kind === "skill"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                  </span>
                  <span className="text-sm capitalize truncate">
                    {item.name.replace(/_/g, " ")}
                  </span>
                </span>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={() => toggleTool(item.id)}
                  aria-label={`${isEnabled ? "Disable" : "Enable"} ${item.name}`}
                />
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};


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