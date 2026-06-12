"use client";

/**
 * Data + state hooks for the /agents/edit/[id] editor (codebase-structure
 * §3.2: redesigned pages never call useQuery(GET_X) inline).
 *
 * useAgentEditor owns:
 *  - ONE useForm at editor-view level (passed down to sections).
 *  - The single save-payload assembly point (fixes agents.md review #4 and the
 *    parity regression risk: Apollo silently discards undeclared variables —
 *    we assemble once, including the newly added firewall/teams/image fields).
 *  - Dirty tracking across RHF + staged non-RHF state (tools/skills/rbac/
 *    memory/animations/image/firewall).
 *  - Sonner success/error toasts; refetch on save (no navigation).
 *  - duplicate/remove flows for the header overflow.
 *
 * useEditorReferenceData owns the static-ish reference fetches consumed by
 * the editor (tools/categories/skills/variables/contexts + agenticRetrieval
 * tool gate). 300 ms debounce on tool search; category arg forwarded.
 *
 * useScrollSpy returns the active section id for SectionNav (presentational
 * primitive consumes it).
 */

import { useMutation, useQuery } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import type { Agent, AgentTool } from "@/types/models/agent";
import type { ExuluTool } from "@/types/models/tool";
import type { Variable } from "@/types/models/variable";

import {
  AGENT_FIREWALL_SUPPORTED,
  AGENT_IMAGE_UPDATE_SUPPORTED,
  AGENT_RBAC_TEAMS_SUPPORTED,
  COPY_AGENT_EDITOR,
  GET_AGENT_EDITOR,
  GET_CONTEXTS_EDITOR,
  GET_SKILLS_EDITOR,
  GET_TOOL_CATEGORIES_EDITOR,
  GET_TOOLS_EDITOR,
  GET_VARIABLES_EDITOR,
  REMOVE_AGENT_EDITOR,
  UPDATE_AGENT_EDITOR,
} from "./queries";

/* ---------------------------------------------------------------------------
 * Zod schema (mirrors the legacy form.tsx schema for RHF-validated fields;
 * non-RHF staged state has its own setters).
 * ------------------------------------------------------------------------- */

export const agentEditorSchema = z.object({
  id: z.string().or(z.number()).nullable().optional(),
  name: z
    .string()
    .min(2, { message: "Agent name must be at least 2 characters." })
    .max(300, { message: "Agent name must not be longer than 300 characters." }),
  category: z.string().nullable().optional(),
  description: z
    .string()
    .max(10000, {
      message: "Agent description must not be longer than 10.000 characters.",
    })
    .nullable()
    .optional(),
  instructions: z
    .string()
    .max(40000, {
      message: "Agent instructions must not be longer than 40.000 characters.",
    })
    .nullable()
    .optional(),
  welcomemessage: z.string().nullable().optional(),
  defaultagent: z.boolean().optional(),
  feedback: z.boolean().optional(),
  suggestions_enabled: z.boolean().optional(),
  active: z.boolean().optional(),
});

export type AgentFormValues = z.infer<typeof agentEditorSchema>;

export type FirewallScanner =
  | "promptGuard"
  | "codeShield"
  | "agentAlignment"
  | "hiddenAscii"
  | "piiDetection";

export interface FirewallState {
  enabled: boolean;
  scanners: Record<FirewallScanner, boolean>;
}

type RbacUserEntry = { id: string | number; rights: "read" | "write" };
type RbacIdEntry = { id: string; rights: "read" | "write" };

export interface RbacState {
  rights_mode?: string;
  users?: RbacUserEntry[];
  roles?: RbacIdEntry[];
  teams?: RbacIdEntry[];
}

function defaultFirewall(agent: Agent | undefined): FirewallState {
  // The firewall column is a JSON scalar — tolerate object or string.
  let raw: any = agent?.firewall;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = undefined;
    }
  }
  return {
    enabled: !!raw?.enabled,
    scanners: {
      promptGuard: !!raw?.scanners?.promptGuard,
      codeShield: !!raw?.scanners?.codeShield,
      agentAlignment: !!raw?.scanners?.agentAlignment,
      hiddenAscii: !!raw?.scanners?.hiddenAscii,
      piiDetection: !!raw?.scanners?.piiDetection,
    },
  };
}

