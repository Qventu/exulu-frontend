"use client";

/**
 * The "Record a meeting" composer: paste a meeting URL, choose when the Recall
 * bot joins (now or scheduled), set project + sharing, and optionally attach
 * post-processing prompts (prompt from the library + an explicitly chosen agent)
 * that auto-run when the transcript is ready.
 *
 * Mirrors the audio Composer's shape: required field on top, an "Options"
 * collapsible for the rest, defaults summarized inline.
 *
 * Design doc: docs/superpowers/specs/2026-06-19-recall-meeting-recording-design.md
 */
import { useMutation, useQuery } from "@apollo/client";
import { ChevronRight, Loader2, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { RBACControl } from "@/components/rbac";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { useProjectOptions } from "../hooks";
import {
  GET_PICKER_AGENTS,
  GET_PROMPT_LIBRARY,
  MEETING_BOT_START,
} from "../queries";
import {
  type Mode,
  type PostProcessingPrompt,
  type RbacRole,
  type RbacUser,
} from "../types";

const ALLOWED_MODES: Mode[] = ["private", "users", "roles", "public"];
const LANGUAGES = ["en", "de", "fr", "es", "it", "nl", "pt"] as const;

type PromptOption = { id: string; name: string; description?: string | null };
type AgentOption = { id: string; name: string };

export interface MeetingComposerProps {
  onCancel: () => void;
  onStarted: () => void;
}

export function MeetingComposer({ onCancel, onStarted }: MeetingComposerProps) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");

  const [meetingUrl, setMeetingUrl] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [joinMode, setJoinMode] = React.useState<"now" | "schedule">("now");
  const [joinAt, setJoinAt] = React.useState("");
  const [language, setLanguage] = React.useState("auto");
  const [botName, setBotName] = React.useState("");
  const [notifyChat, setNotifyChat] = React.useState(false);
  const [projectId, setProjectId] = React.useState("");
  const [rightsMode, setRightsMode] = React.useState<Mode>("private");
  const [rbacUsers, setRbacUsers] = React.useState<RbacUser[]>([]);
  const [rbacRoles, setRbacRoles] = React.useState<RbacRole[]>([]);
  // Post-processing rows start empty (no defaults — user opts in per meeting).
  const [ppRows, setPpRows] = React.useState<PostProcessingPrompt[]>([]);
  const [optionsOpen, setOptionsOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const projects = useProjectOptions();
  const { data: promptsData } = useQuery<{
    prompt_libraryPagination: { items: PromptOption[] };
  }>(GET_PROMPT_LIBRARY);
  const { data: agentsData } = useQuery<{
    agentsPagination: { items: AgentOption[] };
  }>(GET_PICKER_AGENTS);
  const prompts = promptsData?.prompt_libraryPagination?.items ?? [];
  const agents = agentsData?.agentsPagination?.items ?? [];

  const [startBot] = useMutation(MEETING_BOT_START);

  const canStart =
    meetingUrl.trim().length > 0 &&
    !busy &&
    (joinMode === "now" || joinAt.length > 0) &&
    // Every post-processing row must be fully specified before we send it.
    ppRows.every((r) => r.prompt_id && r.agent_id);

  const addPpRow = () =>
    setPpRows((rows) => [...rows, { prompt_id: "", agent_id: "" }]);
  const removePpRow = (index: number) =>
    setPpRows((rows) => rows.filter((_, i) => i !== index));
  const updatePpRow = (index: number, patch: Partial<PostProcessingPrompt>) =>
    setPpRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );

  const onStart = async () => {
    if (!meetingUrl.trim()) return;
    setBusy(true);
    try {
      await startBot({
        variables: {
          input: {
            meeting_url: meetingUrl.trim(),
            join_at:
              joinMode === "schedule" && joinAt
                ? new Date(joinAt).toISOString()
                : null,
            language: language === "auto" ? null : language,
            title: title || null,
            bot_name: botName || null,
            notify_chat: notifyChat,
            project_id: projectId || null,
            target_rights_mode: rightsMode,
            target_rbac_users: rbacUsers,
            target_rbac_roles: rbacRoles,
            post_processing_prompts: ppRows.filter(
              (r) => r.prompt_id && r.agent_id,
            ),
          },
        },
      });
      toast.success(t("toasts.meetingStarted"));
      onStarted();
    } catch (err: unknown) {
      toast.error(t("toasts.meetingStartFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const projectName = projects.find((p) => p.id === projectId)?.name;
  const optionsSummary = [
    joinMode === "now" ? t("composer.joinNow") : t("composer.joinSchedule"),
    language === "auto" ? t("composer.autoLanguage") : t(`lang.${language}`),
    projectName ?? t("composer.noProjectSummary"),
    t(`mode.${rightsMode === "teams" ? "private" : rightsMode}`),
    ppRows.length > 0
      ? `${t("composer.postProcessing")} (${ppRows.length})`
      : t("composer.postProcessing"),
  ].join(" · ");

  return (
    <Card className="space-y-4 p-4 duration-200 animate-in fade-in slide-in-from-top-1 motion-reduce:animate-none">
      <div className="space-y-2">
        <Label htmlFor="meeting-url">{t("composer.meetingUrl")}</Label>
        <Input
          id="meeting-url"
          value={meetingUrl}
          onChange={(event) => setMeetingUrl(event.target.value)}
          placeholder={t("composer.meetingUrlPlaceholder")}
          inputMode="url"
          className="text-base md:text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="meeting-title">{t("composer.titleLabel")}</Label>
        <Input
          id="meeting-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("composer.titlePlaceholder")}
          className="text-base md:text-sm"
        />
      </div>

      <Collapsible open={optionsOpen} onOpenChange={setOptionsOpen}>
        <CollapsibleTrigger className="group flex min-h-9 w-full items-center gap-2 rounded-md text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90 motion-reduce:transition-none"
          />
          <span>{t("composer.options")}</span>
          <span className="min-w-0 flex-1 truncate text-right text-xs font-normal text-muted-foreground">
            {optionsSummary}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
          <div className="space-y-4 pt-4">
            {/* Join timing */}
            <div className="space-y-2">
              <Label>{t("composer.joinTiming")}</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={joinMode}
                  onValueChange={(value) =>
                    setJoinMode(value as "now" | "schedule")
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="now">{t("composer.joinNow")}</SelectItem>
                    <SelectItem value="schedule">
                      {t("composer.joinSchedule")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {joinMode === "schedule" && (
                  <Input
                    type="datetime-local"
                    aria-label={t("composer.joinAt")}
                    value={joinAt}
                    onChange={(event) => setJoinAt(event.target.value)}
                    className="w-56 text-base md:text-sm"
                  />
                )}
              </div>
            </div>

            {/* Transcription language */}
            <div className="space-y-2">
              <Label>{t("composer.language")}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    {t("composer.autoDetect")}
                  </SelectItem>
                  {LANGUAGES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {t(`lang.${code}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bot name */}
            <div className="space-y-2">
              <Label htmlFor="bot-name">{t("composer.botName")}</Label>
              <Input
                id="bot-name"
                value={botName}
                onChange={(event) => setBotName(event.target.value)}
                placeholder={t("composer.botNamePlaceholder")}
                className="text-base md:text-sm"
              />
            </div>

            {/* Notify in chat */}
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="notify-chat" className="font-normal">
                {t("composer.notifyChat")}
              </Label>
              <Switch
                id="notify-chat"
                checked={notifyChat}
                onCheckedChange={setNotifyChat}
              />
            </div>

            {/* Project */}
            <div className="space-y-2">
              <Label>{t("composer.project")}</Label>
              <Select
                value={projectId || "none"}
                onValueChange={(value) =>
                  setProjectId(value === "none" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("composer.noProject")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("composer.noProject")}</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sharing */}
            <div className="space-y-2">
              <Label>{t("composer.sharing")}</Label>
              <RBACControl
                allowedModes={ALLOWED_MODES}
                subjectLabel={t("sharing.subject")}
                initialRightsMode={rightsMode}
                initialUsers={rbacUsers}
                initialRoles={rbacRoles}
                modalMode
                onChange={(mode, users, roles) => {
                  setRightsMode(mode);
                  setRbacUsers(users);
                  setRbacRoles(roles);
                }}
              />
            </div>

            {/* Post-processing prompts */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("composer.postProcessing")}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addPpRow}
                  className="max-md:h-11"
                >
                  <Plus aria-hidden="true" className="mr-1 size-4" />
                  {t("composer.addPrompt")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("composer.postProcessingHint")}
              </p>
              <div className="space-y-2">
                {ppRows.map((row, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={row.prompt_id}
                      onValueChange={(value) =>
                        updatePpRow(index, { prompt_id: value })
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t("composer.selectPrompt")} />
                      </SelectTrigger>
                      <SelectContent>
                        {prompts.map((prompt) => (
                          <SelectItem key={prompt.id} value={prompt.id}>
                            {prompt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={row.agent_id}
                      onValueChange={(value) =>
                        updatePpRow(index, { agent_id: value })
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t("composer.selectAgent")} />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0"
                      aria-label={t("composer.removePrompt")}
                      onClick={() => removePpRow(index)}
                    >
                      <X aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={busy}
          className="max-md:h-11"
        >
          {tCommon("cancel")}
        </Button>
        <Button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className="max-md:h-11"
        >
          {busy ? (
            <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
          ) : null}
          {t("composer.startMeeting")}
        </Button>
      </div>
    </Card>
  );
}
