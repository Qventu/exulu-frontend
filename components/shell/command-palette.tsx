"use client";

/**
 * CommandPalette — the global ⌘K palette (navigation.md §4).
 *
 * Fed exclusively from nav-config.ts plus a registry of create-actions and
 * entity-search providers: the palette can never show a destination the
 * sidebar would hide (same `can()` predicate via `visibleEntries`).
 *
 * Result order (§4): Recent → Navigate → Create → Search → Preferences.
 * Selection always navigates or executes immediately and closes — the palette
 * never opens a second overlay (philosophy anti-pattern #3).
 *
 * Motion (§6 row 4): open fade + scale 0.98→1 in 150 ms ease-in-out, close
 * 150 ms — both `motion-reduce:animate-none`; the "Searching…" shimmer falls
 * back to static text under reduced motion.
 *
 * Mounting contract (integration step):
 * - Mount ONCE inside `SidebarProvider` (uses `useSidebar` for the
 *   "Toggle sidebar" preference), `LanguageProvider`, the theme provider and
 *   the Apollo provider — e.g. next to the sidebar in the AppShell.
 * - Props: `user` (UserContext's user — `RightsUser`-compatible) and `config`
 *   (ConfigContext value — `NavConfig`-compatible).
 * - Optional `onSendFeedback`: when provided, the "Send feedback" footer
 *   entry appears under Navigate; the palette closes first, then calls it
 *   (the FeedbackDialog itself stays owned by the shell footer).
 * - The sidebar's search affordance opens it via `openCommandPalette()`
 *   (imperative, event-based — no context plumbing needed).
 */

