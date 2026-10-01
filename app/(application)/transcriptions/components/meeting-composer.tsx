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
import { useMutation } from "@apollo/client";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { RBACControl } from "@/components/rbac";
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

import {
  resolveNotifyChatSeed,
  usePostProcessingOptions,
  useProjectOptions,
  type ResolvedSetting,
} from "../hooks";
import { MEETING_BOT_START } from "../queries";
import {
  sanitizeRightsMode,
  type ComposerPrimaryAction,
  type Mode,
  type PostProcessingPrompt,
  type RbacRole,
  type RbacUser,
} from "../types";
import { PostProcessingPicker, postProcessingRowsComplete } from "./post-processing-picker";
import { useSeededPostProcessingRows } from "./use-seeded-post-processing-rows";
import { useSeededValue } from "./use-seeded-value";

const ALLOWED_MODES: Mode[] = ["private", "users", "roles", "public"];
const LANGUAGES = ["en", "de", "fr", "es", "it", "nl", "pt"] as const;

export interface MeetingComposerProps {
  onStarted: () => void;
  /** Reports the current Start action so NewTranscriptDialog's shared footer
   *  can render it — the dialog owns Cancel/footer chrome now (Task 9). */
  onPrimaryActionChange: (action: ComposerPrimaryAction) => void;
  /** Workspace summary presets (task-7 brief, Step 4), read once when the
   *  dialog opens — pre-checked here but still freely removable for this one
   *  meeting. */
  defaultPostProcessingPrompts?: PostProcessingPrompt[];
  /** Workspace default sharing mode (final fix wave, Fix 1) — see
   *  composer.tsx's identical prop for the full rationale. */
  defaultRightsMode?: string | null;
  /** The resolved `notifyChat` setting, source included (final fix wave,
   *  Fix 3) — see `resolveNotifyChatSeed` in hooks.ts for why the source
   *  matters, not just the value. */
  defaultNotifyChat?: ResolvedSetting<boolean | null>;
  /** Whether a recorder may override the workspace's bot name / recording
   *  notice at all (final fix wave, Fix 2 — settings design doc §5's
   *  "Meeting bot" section). When false, `bot-identity.ts` ignores whatever
   *  this composer would send; defaults to true (the resolved setting's own
   *  code-level default) while settings haven't loaded yet. */
  recordersMayOverrideBot?: boolean;
  /** The workspace's own bot name, shown in place of the input when
   *  `recordersMayOverrideBot` is false (Fix 2) so the recorder can see what
   *  name is actually going to be used instead of just losing the field. */
  workspaceBotName?: string | null;
}

export function MeetingComposer({
  onStarted,
  onPrimaryActionChange,
  defaultPostProcessingPrompts,
  defaultRightsMode,
  defaultNotifyChat,
  recordersMayOverrideBot = true,
  workspaceBotName,
}: MeetingComposerProps) {
  const t = useTranslations("transcriptions");

  const [meetingUrl, setMeetingUrl] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [joinMode, setJoinMode] = React.useState<"now" | "schedule">("now");
  const [joinAt, setJoinAt] = React.useState("");
  const [language, setLanguage] = React.useState("auto");
  const [botName, setBotName] = React.useState("");
  // Defaults ON (2026-09-22): a bot sitting unannounced in a Teams waiting
  // room is the leading cause of "bot finished without a recording" — nobody
  // in the meeting knows to admit it. The chat message is the only cue.
  //
  // Final fix wave, Fix 3: this used to be a hard `React.useState(true)` that
  // always sent an explicit boolean, so the workspace `notifyChat` setting
  // could never reach the product's own UI. It is now seeded from that
  // setting (same once-never-clobber discipline as the other seeded fields),
  // but through resolveNotifyChatSeed rather than the raw resolved value —
  // that function is what actually preserves the default-ON intent above for
  // a deployment that hasn't touched this setting; see its docstring in
  // hooks.ts before changing either side of this seam.
  const [notifyChat, setNotifyChat] = useSeededValue<boolean>(
    resolveNotifyChatSeed(defaultNotifyChat),
    true,
  );
  const [projectId, setProjectId] = React.useState("");
  // Seeded from the workspace default (final fix wave, Fix 1) — see
  // composer.tsx's identical seeding for the full rationale.
  const [rightsMode, setRightsMode] = useSeededValue<Mode>(
    sanitizeRightsMode(defaultRightsMode, ALLOWED_MODES),
    "private",
  );
  const [rbacUsers, setRbacUsers] = React.useState<RbacUser[]>([]);
  const [rbacRoles, setRbacRoles] = React.useState<RbacRole[]>([]);
  // Seeded from the workspace defaults, re-synced at most once if they
  // hadn't loaded yet at mount, never once the admin edits a row
  // (use-seeded-post-processing-rows.ts) — task-7 brief, Step 4. Still fully
  // removable: the user can delete any or all rows before starting.
  const [ppRows, setPpRows] = useSeededPostProcessingRows(defaultPostProcessingPrompts);
  const [optionsOpen, setOptionsOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const projects = useProjectOptions();
  const { prompts, agents } = usePostProcessingOptions();

  const [startBot] = useMutation(MEETING_BOT_START);

  const canStart =
    meetingUrl.trim().length > 0 &&
    !busy &&
    (joinMode === "now" || joinAt.length > 0) &&
    // Every post-processing row must be fully specified before we send it.
    postProcessingRowsComplete(ppRows);

  const onStart = React.useCallback(async () => {
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
  }, [
    meetingUrl,
    startBot,
    joinMode,
    joinAt,
    language,
    title,
    botName,
    notifyChat,
    projectId,
    rightsMode,
    rbacUsers,
    rbacRoles,
    ppRows,
    t,
    onStarted,
  ]);

  // The dialog's shared footer owns the actual button; this just keeps it in
  // sync with what Start would currently do.
  React.useEffect(() => {
    onPrimaryActionChange({
      label: t("composer.startMeeting"),
      disabled: !canStart,
      busy,
      run: onStart,
    });
  }, [canStart, busy, onStart, onPrimaryActionChange, t]);

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
    <div className="space-y-4">
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
        <CollapsibleTrigger
          className="group flex min-h-9 w-full items-center gap-2 rounded-md text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`${t("composer.optionsSummaryLabel")}: ${optionsSummary}`}
        >
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
          />
          <span className="min-w-0 flex-1 truncate font-normal text-muted-foreground">
            {optionsSummary}
          </span>
          <span className="shrink-0 font-medium text-foreground group-hover:underline">
            {t("composer.optionsChange")}
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

            {/* Bot name + notify in chat — final fix wave, Fix 2. When the
                workspace has turned off recordersMayOverrideBot,
                bot-identity.ts ignores whatever this composer would send for
                both fields; showing the inputs anyway let a recorder type a
                bot name the backend silently discarded. Hide both and show
                the workspace values that are actually going to be used,
                straight off the resolved setting (not the ON-by-default
                seed above) so this is the literal truth, not the UX
                default. */}
            {recordersMayOverrideBot ? (
              <>
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
              </>
            ) : (
              <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                <p>{t("composer.botIdentityLockedHint")}</p>
                <p>
                  {t("composer.botIdentityLockedName", {
                    botName: workspaceBotName || t("composer.botNamePlaceholder"),
                  })}
                </p>
                <p>
                  {defaultNotifyChat?.value
                    ? t("composer.botIdentityLockedNotifyOn")
                    : t("composer.botIdentityLockedNotifyOff")}
                </p>
              </div>
            )}

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
            <PostProcessingPicker
              rows={ppRows}
              onChange={setPpRows}
              prompts={prompts}
              agents={agents}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
