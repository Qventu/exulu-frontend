"use client"

import { useQuery } from "@apollo/client";
import { ChatRequestOptions } from "ai";
import { useChat } from "ai/react";
import * as React from "react";
import { FormEvent, useContext, useEffect, useState } from "react";
import { UserContext } from "@/app/(application)/authenticated";
import ChatBottombar from "@/app/(application)/playground/[agent]/chat/components/chat-bottombar";
import ChatList from "@/app/(application)/playground/[agent]/chat/components//chat-list";
import { AgentMessage, AgentSession } from "@EXULU_SHARED/models/agent-session";
import {
  GET_AGENT_MESSAGES, GET_AGENT_SESSION,
  GET_AGENT_SESSIONS,
} from "@/queries/queries";
import { Message } from "ai/react";
import { auth } from "@/util/api"
import { Agent } from "@EXULU_SHARED/models/agent";

// assistant ui
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import { TooltipProvider } from "@/components/ui/tooltip";


export interface ChatProps {
  chatId?: string;
  agentId?: string;
  messages?: Message[];
  input?: string;
  handleInputChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
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

  const [isMobile, setIsMobile] = useState(false);
  const [files, setFiles] = useState<any[] | null>(null);
  const { user, setUser } = useContext(UserContext);
  
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
    agentSessionOne: AgentSession;
  }>(GET_AGENT_SESSION, {
    returnPartialData: true,
    fetchPolicy: "network-only",
    nextFetchPolicy: "network-only",
    variables: {
      filter: {
        id
      },
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
        setMessages(data?.agentMessagePagination.items);
      }
    },
  });

  console.log("[EXULU] messages query", messagesQuery)

  const runtime = useChatRuntime({
    api: `${process.env.NEXT_PUBLIC_BACKEND}${agent.slug}/${agent.id}`,
    body: {
      threadId: sessionQuery?.data?.agentSessionOne?.id,
      resourceId: user.id,
    },
    headers: {
      Authorization: `Bearer ${token}`,
      Session: localStorage.getItem("session") ?? "",
      Stream: "true"
    }
  });

  return (
    <TooltipProvider>
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="grid w-full h-full gap-x-2 px-4 py-4">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
    </TooltipProvider>
  );

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
    setMessages,
  } = useChat({
    api: `${process.env.NEXT_PUBLIC_BACKEND}${agent.slug}/${agent.id}`,
    streamProtocol: "text",
    headers: {
      Authorization: localStorage.getItem("token") ?? "",
      Session: localStorage.getItem("session") ?? "",
      Stream: "true"
    },
    body: {
      threadId: sessionQuery?.data?.agentSessionOne?.id,
      resourceId: user.id,
    },
    onResponse: (data) => {
      // todo reset files after sending
      console.log("RESPONSE", data)
    },
  });

  const onFilesSelected = (files: any[]) => {
    setFiles(files);
  };

  const onSubmit = async (
    e: FormEvent<HTMLFormElement>,
    options?: ChatRequestOptions,
  ) => {
    e.preventDefault();
    setMessages([...messages]);

    // todo secure the /token api
    const response = await auth.token()
    const { token } = await response.json()

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
      },
      options: {
        body: {
          threadId: sessionQuery?.data?.agentSessionOne?.id,
          resourceId: user.id,
          stream: true,
        },
      },
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

        {!sessionQuery.loading && sessionQuery.data?.agentSessionOne && (
          <>
            <ChatList
              agentId={sessionQuery.data?.agentSessionOne.agentId}
              messages={messages}
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={onSubmit}
              isLoading={isLoading}
              error={error}
              stop={stop}
            />
            <ChatBottombar
              agentId={sessionQuery.data?.agentSessionOne.agentId}
              messages={messages}
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={onSubmit}
              isLoading={isLoading}
              error={error}
              stop={stop}
              onFilesSelected={onFilesSelected}
            />
          </>
        )}
      </div>
    </>
  );
}