import { useQuery } from "@apollo/client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useReducedMotion } from "framer-motion";
import { Languages, Monitor, Moon, PanelLeft, Sun, type LucideIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import * as React from "react";

import { GROUP_I18N_KEYS, activeEntryFor, visibleEntries, type NavConfig, type NavEntry } from "@/components/shell/nav-config";
import { useLanguage } from "@/components/shell/language-provider";
import { ShimmeringText } from "@/components/primitives/shimmering-text";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { useSidebar } from "@/components/ui/sidebar";
import { locales, type Locale } from "@/i18n/config";
import {
  PALETTE_CHAT_SESSIONS,
  PALETTE_KNOWLEDGE_CONTEXTS,
  PALETTE_SEARCH_AGENTS,
  PALETTE_SEARCH_PROJECTS,
  PALETTE_SEARCH_PROMPTS,
  PALETTE_SEARCH_SKILLS,
} from "@/lib/graphql/operations/palette";
import type { RightsUser } from "@/lib/rights";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Imperative open API                                                  */
/* ------------------------------------------------------------------ */

const OPEN_EVENT = "exulu:command-palette:open";

/**
 * Opens the mounted CommandPalette from anywhere (no context needed) —
 * the sidebar's search affordance calls this. No-op on the server and
 * before the palette has mounted.
 */
export function openCommandPalette(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

/* ------------------------------------------------------------------ */
/* Recent-pages tracking (client-side history, navigation.md §4)        */
/* ------------------------------------------------------------------ */

const RECENT_PAGES_KEY = "exulu.palette.recent-pages";
const RECENT_PAGES_MAX = 5;
const RECENT_SESSIONS_MAX = 3;
const SEARCH_MIN_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_PAGE_SIZE = 5;

function readRecentPageIds(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_PAGES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    // localStorage unavailable (private mode, SSR) — recents silently off.
    return [];
  }
}

function pushRecentPageId(id: string): void {
  try {
    const next = [id, ...readRecentPageIds().filter((prev) => prev !== id)];
    window.localStorage.setItem(
      RECENT_PAGES_KEY,
      JSON.stringify(next.slice(0, RECENT_PAGES_MAX)),
    );
  } catch {
    // Ignore quota/availability errors — recents are a nicety, not a feature.
  }
}

/* ------------------------------------------------------------------ */
/* Create-action registry (navigation.md §4 "Create")                   */
/* ------------------------------------------------------------------ */

/**
 * Each create action is owned by a nav entry and inherits its visibility
 * (same `requires` AND config flag — the gate can never diverge, §4).
 * Targets deep-link to the owning page with its create surface open.
 *
 * TODO(redesign Phase 2+): pages adopt the `?new=1` convention as they
 * migrate — until a page handles it, the link lands on the list page with
 * the param ignored (navigate-only, never broken).
 */
const CREATE_ACTIONS: readonly { id: string; ownerId: string; i18nKey: string }[] = [
  { id: "new-chat", ownerId: "chat", i18nKey: "palette.create.chat" },
  { id: "new-project", ownerId: "projects", i18nKey: "palette.create.project" },
  { id: "new-agent", ownerId: "agents", i18nKey: "palette.create.agent" },
  { id: "new-prompt", ownerId: "prompts", i18nKey: "palette.create.prompt" },
  { id: "new-skill", ownerId: "skills", i18nKey: "palette.create.skill" },
  { id: "new-routine", ownerId: "routines", i18nKey: "palette.create.routine" },
  { id: "new-eval", ownerId: "evals", i18nKey: "palette.create.eval" },
  { id: "new-variable", ownerId: "variables", i18nKey: "palette.create.variable" },
  { id: "new-model", ownerId: "models", i18nKey: "palette.create.model" },
  { id: "new-api-key", ownerId: "keys", i18nKey: "palette.create.apiKey" },
  { id: "invite-user", ownerId: "users", i18nKey: "palette.create.inviteUser" },
  { id: "upload-audio", ownerId: "transcripts", i18nKey: "palette.create.uploadAudio" },
];

/* ------------------------------------------------------------------ */
/* Entity-search providers (navigation.md §4 "Search")                  */
/* ------------------------------------------------------------------ */

/** Existing-locale display keys; new locales fall back to the raw code. */
const LOCALE_NAME_KEYS: Partial<Record<Locale, string>> = {
  en: "language.english",
  de: "language.german",
};

interface PaletteNamedItem {
  id: string;
  name?: string | null;
}

interface PaletteSessionItem {
  id: string;
  title?: string | null;
  /** Owning agent id — sessions live at /chat/{agent}/{id}. */
  agent: string;
  updatedAt?: string | null;
}

export interface CommandPaletteProps {
  /** UserContext's user — only the RightsUser shape is consumed. */
  user: RightsUser | null | undefined;
  /** ConfigContext value — only the NavConfig flags are consumed. */
  config: NavConfig;
  /**
   * When provided, "Send feedback" (config-gated like the footer entry)
   * appears under Navigate; the palette closes, then this fires.
   */
  onSendFeedback?: () => void;
}

export function CommandPalette({ user, config, onSendFeedback }: CommandPaletteProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const { locale, setLocale } = useLanguage();
  const { toggleSidebar } = useSidebar();
  const reducedMotion = useReducedMotion();

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [debouncing, setDebouncing] = React.useState(false);
  const [recentIds, setRecentIds] = React.useState<string[]>([]);

  /* ---- global open triggers (⌘K / Ctrl+K + imperative event) ---- */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpenEvent);
    };
  }, []);

  /* ---- recent pages: record every visited nav destination ---- */
  React.useEffect(() => {
    const entry = activeEntryFor(pathname);
    if (entry?.route) pushRecentPageId(entry.id);
  }, [pathname]);

  /* ---- fresh state each time the palette opens (resetting on close
         would visibly regroup the list mid close-animation) ---- */
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setRecentIds(readRecentPageIds());
    }
  }, [open]);

  /* ---- 300 ms search debounce (≥2 chars, §4) ---- */
  const term = query.trim();
  React.useEffect(() => {
    if (term.length < SEARCH_MIN_CHARS) {
      setDebounced("");
      setDebouncing(false);
      return;
    }
    setDebouncing(true);
    const timeout = window.setTimeout(() => {
      setDebounced(term);
      setDebouncing(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [term]);

  /* ---- RBAC-visible entries (single source of truth, §1) ---- */
  const visible = React.useMemo(
    () => (user ? visibleEntries(user, config) : []),
    [user, config],
  );
  const visibleById = React.useMemo(
    () => new Map(visible.map((entry) => [entry.id, entry])),
    [visible],
  );
  const activeEntry = React.useMemo(() => activeEntryFor(pathname), [pathname]);

  /* ---- close-then-execute (never a second overlay, §4) ---- */
  const runAction = React.useCallback((action: () => void) => {
    setOpen(false);
    action();
  }, []);
  const navigateTo = React.useCallback(
    (href: string) => runAction(() => router.push(href)),
    [runAction, router],
  );
  const handleOpenChange = React.useCallback((next: boolean) => {
    setOpen(next);
  }, []);

  /* ---- matching for static groups (cmdk filter is off: results mix
         async server data with client items, so we filter ourselves) ---- */
  const matches = React.useCallback(
    (label: string) =>
      term === "" || label.toLocaleLowerCase().includes(term.toLocaleLowerCase()),
    [term],
  );

  const entryLabel = React.useCallback(
    (entry: NavEntry) => t(entry.i18nKey),
    [t],
  );
  const entryGroupLabel = React.useCallback(
    (entry: NavEntry) =>
      entry.group === "top" ? null : t(GROUP_I18N_KEYS[entry.group]),
    [t],
  );

  /* ---- Recent (only while the query is empty: once the user types,
         Navigate/Search carry the same destinations without duplicates) ---- */
  const recentEntries = React.useMemo(() => {
    if (term !== "") return [];
    return recentIds
      .map((id) => visibleById.get(id))
      .filter((entry): entry is NavEntry => Boolean(entry?.route))
      .filter((entry) => entry.id !== activeEntry?.id)
      .slice(0, RECENT_PAGES_MAX);
  }, [term, recentIds, visibleById, activeEntry]);

  const recentSessionsQuery = useQuery(PALETTE_CHAT_SESSIONS, {
    skip: !open,
    fetchPolicy: "cache-and-network",
    variables: { page: 1, limit: RECENT_SESSIONS_MAX },
  });
  const recentSessions: PaletteSessionItem[] = (
    term === ""
      ? ((recentSessionsQuery.data?.agent_sessionsPagination?.items ??
          []) as PaletteSessionItem[])
      : []
  ).filter((session) => Boolean(session.agent));

  /* ---- Navigate ---- */
  const navigateEntries = React.useMemo(
    () =>
      visible.filter((entry) =>
        entry.route !== null
          ? true
          : entry.id === "send-feedback" && Boolean(onSendFeedback),
      ),
    [visible, onSendFeedback],
  );
  const filteredNavigate = navigateEntries.filter((entry) => {
    const group = entryGroupLabel(entry);
    return matches(entryLabel(entry)) || (group !== null && matches(group));
  });

  /* ---- Create ---- */
  const createItems = React.useMemo(
    () =>
      CREATE_ACTIONS.flatMap((action) => {
        const owner = visibleById.get(action.ownerId);
        return owner?.route ? [{ ...action, owner, route: owner.route }] : [];
      }),
    [visibleById],
  );
  const filteredCreate = createItems.filter((item) => matches(t(item.i18nKey)));

  /* ---- Search (async, ≥2 chars, 300 ms debounce, max 5 per group) ---- */
  const searching = open && debounced.length >= SEARCH_MIN_CHARS;
  const nameFilter = [{ name: { contains: debounced } }];
  const searchVariables = { page: 1, limit: SEARCH_PAGE_SIZE, filters: nameFilter };

  const agentsSearch = useQuery(PALETTE_SEARCH_AGENTS, {
    skip: !searching || !visibleById.has("agents"),
    variables: searchVariables,
  });
  const sessionsSearch = useQuery(PALETTE_CHAT_SESSIONS, {
    skip: !searching || !visibleById.has("chat"),
    variables: {
      page: 1,
      limit: SEARCH_PAGE_SIZE,
      filters: [{ title: { contains: debounced } }],
    },
  });
  const projectsSearch = useQuery(PALETTE_SEARCH_PROJECTS, {
    skip: !searching || !visibleById.has("projects"),
    variables: searchVariables,
  });
  const promptsSearch = useQuery(PALETTE_SEARCH_PROMPTS, {
    skip: !searching || !visibleById.has("prompts"),
    variables: searchVariables,
  });
  const contextsSearch = useQuery(PALETTE_KNOWLEDGE_CONTEXTS, {
    skip: !searching || !visibleById.has("knowledge"),
  });
  const skillsSearch = useQuery(PALETTE_SEARCH_SKILLS, {
    skip: !searching || !visibleById.has("skills"),
    variables: searchVariables,
  });

  const searchPending =
    term.length >= SEARCH_MIN_CHARS &&
    (debouncing ||
      agentsSearch.loading ||
      sessionsSearch.loading ||
      projectsSearch.loading ||
      promptsSearch.loading ||
      contextsSearch.loading ||
      skillsSearch.loading);

  interface SearchGroupView {
    key: string;
    heading: string;
    icon: LucideIcon;
    items: { id: string; label: string; href: string }[];
  }

  const searchGroups: SearchGroupView[] = [];
  if (searching && !searchPending) {
    const named = (data: { items?: PaletteNamedItem[] } | undefined) =>
      data?.items ?? [];
    const pushGroup = (
      key: string,
      ownerId: string,
      heading: string,
      items: { id: string; label: string; href: string }[],
    ) => {
      const owner = visibleById.get(ownerId);
      if (owner && items.length > 0) {
        searchGroups.push({ key, heading, icon: owner.icon, items });
      }
    };

    pushGroup(
      "agents",
      "agents",
      t("palette.search.agents"),
      named(agentsSearch.data?.agentsPagination).map((item) => ({
        id: item.id,
        label: item.name ?? item.id,
        href: `/agents/edit/${item.id}`,
      })),
    );
    pushGroup(
      "sessions",
      "chat",
      t("palette.search.chatSessions"),
      ((sessionsSearch.data?.agent_sessionsPagination?.items ??
        []) as PaletteSessionItem[])
        .filter((item) => Boolean(item.agent))
        .map((item) => ({
          id: item.id,
          label: item.title || t("palette.untitledSession"),
          href: `/chat/${item.agent}/${item.id}`,
        })),
    );
    pushGroup(
      "projects",
      "projects",
      t("palette.search.projects"),
      named(projectsSearch.data?.projectsPagination).map((item) => ({
        id: item.id,
        label: item.name ?? item.id,
        href: `/projects/${item.id}`,
      })),
    );
    pushGroup(
      "prompts",
      "prompts",
      t("palette.search.prompts"),
      named(promptsSearch.data?.prompt_libraryPagination).map((item) => ({
        id: item.id,
        label: item.name ?? item.id,
        href: `/prompts/${item.id}`,
      })),
    );
    pushGroup(
      "contexts",
      "knowledge",
      t("palette.search.knowledgeContexts"),
      ((contextsSearch.data?.contexts?.items ?? []) as PaletteNamedItem[])
        // The contexts resolver has no filter args — substring-match here.
        .filter((item) =>
          (item.name ?? "")
            .toLocaleLowerCase()
            .includes(debounced.toLocaleLowerCase()),
        )
        .slice(0, SEARCH_PAGE_SIZE)
        .map((item) => ({
          id: item.id,
          label: item.name ?? item.id,
          href: `/data/${item.id}`,
        })),
    );
    pushGroup(
      "skills",
      "skills",
      t("palette.search.skills"),
      named(skillsSearch.data?.skillsPagination).map((item) => ({
        id: item.id,
        label: item.name ?? item.id,
        href: `/skills/${item.id}`,
      })),
    );
  }

  /* ---- Preferences ---- */
  interface PreferenceItem {
    id: string;
    label: string;
    icon: LucideIcon;
    run: () => void;
  }
  const preferenceItems: PreferenceItem[] = [
    {
      id: "theme-light",
      label: t("palette.preferences.themeLight"),
      icon: Sun,
      run: () => setTheme("light"),
    },
    {
      id: "theme-dark",
      label: t("palette.preferences.themeDark"),
      icon: Moon,
      run: () => setTheme("dark"),
    },
    {
      id: "theme-system",
      label: t("palette.preferences.themeSystem"),
      icon: Monitor,
      run: () => setTheme("system"),
    },
    ...locales
      .filter((code) => code !== locale)
      .map((code) => {
        const nameKey = LOCALE_NAME_KEYS[code];
        return {
          id: `language-${code}`,
          label: t("language.switchTo", {
            language: nameKey ? t(nameKey) : code.toUpperCase(),
          }),
          icon: Languages,
          run: () => void setLocale(code),
        };
      }),
    {
      id: "toggle-sidebar",
      label: t("palette.preferences.toggleSidebar"),
      icon: PanelLeft,
      run: toggleSidebar,
    },
  ];
  const filteredPreferences = preferenceItems.filter((item) => matches(item.label));

  if (!user) return null;

  const showRecent = recentEntries.length > 0 || recentSessions.length > 0;
  const chatIcon = visibleById.get("chat")?.icon;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="duration-150 ease-in-out motion-reduce:animate-none" />
        {/* Own content composition: §6 row 4 wants fade + scale 0.98→1 in
            150 ms — the shared DialogContent's zoom-95 + slide combo is a
            page-dialog motion, not a summoned-overlay one. */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border bg-popover p-0 text-popover-foreground shadow-lg outline-none",
            "duration-150 ease-in-out data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]",
            "motion-reduce:animate-none",
          )}
        >
          <DialogTitle className="sr-only">{t("palette.title")}</DialogTitle>
          <Command shouldFilter={false} loop>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={t("palette.placeholder")}
            />
            <CommandList className="max-h-[min(420px,60dvh)]">
              {!searchPending ? (
                <CommandEmpty>{t("palette.empty")}</CommandEmpty>
              ) : null}

              {showRecent ? (
                <CommandGroup heading={t("palette.groups.recent")}>
                  {recentEntries.map((entry) => (
                    <PaletteRow
                      key={`recent-${entry.id}`}
                      value={`recent-${entry.id}`}
                      icon={entry.icon}
                      label={entryLabel(entry)}
                      suffix={suffixFor(entryGroupLabel(entry), t)}
                      onSelect={() => navigateTo(entry.route as string)}
                    />
                  ))}
                  {recentSessions.map((session) =>
                    chatIcon ? (
                      <PaletteRow
                        key={`recent-session-${session.id}`}
                        value={`recent-session-${session.id}`}
                        icon={chatIcon}
                        label={session.title || t("palette.untitledSession")}
                        suffix={suffixFor(t("palette.search.chatSessions"), t)}
                        onSelect={() =>
                          navigateTo(`/chat/${session.agent}/${session.id}`)
                        }
                      />
                    ) : null,
                  )}
                </CommandGroup>
              ) : null}

              {filteredNavigate.length > 0 ? (
                <CommandGroup heading={t("palette.groups.navigate")}>
                  {filteredNavigate.map((entry) => (
                    <PaletteRow
                      key={`nav-${entry.id}`}
                      value={`nav-${entry.id}`}
                      icon={entry.icon}
                      label={entryLabel(entry)}
                      suffix={suffixFor(entryGroupLabel(entry), t)}
                      onSelect={() =>
                        entry.route !== null
                          ? navigateTo(entry.route)
                          : runAction(() => onSendFeedback?.())
                      }
                    />
                  ))}
                </CommandGroup>
              ) : null}

              {filteredCreate.length > 0 ? (
                <CommandGroup heading={t("palette.groups.create")}>
                  {filteredCreate.map((item) => (
                    <PaletteRow
                      key={`create-${item.id}`}
                      value={`create-${item.id}`}
                      icon={item.owner.icon}
                      label={t(item.i18nKey)}
                      onSelect={() => navigateTo(`${item.route}?new=1`)}
                    />
                  ))}
                </CommandGroup>
              ) : null}

              {searchPending ? (
                <CommandGroup heading={t("palette.groups.search")}>
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex flex-col"
                  >
                    {Array.from({ length: 3 }, (_, index) => (
                      <div
                        key={index}
                        aria-hidden={index > 0}
                        className="flex h-9 items-center px-2 text-sm"
                      >
                        {reducedMotion ? (
                          <span
                            className={
                              index === 0
                                ? "text-muted-foreground"
                                : "invisible"
                            }
                          >
                            {t("palette.searching")}
                          </span>
                        ) : (
                          <ShimmeringText
                            text={t("palette.searching")}
                            color="hsl(var(--muted-foreground))"
                            shimmeringColor="hsl(var(--foreground))"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </CommandGroup>
              ) : null}

              {searchGroups.map((group) => (
                <CommandGroup key={`search-${group.key}`} heading={group.heading}>
                  {group.items.map((item) => (
                    <PaletteRow
                      key={`search-${group.key}-${item.id}`}
                      value={`search-${group.key}-${item.id}`}
                      icon={group.icon}
                      label={item.label}
                      onSelect={() => navigateTo(item.href)}
                    />
                  ))}
                </CommandGroup>
              ))}

              {filteredPreferences.length > 0 ? (
                <CommandGroup heading={t("palette.groups.preferences")}>
                  {filteredPreferences.map((item) => (
                    <PaletteRow
                      key={`pref-${item.id}`}
                      value={`pref-${item.id}`}
                      icon={item.icon}
                      label={item.label}
                      onSelect={() => runAction(item.run)}
                    />
                  ))}
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Row + suffix helpers                                                 */
/* ------------------------------------------------------------------ */

/** "— {group}" muted suffix ("Variables — Administration", §4). */
function suffixFor(
  group: string | null,
  t: ReturnType<typeof useTranslations>,
): string | null {
  return group === null ? null : t("palette.inGroup", { group });
}

function PaletteRow({
  value,
  icon: Icon,
  label,
  suffix,
  onSelect,
}: {
  value: string;
  icon: LucideIcon;
  label: string;
  suffix?: string | null;
  onSelect: () => void;
}) {
  return (
    <CommandItem value={value} onSelect={onSelect} className="gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate">{label}</span>
      {suffix ? (
        <span className="shrink-0 text-xs text-muted-foreground">{suffix}</span>
      ) : null}
    </CommandItem>
  );
}
