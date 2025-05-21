"use client"
import * as React from "react";
import {
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ChatSessionsComponent } from "./chat-sessions";

export default function ChatLayout({ children, params }: { children: React.ReactNode; params: { agent: string } }) {

  return (
    <>
      <ChatSessionsComponent agent={params.agent} type={"chat"}/>
      {children}
    </>
  );
}
