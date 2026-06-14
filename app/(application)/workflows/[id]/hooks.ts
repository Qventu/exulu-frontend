"use client";

/**
 * /workflows/[id] — workbench-local state machine.
 *
 * useRoutineWorkbench owns the single-overlay invariant that previously lived
 * on the list page (routines-client.tsx). On the subpage there's exactly one
 * routine in focus, so the overlay state is straightforward: 'none' | 'run' |
 * 'queue'. The editor dialog + delete confirm have their own open flags
 * (different lifecycle: editor stays mountable while a run overlay is open is
 * NOT supported — opening the editor closes any overlay first to keep the
 * single-overlay rule).
 *
 * useScrollSpy: copied verbatim from the agents workbench
 * (/agents/edit/[id]/hooks.ts) to satisfy the no-cross-feature-imports lint
 * rule (codebase-structure §1.2). The 2026-06-13 findScrollParent walk MUST
 * remain byte-identical here: walking up to the nearest overflow:auto|scroll
 * ancestor and passing it as the IntersectionObserver root is what makes the
 * spy fire inside the AppShell scroll container instead of the (always-static)
 * window. If this fix changes upstream, mirror it here.
 */

import { useRouter } from "next/navigation";
import * as React from "react";

import { UserContext } from "@/app/(application)/authenticated";

import { routineAccess } from "../access";
import { useAgentsForPage, useRoutineMutations } from "../hooks";
import type {
  Routine,
  RoutineAccess,
  RunRoutineRequest,
} from "../types";

/* ---------------------------------------------------------------------------
 * useScrollSpy — observes anchored sections and reports the active id.
 * Verbatim copy of /agents/edit/[id]/hooks.ts. See note above.
 * ------------------------------------------------------------------------- */

/** Walks up the DOM from `el` to the nearest ancestor that establishes a
 *  scrolling formatting context (overflow-y: auto|scroll|overlay). Returns
 *  null when the document/window itself is the scroller. Needed because our
 *  AppShell scrolls inside a sibling `overflow-auto` div, NOT on the window —
 *  IntersectionObserver with the default root would observe against the
 *  viewport and never fire as the inner div scrolls. */
function findScrollParent(el: Element): Element | null {
  let parent: Element | null = el.parentElement;
  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent);
    if (/(auto|scroll|overlay)/.test(style.overflowY)) return parent;
    parent = parent.parentElement;
  }
  return null;
}

export function useScrollSpy(sectionIds: string[]): string {
  const [activeId, setActiveId] = React.useState<string>(sectionIds[0] ?? "");

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (elements.length === 0) return;

    const root = findScrollParent(elements[0]);

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry highest in the viewport that's intersecting.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        // Activate when the section is in the top 40% of the (root) viewport.
        root,
        rootMargin: "-10% 0px -55% 0px",
        threshold: 0,
      },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIds]);

  return activeId;
}

export type RoutineWorkbenchOverlay =
  | { kind: "none" }
  | { kind: "run"; request: RunRoutineRequest }
  | { kind: "queue"; queueName: string };

export interface UseRoutineWorkbench {
  access: RoutineAccess;
  agentName: string | null;
  queueName: string | null;
  overlay: RoutineWorkbenchOverlay;
  openRun: (prefill?: Record<string, string>) => void;
  openQueue: (queueName: string) => void;
  closeOverlay: () => void;
  editorOpen: boolean;
  editorMode: "edit" | "view";
  openEditor: (mode: "edit" | "view") => void;
  closeEditor: () => void;
  deleteOpen: boolean;
  setDeleteOpen: (open: boolean) => void;
  confirmDelete: () => Promise<void>;
}

export function useRoutineWorkbench(routine: Routine): UseRoutineWorkbench {
  const router = useRouter();
  const { user } = React.useContext(UserContext);

  const access = React.useMemo(
    () => routineAccess(routine, user),
    [routine, user],
  );

  // Resolve agent display name + queue via the shared cache-first hook —
  // single id, single cache hit after the first lookup.
  const agentIds = React.useMemo(
    () => (routine.agent ? [routine.agent] : []),
    [routine.agent],
  );
  const agents = useAgentsForPage(agentIds);
  const agentRecord = routine.agent ? agents[routine.agent] : undefined;
  const agentName = agentRecord?.name ?? null;
  const queueName = agentRecord?.queueName ?? null;

  // Single-overlay state machine.
  const [overlay, setOverlay] = React.useState<RoutineWorkbenchOverlay>({
    kind: "none",
  });

  const openRun = React.useCallback(
    (prefill?: Record<string, string>) => {
      const variables = (routine.variables ?? []) as string[];
      setOverlay({
        kind: "run",
        request: {
          id: routine.id,
          queue: queueName ?? undefined,
          variables,
          prefill,
          routineName: routine.name,
        },
      });
    },
    [routine.id, routine.name, routine.variables, queueName],
  );

  const openQueue = React.useCallback((name: string) => {
    setOverlay({ kind: "queue", queueName: name });
  }, []);

  const closeOverlay = React.useCallback(() => {
    setOverlay({ kind: "none" });
  }, []);

  // Editor (Edit / View) — opening closes any overlay first.
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editorMode, setEditorMode] = React.useState<"edit" | "view">("edit");
  const openEditor = React.useCallback((mode: "edit" | "view") => {
    setEditorMode(mode);
    setOverlay({ kind: "none" });
    setEditorOpen(true);
  }, []);
  const closeEditor = React.useCallback(() => {
    setEditorOpen(false);
    // The editor dialog already calls refetchQueries on its CREATE/UPDATE
    // mutations (GET_WORKFLOW_TEMPLATES); the subpage itself reads from the
    // server fetch, so navigating away and back is the only "refresh" path.
    // We use router.refresh() so the user sees their edits without leaving.
    router.refresh();
  }, [router]);

  // Delete confirm.
  const { removeRoutine } = useRoutineMutations();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const confirmDelete = React.useCallback(async () => {
    // DeleteRoutineDialog wraps the onConfirm call and handles both success
    // and failure toasts; we only own the mutation + post-success navigation.
    // Errors propagate so the ConfirmDialog stays open.
    await removeRoutine(routine.id);
    router.push("/workflows");
  }, [removeRoutine, routine.id, router]);

  return {
    access,
    agentName,
    queueName,
    overlay,
    openRun,
    openQueue,
    closeOverlay,
    editorOpen,
    editorMode,
    openEditor,
    closeEditor,
    deleteOpen,
    setDeleteOpen,
    confirmDelete,
  };
}
