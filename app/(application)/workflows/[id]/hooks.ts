"use client";

/**
 * /workflows/[id] — workbench-local state machine + page-level editor form.
 *
 * useRoutineWorkbench owns the single-overlay invariant (run/queue) plus the
 * Steps Sheet open flag + delete confirm. The legacy editor-dialog state
 * (editorOpen/editorMode) has been removed: editing now happens inline via
 * the page-level form (useRoutineEditor) + the wide Steps Sheet.
 *
 * useRoutineEditor mirrors the agents `useAgentEditor` pattern:
 *  - ONE useForm at workbench level (Basics + Access sections share it).
 *  - Staged non-RHF state for RBAC (RBACControl owns onChange w/ 4 args).
 *  - Dirty = RHF dirty || staged-RBAC-JSON !== snapshot.
 *  - save() assembles UPDATE_WORKFLOW_TEMPLATE byte-equivalent to the killed
 *    dialog (includes steps_json from the parent-held value AND the agent —
 *    UX #8 requires agent always sent).
 *  - remove() deletes + routes back to /workflows.
 *
 * IMPORTANT: stepsJson lives in the parent workbench component, NOT in this
 * hook's form. The Steps Sheet has its own form and writes back via callback;
 * the page-level form just forwards the current value on save.
 *
 * useScrollSpy: copied verbatim from the agents workbench
 * (/agents/edit/[id]/hooks.ts) to satisfy the no-cross-feature-imports lint
 * rule (codebase-structure §1.2). The 2026-06-13 findScrollParent walk MUST
 * remain byte-identical here.
 */

import { useMutation } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import type { UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { UserContext } from "@/app/(application)/authenticated";

import { routineAccess } from "../access";
import { useAgentsForPage, useRoutineMutations } from "../hooks";
import {
  GET_WORKFLOW_TEMPLATES,
  REMOVE_WORKFLOW_TEMPLATE_BY_ID,
  UPDATE_WORKFLOW_TEMPLATE,
} from "../queries";
import { ROUTINES_RBAC_TEAMS_SUPPORTED } from "../schema-flags";
import type {
  Routine,
  RoutineAccess,
  RoutineRightsMode,
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

/* ---------------------------------------------------------------------------
 * useRoutineWorkbench — overlay + sheet + delete state.
 * ------------------------------------------------------------------------- */

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
  /** Wide Steps editor Sheet. */
  stepsSheetOpen: boolean;
  openStepsSheet: () => void;
  closeStepsSheet: () => void;
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

  // Steps editor Sheet (replaces the editor dialog Edit/View path). Opening
  // dismisses any concurrent overlay to preserve the single-overlay rule.
  const [stepsSheetOpen, setStepsSheetOpen] = React.useState(false);
  const openStepsSheet = React.useCallback(() => {
    setOverlay({ kind: "none" });
    setStepsSheetOpen(true);
  }, []);
  const closeStepsSheet = React.useCallback(() => {
    setStepsSheetOpen(false);
  }, []);

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
    stepsSheetOpen,
    openStepsSheet,
    closeStepsSheet,
    deleteOpen,
    setDeleteOpen,
    confirmDelete,
  };
}

/* ---------------------------------------------------------------------------
 * useRoutineEditor — page-level RHF form for Basics + Access (the inline
 * surfaces). Steps live in a separate parent state + the Sheet's own form.
 * ------------------------------------------------------------------------- */

export const routineEditorSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Routine name must be at least 2 characters." })
    .max(300, { message: "Routine name must not be longer than 300 characters." }),
  description: z
    .string()
    .max(10000, {
      message: "Routine description must not be longer than 10.000 characters.",
    })
    .nullable()
    .optional(),
  agent: z.string().min(1, { message: "An agent is required." }),
  queue: z.string().min(1, { message: "A queue is required." }),
});

export type RoutineFormValues = z.infer<typeof routineEditorSchema>;

type RbacUserEntry = { id: string | number; rights: "read" | "write" };
type RbacIdEntry = { id: string; rights: "read" | "write" };