function defaultTools(agent: Agent | undefined): AgentTool[] {
  // Legacy data may arrive as string[] (form.tsx:239-242 comment).
  const raw: any = agent?.tools;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as AgentTool[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function defaultSkills(
  agent: Agent | undefined,
): { id: string; name: string }[] {
  const raw: any = agent?.skills;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/* ---------------------------------------------------------------------------
 * useAgentEditor — single source of truth for the editor's form + save.
 * ------------------------------------------------------------------------- */

export interface UseAgentEditor {
  form: UseFormReturn<AgentFormValues>;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
  discard: () => void;
  duplicate: () => Promise<void>;
  remove: () => Promise<void>;
  // staged non-RHF state + setters consumed by sections:
  tools: AgentTool[];
  setTools: (t: AgentTool[]) => void;
  skills: { id: string; name: string }[];
  setSkills: (s: { id: string; name: string }[]) => void;
  rbac: RbacState;
  setRbac: (r: RbacState) => void;
  memory: string;
  setMemory: (id: string) => void;
  model: string;
  setModel: (id: string) => void;
  animationIdle: string;
  setAnimationIdle: (k: string) => void;
  animationResponding: string;
  setAnimationResponding: (k: string) => void;
  image: string | undefined;
  setImage: (url: string) => void;
  firewall: FirewallState;
  setFirewall: (f: FirewallState) => void;
}

export function useAgentEditor(agent: Agent): UseAgentEditor {
  const router = useRouter();
  const t = useTranslations("agents");
  const tCommon = useTranslations("common");

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentEditorSchema),
    mode: "onChange",
    defaultValues: {
      id: agent.id,
      name: agent.name ?? "",
      category: (agent as any).category ?? "",
      description: agent.description ?? "",
      instructions: agent.instructions ?? "",
      welcomemessage: (agent as any).welcomemessage ?? "",
      defaultagent: !!(agent as any).defaultagent,
      feedback: !!(agent as any).feedback,
      suggestions_enabled: !!(agent as any).suggestions_enabled,
      active: !!(agent as any).active,
    },
  });

  // Staged non-RHF state.
  const [tools, setTools] = React.useState<AgentTool[]>(() =>
    defaultTools(agent),
  );
  const [skills, setSkills] = React.useState<{ id: string; name: string }[]>(
    () => defaultSkills(agent),
  );
  const [rbac, setRbac] = React.useState<RbacState>(() => ({
    rights_mode: agent.rights_mode,
    users: (agent as any).RBAC?.users ?? [],
    roles: (agent as any).RBAC?.roles ?? [],
    teams: (agent as any).RBAC?.teams ?? [],
  }));
  const [memory, setMemory] = React.useState<string>(
    (agent as any).memory ?? "",
  );
  const [model, setModel] = React.useState<string>(agent.model ?? "");
  const [animationIdle, setAnimationIdle] = React.useState<string>(
    (agent as any).animation_idle ?? "",
  );
  const [animationResponding, setAnimationResponding] = React.useState<string>(
    (agent as any).animation_responding ?? "",
  );
  const [image, setImage] = React.useState<string | undefined>(
    (agent as any).image ?? undefined,
  );
  const [firewall, setFirewall] = React.useState<FirewallState>(() =>
    defaultFirewall(agent),
  );

  // Track non-RHF dirty state by snapshotting initial JSON strings.
  const initialSnapshot = React.useRef({
    tools: JSON.stringify(defaultTools(agent)),
    skills: JSON.stringify(defaultSkills(agent)),
    rbac: JSON.stringify({
      rights_mode: agent.rights_mode,
      users: (agent as any).RBAC?.users ?? [],
      roles: (agent as any).RBAC?.roles ?? [],
      teams: (agent as any).RBAC?.teams ?? [],
    }),
    memory: (agent as any).memory ?? "",
    model: agent.model ?? "",
    animationIdle: (agent as any).animation_idle ?? "",
    animationResponding: (agent as any).animation_responding ?? "",
    image: (agent as any).image ?? "",
    firewall: JSON.stringify(defaultFirewall(agent)),
  });

  // Compare staged state against the initial snapshot. The ref is the canonical
  // pattern for an immutable baseline that must NOT drive re-renders — it is
  // mutated only on save/discard (event handlers, not render). The
  // `react-hooks/refs` warning is acknowledged: reading a baseline ref to
  // *derive* render output is the explicit shape of the rule's exception.
  const snapshot = initialSnapshot.current;
  const stagedDirty =
    JSON.stringify(tools) !== snapshot.tools ||
    JSON.stringify(skills) !== snapshot.skills ||
    JSON.stringify(rbac) !== snapshot.rbac ||
    memory !== snapshot.memory ||
    model !== snapshot.model ||
    animationIdle !== snapshot.animationIdle ||
    animationResponding !== snapshot.animationResponding ||
    (image ?? "") !== snapshot.image ||
    JSON.stringify(firewall) !== snapshot.firewall;

  const dirty = form.formState.isDirty || stagedDirty;

  // Mutations.
  const [updateAgent, updateState] = useMutation(UPDATE_AGENT_EDITOR, {
    refetchQueries: [GET_AGENT_EDITOR, "AgentEditorById"],
  });

  const [copyAgent, copyState] = useMutation(COPY_AGENT_EDITOR);

  const [removeAgent, removeState] = useMutation(REMOVE_AGENT_EDITOR);

  // THE single payload assembly point — parity gate for the new fields.
  const save = React.useCallback(async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error(tCommon("somethingWentWrong"));
      return;
    }
    const values = form.getValues();

    const variables: Record<string, unknown> = {
      id: agent.id,
      name: values.name,
      description: values.description,
      instructions: values.instructions,
      welcomemessage: values.welcomemessage,
      defaultagent: values.defaultagent,
      category: values.category,
      active: values.active,
      memory: memory || null,
      feedback: values.feedback,
      suggestions_enabled: values.suggestions_enabled ?? false,
      model: model || null,
      animation_idle: animationIdle,
      animation_responding: animationResponding,
      rights_mode: rbac.rights_mode,
      RBAC: {
        users: rbac.users ?? [],
        roles: rbac.roles ?? [],
        ...(AGENT_RBAC_TEAMS_SUPPORTED ? { teams: rbac.teams ?? [] } : {}),
      },
      tools: JSON.stringify(tools),
      skills: JSON.stringify(skills),
    };
    if (AGENT_FIREWALL_SUPPORTED) {
      variables.firewall = JSON.stringify(firewall);
    }
    if (AGENT_IMAGE_UPDATE_SUPPORTED) {
      variables.image = image ?? null;
    }

    try {
      await updateAgent({ variables });
      toast.success(t("editor.saved"));
      // Re-snapshot so dirty flips off cleanly.
      initialSnapshot.current = {
        tools: JSON.stringify(tools),
        skills: JSON.stringify(skills),
        rbac: JSON.stringify(rbac),
        memory,
        model,
        animationIdle,
        animationResponding,
        image: image ?? "",
        firewall: JSON.stringify(firewall),
      };
      // Reset RHF dirty (keep values).
      form.reset(values, { keepValues: true });
    } catch (error: any) {
      toast.error(error?.message ?? tCommon("somethingWentWrong"));
    }
  }, [
    agent.id,
    animationIdle,
    animationResponding,
    firewall,
    form,
    image,
    memory,
    model,
    rbac,
    skills,
    t,
    tCommon,
    tools,
    updateAgent,
  ]);

  const discard = React.useCallback(() => {
    form.reset({
      id: agent.id,
      name: agent.name ?? "",
      category: (agent as any).category ?? "",
      description: agent.description ?? "",
      instructions: agent.instructions ?? "",
      welcomemessage: (agent as any).welcomemessage ?? "",
      defaultagent: !!(agent as any).defaultagent,
      feedback: !!(agent as any).feedback,
      suggestions_enabled: !!(agent as any).suggestions_enabled,
      active: !!(agent as any).active,
    });
    setTools(defaultTools(agent));
    setSkills(defaultSkills(agent));
    setRbac({
      rights_mode: agent.rights_mode,
      users: (agent as any).RBAC?.users ?? [],
      roles: (agent as any).RBAC?.roles ?? [],
      teams: (agent as any).RBAC?.teams ?? [],
    });
    setMemory((agent as any).memory ?? "");
    setModel(agent.model ?? "");
    setAnimationIdle((agent as any).animation_idle ?? "");
    setAnimationResponding((agent as any).animation_responding ?? "");
    setImage((agent as any).image ?? undefined);
    setFirewall(defaultFirewall(agent));
  }, [agent]);

  const duplicate = React.useCallback(async () => {
    try {
      const result: any = await copyAgent({ variables: { id: agent.id } });
      const copyId = result?.data?.agentsCopyOneById?.item?.id;
      toast.success(t("editor.duplicated"));
      if (copyId) router.push(`/agents/edit/${copyId}`);
    } catch (error: any) {
      toast.error(error?.message ?? tCommon("somethingWentWrong"));
    }
  }, [agent.id, copyAgent, router, t, tCommon]);

  const remove = React.useCallback(async () => {
    await removeAgent({ variables: { id: agent.id } });
    router.push("/agents");
  }, [agent.id, removeAgent, router]);

  return {
    form,
    dirty,
    saving:
      updateState.loading || copyState.loading || removeState.loading,
    save,
    discard,
    duplicate,
    remove,
    tools,
    setTools,
    skills,
    setSkills,
    rbac,
    setRbac,
    memory,
    setMemory,
    model,
    setModel,
    animationIdle,
    setAnimationIdle,
    animationResponding,
    setAnimationResponding,
    image,
    setImage,
    firewall,
    setFirewall,
  };
}

