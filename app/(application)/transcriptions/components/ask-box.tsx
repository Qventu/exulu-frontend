"use client";

/**
 * AskBox — "Ask about this transcript" (task-10 brief, Step 7 / design §4.3).
 *
 * An agent chip opens a picker (agents whose retrieval config already
 * searches the `transcriptions` context first, under "Can search
 * Transcriptions"; every other agent under "Gets this transcript attached to
 * the chat"), a textarea, two suggested questions that fill the input without
 * sending, and a send button that navigates to
 * `/chat/<agentId>?items=transcriptions/<itemId>&q=<question>` — composer.tsx
 * (Step 8) seeds the pin + textarea from those params on mount.
 *
 * Retrieval-config detection reads the bare `tools` JSON scalar (the same
 * field the agent editor's detail query selects, `agents/queries.ts:123` —
 * no GraphQL subfields exist for it) and looks for the
 * `agentic_context_search` tool's `knowledge_bases` entry, whose value is
 * `JSON.stringify(Record<contextId, { enabled }>)` per
 * `agents/edit/[id]/components/knowledge-search/config-schema.ts`
 * (`serializeWizardConfig`, the "13-entry serialisation contract"). This is a
 * light, defensive read of that contract's on-the-wire shape — not an import
 * of the agents feature's code (feature isolation), and any parse failure or
 * shape drift just falls back to "attach only" rather than crashing.
 */
import { useQuery } from "@apollo/client";
import { Bot, ChevronsUpDown, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { GET_TRANSCRIPT_ASK_AGENTS } from "../queries";

export interface AskBoxProps {
  itemId: string;
  /** Two questions that fill the input without sending. */
  suggestions: string[];
}

type AskAgent = { id: string; name: string; tools?: unknown };

const LAST_AGENT_KEY = "transcripts:lastAskAgent";

/** Tolerant parse of the `tools` JSON scalar (string or already-decoded array). */
function parseAgentTools(
  raw: unknown,
): { id?: string; config?: { name?: string; variable?: string }[] }[] {
  if (!raw) return [];
  const value = typeof raw === "string" ? safeJsonParse(raw) : raw;
  return Array.isArray(value) ? value : [];
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** True when the agent's `agentic_context_search` tool includes "transcriptions". */
function searchesTranscripts(rawTools: unknown): boolean {
  const tools = parseAgentTools(rawTools);
  const searchTool = tools.find((tool) => tool?.id === "agentic_context_search");
  const kbEntry = searchTool?.config?.find(
    (entry) => entry?.name === "knowledge_bases",
  );
  if (!kbEntry?.variable) return false;
  const parsed = safeJsonParse(kbEntry.variable) as
    | Record<string, unknown>
    | null;
  const kb = parsed?.transcriptions;
  if (kb == null) return false;
  if (typeof kb === "boolean") return kb;
  if (typeof kb === "object") return (kb as { enabled?: boolean }).enabled !== false;
  return false;
}

export function AskBox({ itemId, suggestions }: AskBoxProps) {
  const t = useTranslations("transcriptions");
  const router = useRouter();
  const [question, setQuestion] = React.useState("");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [agentId, setAgentId] = React.useState<string | null>(null);
  const restoredRef = React.useRef(false);

  const { data } = useQuery<{ agentsPagination: { items: AskAgent[] } }>(
    GET_TRANSCRIPT_ASK_AGENTS,
  );
  const agents = React.useMemo(
    () => data?.agentsPagination?.items ?? [],
    [data],
  );

  const { canSearch, attachOnly } = React.useMemo(() => {
    const canSearchList: AskAgent[] = [];
    const attachOnlyList: AskAgent[] = [];
    for (const agent of agents) {
      (searchesTranscripts(agent.tools) ? canSearchList : attachOnlyList).push(
        agent,
      );
    }
    return { canSearch: canSearchList, attachOnly: attachOnlyList };
  }, [agents]);

  // Restore the last-used agent once, when the list first resolves; default
  // to the first "can search" agent so the picker opens with a sensible pick.
  React.useEffect(() => {
    if (restoredRef.current || agents.length === 0) return;
    restoredRef.current = true;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(LAST_AGENT_KEY);
    } catch {
      // localStorage unavailable — fall through to the default.
    }
    const valid = stored && agents.some((a) => a.id === stored) ? stored : null;
    setAgentId(valid ?? canSearch[0]?.id ?? attachOnly[0]?.id ?? null);
  }, [agents, canSearch, attachOnly]);

  const selectedAgent = agents.find((a) => a.id === agentId) ?? null;

  const selectAgent = (id: string) => {
    setAgentId(id);
    setPickerOpen(false);
    try {
      window.localStorage.setItem(LAST_AGENT_KEY, id);
    } catch {
      // localStorage unavailable — the pick still applies for this visit.
    }
  };

  const canSend = Boolean(agentId) && question.trim().length > 0;

  const send = () => {
    if (!agentId || !question.trim()) return;
    router.push(
      `/chat/${agentId}?items=${encodeURIComponent(`transcriptions/${itemId}`)}&q=${encodeURIComponent(question.trim())}`,
    );
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("askBox.title")}</p>
        <p className="text-xs text-muted-foreground">{t("askBox.explainer")}</p>
      </div>

      {/* One composer surface: the textarea, the agent it will go to, and
          Send belong to the same control. Previously these were three
          separate blocks stacked loosely, which read as unrelated widgets. */}
      <div className="rounded-md border focus-within:ring-1 focus-within:ring-ring">
        <Textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t("askBox.placeholder")}
          rows={3}
          className="min-h-[72px] resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-between gap-2 border-t px-2 py-1.5">
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 max-md:h-11 min-w-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            <Bot aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="max-w-32 truncate">
              {selectedAgent?.name ?? t("askBox.chooseAgent")}
            </span>
            <ChevronsUpDown
              aria-hidden="true"
              className="size-3.5 shrink-0 opacity-50"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command>
            <CommandInput placeholder={t("askBox.searchAgents")} />
            <CommandList>
              <CommandEmpty>{t("askBox.noAgents")}</CommandEmpty>
              {canSearch.length > 0 ? (
                <CommandGroup heading={t("askBox.canSearch")}>
                  {canSearch.map((agent) => (
                    <CommandItem
                      key={agent.id}
                      value={agent.name}
                      onSelect={() => selectAgent(agent.id)}
                    >
                      {agent.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {attachOnly.length > 0 ? (
                <CommandGroup heading={t("askBox.attachOnly")}>
                  {attachOnly.map((agent) => (
                    <CommandItem
                      key={agent.id}
                      value={agent.name}
                      onSelect={() => selectAgent(agent.id)}
                    >
                      {agent.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

          <Button
            type="button"
            size="icon"
            className="size-8 shrink-0 max-md:size-11"
            disabled={!canSend}
            aria-label={t("askBox.send")}
            onClick={send}
          >
            <Send aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>

      {suggestions.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {t("askBox.suggestionsLabel")}
          </p>
          <ul className="space-y-0.5">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  className={cn(
                    "text-left text-sm text-primary hover:underline",
                    "underline-offset-2 max-md:min-h-11",
                  )}
                  onClick={() => setQuestion(suggestion)}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