export interface RbacState {
  rights_mode: RoutineRightsMode;
  users: RbacUserEntry[];
  roles: RbacIdEntry[];
  teams: RbacIdEntry[];
}

function defaultRbac(routine: Routine): RbacState {
  return {
    rights_mode: (routine.rights_mode ?? "private") as RoutineRightsMode,
    users: (routine.RBAC?.users ?? []) as RbacUserEntry[],
    roles: (routine.RBAC?.roles ?? []) as RbacIdEntry[],
    teams: (routine.RBAC?.teams ?? []) as RbacIdEntry[],
  };
}

/**
 * Tracks the actually-last-persisted values so dependent surfaces (the Steps
 * Sheet's save, the header title, the variables list) stay in sync with the
 * mutation result — the SSR `routine` prop never updates after the initial
 * server fetch, and we only `refetchQueries: [GET_WORKFLOW_TEMPLATES]` (the
 * list), so Apollo's by-id cache for THIS routine isn't reactively refreshed
 * either. Updated whenever the page-level save or the Steps Sheet's save
 * succeeds; initialized from the SSR snapshot.
 */
export interface RoutineLastSaved {
  name: string;
  agent: string | null;
  /** Derived backend-side from `{var}` placeholders in steps_json; we keep
   *  the SSR list initially and don't try to recompute client-side. */
  variables: string[];
}

export interface UseRoutineEditor {
  form: UseFormReturn<RoutineFormValues>;
  rbac: RbacState;
  setRbac: (r: RbacState) => void;
  dirty: boolean;
  saving: boolean;
  /** Current parent-held steps_json — sent on save (byte-equivalent w/ dialog). */
  stepsJson: UIMessage[];
  /** Mutated by the Steps Sheet onSaved callback. */
  setStepsJson: (next: UIMessage[]) => void;
  /** Last-persisted snapshot — see RoutineLastSaved doc. */
  lastSaved: RoutineLastSaved;
  save: () => Promise<void>;
  discard: () => void;
  remove: () => Promise<void>;
}