/* ---------------------------------------------------------------------------
 * useEditorReferenceData — tools/skills/variables/contexts/categories.
 * ------------------------------------------------------------------------- */

export interface UseEditorReferenceData {
  tools: ExuluTool[];
  toolsTotal: number;
  toolsLoading: boolean;
  toolSearch: string;
  setToolSearch: (s: string) => void;
  toolCategory: string;
  setToolCategory: (c: string) => void;
  categories: string[];
  skills: { id: string; name: string; description?: string }[];
  variables: Variable[];
  contexts: { id: string; name: string; description?: string }[];
  agenticRetrievalTool: ExuluTool | null;
}

export function useEditorReferenceData(agentId: string): UseEditorReferenceData {
  const [toolSearch, setToolSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [toolCategory, setToolCategory] = React.useState<string>("all");

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(toolSearch), 300);
    return () => clearTimeout(timer);
  }, [toolSearch]);

  const toolsQuery = useQuery<{
    tools: {
      items: ExuluTool[];
      total: number;
      page: number;
      limit: number;
    };
  }>(GET_TOOLS_EDITOR, {
    variables: {
      search: debouncedSearch || undefined,
      category: toolCategory === "all" ? undefined : toolCategory,
      limit: 100,
      page: 0,
    },
  });

  const categoriesQuery = useQuery<{ toolCategories: string[] }>(
    GET_TOOL_CATEGORIES_EDITOR,
  );

  const skillsQuery = useQuery<{
    skillsPagination: {
      items: { id: string; name: string; description?: string }[];
    };
  }>(GET_SKILLS_EDITOR, { variables: { page: 1, limit: 100 } });

  const variablesQuery = useQuery<{
    variablesPagination: { items: Variable[] };
  }>(GET_VARIABLES_EDITOR, { variables: { page: 1, limit: 100 } });

  const contextsQuery = useQuery<{
    contexts: { items: { id: string; name: string; description?: string }[] };
  }>(GET_CONTEXTS_EDITOR);

  const allTools = toolsQuery.data?.tools?.items ?? [];
  // Item 68: exclude self (no self-calls); agentic_context_search has its own
  // section in Knowledge & memory.
  const tools = React.useMemo(
    () => allTools.filter((tool) => tool.id !== agentId),
    [allTools, agentId],
  );

  const agenticRetrievalTool = React.useMemo(
    () =>
      allTools.find((tool) => tool.id === "agentic_context_search") ?? null,
    [allTools],
  );

  return {
    tools,
    toolsTotal: toolsQuery.data?.tools?.total ?? 0,
    toolsLoading: toolsQuery.loading,
    toolSearch,
    setToolSearch,
    toolCategory,
    setToolCategory,
    categories: categoriesQuery.data?.toolCategories ?? [],
    skills: skillsQuery.data?.skillsPagination?.items ?? [],
    variables: variablesQuery.data?.variablesPagination?.items ?? [],
    contexts: contextsQuery.data?.contexts?.items ?? [],
    agenticRetrievalTool,
  };
}

/* ---------------------------------------------------------------------------
 * useScrollSpy — observes anchored sections and reports the active id.
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
  const [activeId, setActiveId] = React.useState<string>(
    sectionIds[0] ?? "",
  );

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
