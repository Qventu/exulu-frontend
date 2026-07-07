"use client";

/**
 * State/coordination for the composer's inline "/" and "@" autocomplete
 * (spec 2026-07-07). Owns caret + trigger state, suggestion sources, and the
 * keyboard contract; all matching logic is pure in ./matching.ts. Consumes
 * the controller PROP — never useChatSession (single-instance rule).
 */

import * as React from "react";
import { useLazyQuery } from "@apollo/client";

import { sessionFilesApi, type SessionFile } from "@/lib/api/session-files";
import type { AgentTool } from "@/types/models/agent";

import { GET_CHAT_TOOL_CATALOG, GET_CHAT_SKILL_CATALOG } from "../../queries";
import type { ChatSessionController } from "../../hooks";
import {
  detectTrigger,
  filterSuggestions,
  findTokenRanges,
  insertToken,
  isAutoHidden,
  type Suggestion,
  type TokenRange,
} from "./matching";

const LISTBOX_ID = "composer-autocomplete-listbox";
export const optionId = (index: number) => `composer-autocomplete-option-${index}`;

const prettify = (name: string) => name.replace(/_/g, " ");
const triggerKey = (t: { kind: string; start: number }) => `${t.kind}:${t.start}`;

interface ToolCatalogData {
  tools?: { items?: Array<{ id: string; name: string; description?: string | null }> };
}
interface SkillCatalogData {
  skillsPagination?: {
    items?: Array<{ id: string; name: string; description?: string | null }>;
  };
}