export function useRoutineEditor(routine: Routine): UseRoutineEditor {
  const router = useRouter();
  const t = useTranslations("routines");
  const tCommon = useTranslations("common");

  const form = useForm<RoutineFormValues>({
    resolver: zodResolver(routineEditorSchema),
    mode: "onChange",
    defaultValues: {
      name: routine.name ?? "",
      description: routine.description ?? "",
      agent: routine.agent ?? "",
      queue: routine.queue ?? "",
    },
  });

  // Staged non-RHF state: RBAC (RBACControl onChange has 4 args; cannot live
  // inside a single FormField cleanly — mirrors the agents access section).
  const [rbac, setRbac] = React.useState<RbacState>(() => defaultRbac(routine));

  // stepsJson is owned by the parent workbench but stored here so save() can
  // forward the latest value with the page payload. The Sheet writes back via
  // setStepsJson when it completes a save.
  const [stepsJson, setStepsJson] = React.useState<UIMessage[]>(
    routine.steps_json ?? [],
  );

  // lastSaved snapshot — see RoutineLastSaved doc. Seeded from SSR; updated
  // on every successful save (page-level or Sheet) so subsequent operations
  // (Sheet save, header title, variables list) see the truly-current values.
  const [lastSaved, setLastSaved] = React.useState<RoutineLastSaved>(() => ({
    name: routine.name ?? "",
    agent: routine.agent ?? null,
    variables: (routine.variables ?? []) as string[],
  }));

  // Snapshot baseline for staged dirty tracking. Mutated only on save/discard
  // (event handlers, not render). The `react-hooks/refs` warning is the
  // acknowledged exception for ref-as-baseline reads.
  const initialSnapshot = React.useRef({
    rbac: JSON.stringify(defaultRbac(routine)),
  });

  const snapshot = initialSnapshot.current;
  const stagedDirty = JSON.stringify(rbac) !== snapshot.rbac;
  const dirty = form.formState.isDirty || stagedDirty;

  // Mutations.
  const [updateMutate, updateState] = useMutation(UPDATE_WORKFLOW_TEMPLATE, {
    refetchQueries: [GET_WORKFLOW_TEMPLATES, "GetWorkflowTemplates"],
  });
  const [removeMutate, removeState] = useMutation(
    REMOVE_WORKFLOW_TEMPLATE_BY_ID,
    {
      refetchQueries: [GET_WORKFLOW_TEMPLATES, "GetWorkflowTemplates"],
    },
  );

  const save = React.useCallback(async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      // RHF will surface the first failing message; we still emit a sticky
      // toast for the no-agent / no-name cases (mirrors dialog behavior).
      const errs = form.formState.errors;
      if (errs.agent) {
        toast.error(t("editor.toast.agentRequired"));
      } else if (errs.name) {
        toast.error(t("editor.toast.nameRequired"));
      } else {
        toast.error(tCommon("somethingWentWrong"));
      }
      return;
    }
    const values = form.getValues();

    // Build RBAC payload — gated on the teams flag (workflows.md UX #10).
    // Mirrors routine-editor-dialog.tsx (CREATE) exactly so the chat handshake
    // and this inline edit emit byte-equivalent payloads.
    const RBACPayload: {
      users: RbacUserEntry[];
      roles: RbacIdEntry[];
      teams?: RbacIdEntry[];
    } = {
      users: rbac.users,
      roles: rbac.roles,
    };
    if (ROUTINES_RBAC_TEAMS_SUPPORTED) {
      RBACPayload.teams = rbac.teams;
    } else if (rbac.teams.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        "[routines] ROUTINES_RBAC_TEAMS_SUPPORTED is false — teams will not be persisted",
      );
    }

    try {
      await updateMutate({
        variables: {
          id: routine.id,
          name: values.name.trim(),
          description: values.description?.trim() || null,
          rights_mode: rbac.rights_mode,
          agent: values.agent,
          queue: values.queue,
          RBAC: RBACPayload,
          // Forward the parent-held steps_json (byte-equivalent w/ the killed
          // dialog's UPDATE behavior — it always sent steps_json on update).
          steps_json: stepsJson,
        },
      });
      toast.success(t("editor.toast.updated", { name: values.name.trim() }));
      // Re-snapshot so dirty flips off cleanly.
      initialSnapshot.current = { rbac: JSON.stringify(rbac) };
      // Reset RHF dirty (keep values).
      form.reset(values, { keepValues: true });
      // Update the last-saved snapshot so the header title + Sheet's save
      // both reflect the freshly-persisted values without waiting for an SSR
      // refresh. Variables are NOT recomputed here — they derive from
      // steps_json on the backend; the Sheet's save updates them.
      setLastSaved((prev) => ({
        ...prev,
        name: values.name.trim(),
        agent: values.agent,
      }));
    } catch (err) {
      toast.error(t("editor.toast.saveFailed"), {
        description: (err as Error).message,
      });
    }
  }, [form, rbac, routine.id, stepsJson, t, tCommon, updateMutate]);

  const discard = React.useCallback(() => {
    form.reset({
      name: routine.name ?? "",
      description: routine.description ?? "",
      agent: routine.agent ?? "",
      queue: routine.queue ?? "",
    });
    setRbac(defaultRbac(routine));
    // NB: stepsJson is intentionally untouched — discard only affects Basics
    // and Access. Steps have their own Sheet-scoped dirty/discard.
  }, [routine]);

  const remove = React.useCallback(async () => {
    await removeMutate({ variables: { id: routine.id } });
    router.push("/workflows");
  }, [removeMutate, routine.id, router]);

  return {
    form,
    rbac,
    setRbac,
    dirty,
    saving: updateState.loading || removeState.loading,
    stepsJson,
    setStepsJson,
    lastSaved,
    save,
    discard,
    remove,
  };
}
