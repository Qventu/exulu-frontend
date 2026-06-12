"use client";

/**
 * PromptEditorModal — create + edit (work item 2.9; prompts.md inventory
 * items 44–53, ladder L3; embedding contract preserved for the agents
 * PromptBrowserSheet (item 70 — the only caller that passes both
 * `defaultTags` AND `defaultAssignedAgents`)).
 *
 * Sectioned per prompts.md §3 "Editor dialog (L3)":
 * - Essentials  : name, content (mode toggle + variable detection), description
 * - Organize    : tags (max 5 enforced — L3) + agent assignment
 * - Sharing     : RBACControl in a Collapsible, defaults closed (teams now
 *                 plumbed correctly — fixes H4)
 * - Change note : only when editing
 *
 * Fixes preserved verbatim from the legacy version:
 * - Squash + 50-cap version history (extracted to
 *   `lib/prompts/build-version-history.ts` for testability — inventory item
 *   44 machinery, prompts.md §4 "extract version-building").
 * - Variable validation (invalid names block submit, inline error).
 *
 * Embedding API kept STABLE — `PromptBrowserSheet` (agents edit page,
 * item 70) imports this file and passes `defaultTags` +
 * `defaultAssignedAgents`. Any prop renames would break the agents page.
 */

import { useMutation, useQuery } from "@apollo/client";
import { Check, ChevronsUpDown, FileCode, Lightbulb, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RBACControl } from "@/components/rbac";
import { MarkdownEditor } from "@/components/primitives/markdown-editor";
import { TagSelector } from "@/components/tag-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { buildVersionHistory } from "@/lib/prompts";
import { extractVariables, validatePromptVariables } from "@/lib/prompts";
import { cn } from "@/lib/utils";
import { GET_AGENTS } from "@/queries/queries";
import type { PromptLibrary } from "@/types/models/prompt-library";
import type { UserWithRole } from "@/types/models/user";

import {
  CREATE_PROMPT_INDEX,
  GET_UNIQUE_PROMPT_TAGS_INDEX,
  PROMPTS_RBAC_TEAMS_SUPPORTED,
  UPDATE_PROMPT_INDEX,
} from "../queries";

const MAX_TAGS = 5;

type RightsMode = "private" | "users" | "roles" | "teams" | "public";

/**
 * RBACControl `allowedModes` when teams are not supported by the backend
 * (PROMPTS_RBAC_TEAMS_SUPPORTED = false). Mirrors the agents editor's
 * ALLOWED_MODES_NO_TEAMS constant — see agents/edit/[id]/sections/access.tsx.
 */
const ALLOWED_MODES_NO_TEAMS = ["private", "users", "roles", "public"] as const;

interface RbacUser {
  id: number;
  rights: "read" | "write";
}
interface RbacRoleOrTeam {
  id: string;
  rights: "read" | "write";
}

export interface PromptEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt?: PromptLibrary;
  defaultTags?: string[];
  defaultAssignedAgents?: string[];
  onSuccess: () => void;
  user: UserWithRole;
}