export interface UseComposerAutocompleteArgs {
  controller: ChatSessionController;
  input: string;
  setInput: (value: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export interface ComposerAutocomplete {
  menuOpen: boolean;
  kind: "/" | "@" | null;
  items: Suggestion[];
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  applySuggestion: (item: Suggestion) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
  onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
  tokenRanges: TokenRange[];
  filesStatus: "ready" | "loading" | "error";
  hasAnyFiles: boolean;
  listboxId: string;
  activeOptionId: string | null;
}

export function useComposerAutocomplete({
  controller,
  input,
  setInput,
  inputRef,
}: UseComposerAutocompleteArgs): ComposerAutocomplete {
  const { agent, maxInputLength } = controller;

  // ── Caret tracking ───────────────────────────────────────────────────────
  const [caret, setCaret] = React.useState(0);
  const syncCaret = React.useCallback(() => {
    const el = inputRef.current;
    if (el) setCaret(el.selectionStart ?? 0);
  }, [inputRef]);
  const onSelect = React.useCallback(
    (_e: React.SyntheticEvent<HTMLTextAreaElement>) => syncCaret(),
    [syncCaret],
  );

  // ── Trigger detection ────────────────────────────────────────────────────
  // Legacy agents may store tools as string[] ids (agent-detail-panel.tsx
  // applies the same tolerance).
  const tools = React.useMemo(
    () =>
      ((agent.tools ?? []) as Array<AgentTool | string>).map((t) =>
        typeof t === "string" ? { id: t, name: t } : { id: t.id, name: t.name },
      ),
    [agent.tools],
  );
  const skills = React.useMemo(() => agent.skills ?? [], [agent.skills]);
  const slashEnabled = tools.length > 0 || skills.length > 0;
  const atEnabled = Boolean(agent.sandbox_enabled);

  const trigger = React.useMemo(
    () => detectTrigger(input, caret, { slash: slashEnabled, at: atEnabled }),
    [input, caret, slashEnabled, atEnabled],
  );

  // Escape dismissal is sticky per trigger instance (kind + start index);
  // a new trigger elsewhere gets a fresh key. Stale keys are harmless.
  const [escapedKey, setEscapedKey] = React.useState<string | null>(null);

  // ── "/" source: agent capabilities + lazy description enrichment ─────────
  const [loadToolCatalog, { data: toolCatalog }] =
    useLazyQuery<ToolCatalogData>(GET_CHAT_TOOL_CATALOG, {
      variables: { limit: 200, page: 1 },
    });
  const [loadSkillCatalog, { data: skillCatalog }] =
    useLazyQuery<SkillCatalogData>(GET_CHAT_SKILL_CATALOG, {
      variables: { page: 1, limit: 100 },
    });
  React.useEffect(() => {
    if (trigger?.kind !== "/") return;
    // Enrichment only — catalog failure (or entries beyond the page cap)
    // just means names without descriptions.
    void loadToolCatalog().catch(() => {});
    void loadSkillCatalog().catch(() => {});
  }, [trigger?.kind, loadToolCatalog, loadSkillCatalog]);

  const descriptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const t of toolCatalog?.tools?.items ?? []) {
      if (t.description) map.set(t.id, t.description);
    }
    for (const s of skillCatalog?.skillsPagination?.items ?? []) {
      if (s.description) map.set(s.id, s.description);
    }
    return map;
  }, [toolCatalog, skillCatalog]);

  const toolItems = React.useMemo<Suggestion[]>(
    () =>
      tools.map((t) => ({
        id: `tool:${t.id}`,
        kind: "tool",
        name: t.name,
        displayName: prettify(t.name),
        description: descriptions.get(t.id),
        disabled: controller.disabledTools.includes(t.id),
      })),
    [tools, descriptions, controller.disabledTools],
  );
  const skillItems = React.useMemo<Suggestion[]>(
    () =>
      skills.map((s) => ({
        id: `skill:${s.id}`,
        kind: "skill",
        name: s.name,
        displayName: prettify(s.name),
        description: descriptions.get(s.id),
      })),
    [skills, descriptions],
  );

  // ── "@" source: session files, re-fetched per menu open ─────────────────
  const [sessionFiles, setSessionFiles] = React.useState<SessionFile[] | null>(null);
  const [filesStatus, setFilesStatus] = React.useState<"ready" | "loading" | "error">(
    "ready",
  );
  const sessionId = controller.session?.id ?? null;
  const atOpenKey = trigger?.kind === "@" ? trigger.start : null;
  React.useEffect(() => {
    if (atOpenKey === null) return;
    if (!sessionId) {
      // /new with nothing uploaded: empty state; never ensureSession here.
      setSessionFiles([]);
      setFilesStatus("ready");
      return;
    }
    let cancelled = false;
    setFilesStatus("loading");
    sessionFilesApi
      .list(sessionId)
      .then((res) => {
        if (cancelled) return;
        setSessionFiles(res.files);
        setFilesStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setFilesStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [atOpenKey, sessionId]);

  const fileItems = React.useMemo<Suggestion[]>(
    () =>
      (sessionFiles ?? []).map((f) => ({
        id: `file:${f.key}`,
        kind: "file",
        name: f.name,
        displayName: f.name,
      })),
    [sessionFiles],
  );

  // ── Filtering (flat, group-ordered: tools then skills / files) ──────────
  const items = React.useMemo<Suggestion[]>(() => {
    if (!trigger) return [];
    if (trigger.kind === "/") {
      return [
        ...filterSuggestions(toolItems, trigger.query),
        ...filterSuggestions(skillItems, trigger.query),
      ];
    }
    return filterSuggestions(fileItems, trigger.query);
  }, [trigger, toolItems, skillItems, fileItems]);

  const menuOpen =
    !!trigger &&
    escapedKey !== triggerKey(trigger) &&
    !isAutoHidden(trigger.query, items.length);

  // ── Active row ───────────────────────────────────────────────────────────
  const [activeIndexRaw, setActiveIndex] = React.useState(0);
  const activeIndex = Math.min(activeIndexRaw, Math.max(items.length - 1, 0));
  React.useEffect(() => {
    setActiveIndex(0);
  }, [trigger?.start, trigger?.kind, trigger?.query]);

  // ── Insertion ────────────────────────────────────────────────────────────
  const applySuggestion = React.useCallback(
    (item: Suggestion) => {
      if (!trigger) return;
      const result = insertToken(input, trigger, caret, item.name);
      if (result.text.length > maxInputLength) {
        // Would overflow the input cap: skip the insert, dismiss the menu.
        setEscapedKey(triggerKey(trigger));
        return;
      }
      setInput(result.text);
      const el = inputRef.current;
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(result.caret, result.caret);
        setCaret(result.caret);
      });
    },
    [trigger, input, caret, maxInputLength, setInput, inputRef],
  );

  // ── Keyboard contract (returns true when the event was consumed) ────────
  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!menuOpen || e.nativeEvent.isComposing) return false;
      if (e.key === "ArrowDown" && items.length > 0) {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % items.length);
        return true;
      }
      if (e.key === "ArrowUp" && items.length > 0) {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
        return true;
      }
      if ((e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) && items.length > 0) {
        e.preventDefault();
        applySuggestion(items[activeIndex]);
        return true;
      }
      if (e.key === "Escape") {
        // Close ONLY the menu: stopPropagation keeps the document-level
        // overlay Esc chain (composer.tsx) out of it; preventDefault plus
        // `return true` keeps the composer's own Esc-clears-input off.
        e.preventDefault();
        e.stopPropagation();
        if (trigger) setEscapedKey(triggerKey(trigger));
        return true;
      }
      return false;
    },
    [menuOpen, items, activeIndex, applySuggestion, trigger],
  );

  const onBlur = React.useCallback(() => {
    if (trigger) setEscapedKey(triggerKey(trigger));
  }, [trigger]);

  // ── Highlight ranges ─────────────────────────────────────────────────────
  const slashNames = React.useMemo(
    () => [...tools.map((t) => t.name), ...skills.map((s) => s.name)],
    [tools, skills],
  );
  const atNames = React.useMemo(
    () => (sessionFiles ?? []).map((f) => f.name),
    [sessionFiles],
  );
  const tokenRanges = React.useMemo(
    () => findTokenRanges(input, { slash: slashNames, at: atNames }),
    [input, slashNames, atNames],
  );

  return {
    menuOpen,
    kind: trigger?.kind ?? null,
    items,
    activeIndex,
    setActiveIndex,
    applySuggestion,
    onKeyDown,
    onSelect,
    onBlur,
    tokenRanges,
    filesStatus,
    hasAnyFiles: (sessionFiles ?? []).length > 0,
    listboxId: LISTBOX_ID,
    activeOptionId: menuOpen && items.length > 0 ? optionId(activeIndex) : null,
  };
}
