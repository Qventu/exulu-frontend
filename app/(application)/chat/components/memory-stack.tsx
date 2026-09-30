"use client";

import type { ChatAddToolApproveResponseFunction, DynamicToolUIPart } from "ai";
import { Bookmark } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import type { Agent } from "@/types/models/agent";

import { DECLINED_REASON, encodeMemoryDecision, type MemoryDecision } from "./memory-card-data";
import { MemoryCard } from "./memory-card";

type Registry = { register: (toolCallId: string, read: () => MemoryDecision) => void; unregister: (toolCallId: string) => void };
const EditsContext = React.createContext<Registry | null>(null);
export const useMemoryEdits = () => React.useContext(EditsContext);

/** Consecutive remember cards under one "Save all" bar (spec §4.1). */
export function MemoryStack({ parts, agent, addToolApprovalResponse }: { parts: DynamicToolUIPart[]; agent: Agent; addToolApprovalResponse: ChatAddToolApproveResponseFunction }) {
  const t = useTranslations("chat");
  const readers = React.useRef(new Map<string, () => MemoryDecision>());
  const registry = React.useMemo<Registry>(() => ({
    register: (id, read) => { readers.current.set(id, read); },
    unregister: (id) => { readers.current.delete(id); },
  }), []);

  const decideAll = (approved: boolean) => {
    for (const part of parts) {
      const approvalId = (part as { approval?: { id?: string } }).approval?.id;
      if (!approvalId) continue;
      const read = readers.current.get(part.toolCallId);
      addToolApprovalResponse({ id: approvalId, approved, reason: approved && read ? encodeMemoryDecision(read()) : DECLINED_REASON });
    }
  };

  return (
    <EditsContext.Provider value={registry}>
      <div className="mt-3 rounded-lg border border-border p-3" data-demo-id="chat-memory-stack">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium"><Bookmark className="size-4 text-muted-foreground" aria-hidden="true" />{t("memory.stackTitle")}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => decideAll(false)}>{t("memory.dontSave")}</Button>
            <Button size="sm" onClick={() => decideAll(true)}>{t("memory.saveAll", { count: parts.length })}</Button>
          </div>
        </div>
        {parts.map((part) => <MemoryCard key={part.toolCallId} part={part} agent={agent} addToolApprovalResponse={addToolApprovalResponse} inStack />)}
      </div>
    </EditsContext.Provider>
  );
}