export function PromptEditorModal({
  open,
  onOpenChange,
  prompt,
  defaultTags,
  defaultAssignedAgents = [],
  onSuccess,
  user,
}: PromptEditorModalProps) {
  const t = useTranslations("prompts");
  const tCommon = useTranslations("common");
  const isEditing = !!prompt;

  // refetchQueries: ONLY the unique-tags query. The list query
  // (GET_PROMPTS_INDEX) is refetched by the parent's `onSuccess → refetch()`
  // path (prompts-view.tsx) with the user's active filters/sort/page —
  // refetching it here with a hardcoded `{ page: 1, limit: 50 }` and no
  // filters/sort would trigger a second network round-trip whose cache entry
  // no consumer reads (Apollo matches refetchQueries by exact variables). The
  // tags query has no variables, so refetching it here is safe and necessary
  // when a created prompt introduces a new tag.
  const [createPrompt, { loading: creating }] = useMutation(CREATE_PROMPT_INDEX, {
    refetchQueries: [{ query: GET_UNIQUE_PROMPT_TAGS_INDEX }],
  });
  const [updatePrompt, { loading: updating }] = useMutation(
    UPDATE_PROMPT_INDEX,
  );

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>(defaultTags ?? []);
  const [rightsMode, setRightsMode] = useState<RightsMode>("private");
  const [rbacUsers, setRbacUsers] = useState<RbacUser[]>([]);
  const [rbacRoles, setRbacRoles] = useState<RbacRoleOrTeam[]>([]);
  const [rbacTeams, setRbacTeams] = useState<RbacRoleOrTeam[]>([]);
  const [sharingOpen, setSharingOpen] = useState(false);
  const [assignedAgents, setAssignedAgents] = useState<string[]>([]);
  const [agentSelectorOpen, setAgentSelectorOpen] = useState(false);
  const [changeMessage, setChangeMessage] = useState("");
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);

  // Agents popover (max 100 — same shape as the legacy implementation).
  const { data: agentsData } = useQuery(GET_AGENTS, {
    variables: { page: 1, limit: 100 },
  });
  const agents: Array<{ id: string; name: string }> =
    agentsData?.agentsPagination?.items ?? [];

  // Derived
  const variables = extractVariables(content);
  const { isValid, invalidVariables } = validatePromptVariables(content);

  // Initialize / reset whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (prompt) {
      setName(prompt.name);
      setDescription(prompt.description ?? "");
      setContent(prompt.content);
      setTags(prompt.tags ?? defaultTags ?? []);
      setRightsMode(prompt.rights_mode as RightsMode);
      setRbacUsers((prompt.RBAC?.users as RbacUser[]) ?? []);
      setRbacRoles((prompt.RBAC?.roles as RbacRoleOrTeam[]) ?? []);
      // Teams: fixes H4 — the legacy form NEVER re-hydrated teams selections
      // (only users/roles), so teams-shared prompts dropped them on save.
      // Read from the existing RBAC payload if present (the cast covers the
      // shared field type that excludes teams; see PromptLibrary.RBAC).
      const persistedTeams =
        (prompt.RBAC as { teams?: RbacRoleOrTeam[] } | undefined)?.teams ?? [];
      setRbacTeams(persistedTeams);
      setAssignedAgents(prompt.assigned_agents ?? []);
      setSharingOpen(false);
      setChangeMessage("");
    } else {
      setName("");
      setDescription("");
      setContent("");
      setRightsMode("private");
      setRbacUsers([]);
      setRbacRoles([]);
      setRbacTeams([]);
      setSharingOpen(false);
      setChangeMessage("");
      setAssignedAgents(
        defaultAssignedAgents.length > 0 ? defaultAssignedAgents : [],
      );
      // PromptBrowserSheet seeds "untagged" — explicitly strip it (legacy
      // behavior, see editor's old initializer at :124).
      const seededTags =
        defaultTags && defaultTags.length > 0
          ? defaultTags.filter((tag) => tag !== "untagged")
          : [];
      setTags(seededTags);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prompt?.id]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t("editor.nameRequired"));
      return;
    }
    if (!content.trim()) {
      toast.error(t("editor.contentRequired"));
      return;
    }
    if (!isValid) {
      toast.error(
        t("editor.invalidVariables", { names: invalidVariables.join(", ") }),
      );
      return;
    }
    if (tags.length > MAX_TAGS) {
      toast.error(t("editor.tooManyTags", { max: MAX_TAGS }));
      return;
    }

    const useScopedRbac =
      rightsMode === "users" ||
      rightsMode === "roles" ||
      rightsMode === "teams";

    // Build the RBAC payload — teams are gated behind
    // PROMPTS_RBAC_TEAMS_SUPPORTED. When false (the default), `teams` is
    // omitted from the mutation entirely; otherwise sending it would crash
    // the request with the same "Cannot query field 'teams' on type
    // 'RBACData'" error agents 2.8 hit during introspection.
    const RBAC = useScopedRbac
      ? {
          users: rbacUsers.length > 0 ? rbacUsers : undefined,
          roles: rbacRoles.length > 0 ? rbacRoles : undefined,
          ...(PROMPTS_RBAC_TEAMS_SUPPORTED
            ? { teams: rbacTeams.length > 0 ? rbacTeams : undefined }
            : {}),
        }
      : undefined;

    const trimmedDescription = description.trim();
    const baseInput = {
      name: name.trim(),
      description: trimmedDescription || undefined,
      content: content.trim(),
      tags: tags.length > 0 ? tags : undefined,
      rights_mode: rightsMode,
      RBAC,
      assigned_agents: assignedAgents.length > 0 ? assignedAgents : undefined,
    };

    try {
      if (isEditing && prompt) {
        const nextHistory = buildVersionHistory({
          prompt,
          next: {
            content: baseInput.content,
            name: baseInput.name,
            description: trimmedDescription || undefined,
            tags: baseInput.tags,
          },
          userId: user.id.toString(),
          changeMessage,
        });

        await updatePrompt({
          variables: {
            id: prompt.id,
            ...baseInput,
            // Only send history when actually changed (matches legacy intent;
            // sending the existing array is also safe — the server diffs).
            history: nextHistory ?? prompt.history,
          },
        });
        toast.success(t("editor.updateSuccess"));
      } else {
        await createPrompt({ variables: baseInput });
        toast.success(t("editor.createSuccess"));
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(
        isEditing ? t("editor.updateFailed") : t("editor.createFailed"),
      );
    }
  };

  const submitDisabled =
    creating ||
    updating ||
    !name.trim() ||
    !content.trim() ||
    !isValid ||
    tags.length > MAX_TAGS;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && (creating || updating)) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[85dvh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4 text-left">
          <DialogTitle>
            {isEditing ? t("editor.editTitle") : t("editor.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t("editor.editSubtitle")
              : t("editor.createSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-8">
            {/* ------------------------- Essentials ------------------------- */}
            <section className="space-y-5">
              <h3 className="text-sm font-semibold text-foreground">
                {t("editor.essentialsTitle")}
              </h3>

              <div className="space-y-2">
                <Label htmlFor="prompt-name">
                  {tCommon("name")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prompt-name"
                  placeholder={t("editor.namePlaceholder")}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="text-base sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="prompt-content">
                    {t("editor.contentLabel")}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMarkdownMode((v) => !v)}
                    className="h-8 gap-2"
                  >
                    <FileCode aria-hidden="true" className="size-3.5" />
                    {isMarkdownMode
                      ? t("editor.plainText")
                      : t("editor.richText")}
                  </Button>
                </div>

                {isMarkdownMode ? (
                  <MarkdownEditor
                    value={content}
                    onChange={setContent}
                    placeholder={t("editor.contentPlaceholder")}
                    height={400}
                    preview="live"
                  />
                ) : (
                  <Textarea
                    id="prompt-content"
                    placeholder={t("editor.contentPlaceholder")}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                  />
                )}

                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Lightbulb
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0"
                  />
                  <span>
                    {t("editor.contentHint")}
                    {isMarkdownMode ? ` ${t("editor.markdownHint")}` : ""}
                  </span>
                </div>

                {variables.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="mr-1 text-xs text-muted-foreground">
                      {t("editor.detectedVariables")}
                    </span>
                    {variables.map((variable) => (
                      <Badge
                        key={variable}
                        variant="secondary"
                        className="font-mono text-xs"
                      >
                        {variable}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {!isValid ? (
                  <p role="alert" className="text-xs text-destructive">
                    {t("editor.invalidVariables", {
                      names: invalidVariables.join(", "),
                    })}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt-description">
                  {tCommon("description")}
                </Label>
                <Input
                  id="prompt-description"
                  placeholder={t("editor.descriptionPlaceholder")}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="text-base sm:text-sm"
                />
              </div>
            </section>

            {/* ------------------------- Organize -------------------------- */}
            <section className="space-y-5">
              <h3 className="text-sm font-semibold text-foreground">
                {t("editor.organizeTitle")}
              </h3>

              <div className="space-y-2">
                <Label>{t("editor.tagsLabel")}</Label>
                <TagSelector
                  value={tags}
                  onChange={setTags}
                  placeholder={t("editor.tagsPlaceholder")}
                />
                <p
                  className={cn(
                    "text-xs",
                    tags.length > MAX_TAGS
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {t("editor.tagsHint", { max: MAX_TAGS })}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t("editor.agentsLabel")}</Label>
                <Popover
                  modal={true}
                  open={agentSelectorOpen}
                  onOpenChange={setAgentSelectorOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={agentSelectorOpen}
                      className="w-full justify-between"
                    >
                      {assignedAgents.length === 0
                        ? t("editor.agentsPlaceholder")
                        : t("editor.agentsCount", {
                            count: assignedAgents.length,
                          })}
                      <ChevronsUpDown
                        aria-hidden="true"
                        className="ml-2 size-4 shrink-0 opacity-50"
                      />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput
                        placeholder={t("editor.searchAgentsPlaceholder")}
                      />
                      <CommandList>
                        <CommandEmpty>{t("editor.noAgentsFound")}</CommandEmpty>
                        <CommandGroup>
                          {agents.map((agent) => (
                            <CommandItem
                              key={agent.id}
                              value={agent.id}
                              onSelect={() =>
                                setAssignedAgents((prev) =>
                                  prev.includes(agent.id)
                                    ? prev.filter((id) => id !== agent.id)
                                    : [...prev, agent.id],
                                )
                              }
                            >
                              <Check
                                aria-hidden="true"
                                className={cn(
                                  "mr-2 size-4",
                                  assignedAgents.includes(agent.id)
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              {agent.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {assignedAgents.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {assignedAgents.map((agentId) => {
                      const agent = agents.find((a) => a.id === agentId);
                      return agent ? (
                        <Badge
                          key={agentId}
                          variant="secondary"
                          className="text-sm"
                        >
                          {agent.name}
                          <button
                            type="button"
                            onClick={() =>
                              setAssignedAgents((prev) =>
                                prev.filter((id) => id !== agentId),
                              )
                            }
                            className="ml-1.5 inline-flex items-center hover:text-destructive"
                            aria-label={t("editor.removeAgent", {
                              name: agent.name,
                            })}
                          >
                            <X aria-hidden="true" className="size-3" />
                          </button>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {t("editor.agentsHint")}
                </p>
              </div>
            </section>

            {/* -------------------------- Sharing -------------------------- */}
            <section className="space-y-2">
              <Collapsible open={sharingOpen} onOpenChange={setSharingOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                  >
                    <span className="font-medium">
                      {t("editor.sharingTitle")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {sharingSummary({
                        rightsMode,
                        rbacUsers,
                        rbacRoles,
                        rbacTeams,
                        t,
                      })}
                    </span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <RBACControl
                    initialRightsMode={rightsMode}
                    initialUsers={rbacUsers}
                    initialRoles={rbacRoles}
                    initialTeams={rbacTeams}
                    modalMode={true}
                    subjectLabel={t("editor.subjectLabel")}
                    // Teams mode is hidden until backend support lands —
                    // see PROMPTS_RBAC_TEAMS_SUPPORTED in ../queries.ts.
                    allowedModes={
                      PROMPTS_RBAC_TEAMS_SUPPORTED
                        ? undefined
                        : (ALLOWED_MODES_NO_TEAMS as unknown as Array<
                            "private" | "users" | "roles" | "teams" | "public"
                          >)
                    }
                    onChange={(mode, users, roles, teams) => {
                      setRightsMode(mode);
                      setRbacUsers(users);
                      setRbacRoles(roles);
                      setRbacTeams(
                        PROMPTS_RBAC_TEAMS_SUPPORTED ? (teams ?? []) : [],
                      );
                    }}
                  />
                </CollapsibleContent>
              </Collapsible>
            </section>

            {/* ------------------------- Change note ----------------------- */}
            {isEditing ? (
              <section className="space-y-2 border-t border-border pt-5">
                <Label htmlFor="prompt-change-message">
                  {t("editor.changeMessageLabel")}
                </Label>
                <Textarea
                  id="prompt-change-message"
                  placeholder={t("editor.changeMessagePlaceholder")}
                  value={changeMessage}
                  onChange={(event) => setChangeMessage(event.target.value)}
                  rows={2}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {t("editor.changeMessageHint")}
                </p>
              </section>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creating || updating}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitDisabled}
            aria-busy={creating || updating}
          >
            {creating || updating
              ? t("editor.saving")
              : isEditing
                ? tCommon("save")
                : t("editor.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function sharingSummary({
  rightsMode,
  rbacUsers,
  rbacRoles,
  rbacTeams,
  t,
}: {
  rightsMode: RightsMode;
  rbacUsers: RbacUser[];
  rbacRoles: RbacRoleOrTeam[];
  rbacTeams: RbacRoleOrTeam[];
  t: (key: string, values?: Record<string, string | number>) => string;
}): string {
  switch (rightsMode) {
    case "private":
      return t("access.private");
    case "public":
      return t("access.public");
    case "users":
      return t("editor.summary.users", { count: rbacUsers.length });
    case "roles":
      return t("editor.summary.roles", { count: rbacRoles.length });
    case "teams":
      // Teams is gated behind PROMPTS_RBAC_TEAMS_SUPPORTED — when the flag is
      // off (current default), this branch is unreachable from the editor's
      // own selector (allowedModes excludes "teams"). It can still be reached
      // by editing a prompt that already has a teams rights_mode in the
      // database; render the count from rbacTeams when flagged on, otherwise
      // fall back to the generic unknown copy so we don't pretend we
      // round-trip it correctly.
      return PROMPTS_RBAC_TEAMS_SUPPORTED
        ? t("editor.summary.teams", { count: rbacTeams.length })
        : t("access.unknown");
    default:
      return t("access.unknown");
  }
}
