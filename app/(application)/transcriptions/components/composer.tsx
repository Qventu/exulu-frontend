"use client";

/**
 * The inline new-transcription composer (page-doc §3 "The composer", inventory
 * items 9–17): file area (Dropzone + gallery dialog), title, and an L3
 * "Options" collapsible (language, speakers, project, sharing) whose defaults
 * are summarized inline so the P1 happy path is exactly: drop file → Start.
 */
import { useMutation } from "@apollo/client";
import { ChevronRight, FileAudio, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Dropzone } from "@/components/primitives/dropzone";
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
import useUppy from "@/hooks/use-uppy";

import { useProjectOptions } from "../hooks";
import { START_TRANSCRIPTION_JOB } from "../queries";
import {
  AUDIO_FILE_TYPES,
  decodeFilename,
  stripExtension,
  type Mode,
  type RbacRole,
  type RbacUser,
} from "../types";
import { FileGalleryDialog } from "./file-gallery-dialog";

const LANGUAGES = ["en", "de", "fr", "es", "it", "nl", "pt"] as const;
const SPEAKER_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** Teams are offered by RBACControl but the start/finalize inputs carry no
 * teams field — the selection used to evaporate silently (page-doc UX review,
 * inventory 32). Until the backend grows `target_rbac_teams`, the option is
 * not offered: no capability is lost, it never worked. */
const ALLOWED_MODES: Mode[] = ["private", "users", "roles", "public"];

export interface ComposerProps {
  onCancel: () => void;
  onStarted: () => void;
}

export function Composer({ onCancel, onStarted }: ComposerProps) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");

  const [s3Key, setS3Key] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [galleryOpen, setGalleryOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [language, setLanguage] = React.useState<string>("auto");
  const [numSpeakers, setNumSpeakers] = React.useState<string>("auto");
  const [projectId, setProjectId] = React.useState<string>("");
  const [rightsMode, setRightsMode] = React.useState<Mode>("private");
  const [rbacUsers, setRbacUsers] = React.useState<RbacUser[]>([]);
  const [rbacRoles, setRbacRoles] = React.useState<RbacRole[]>([]);
  const [optionsOpen, setOptionsOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const projects = useProjectOptions();
  const [startJob] = useMutation(START_TRANSCRIPTION_JOB);

  // Direct drag-and-drop upload path (the gallery's embedded Uppy Dashboard
  // remains the browse/upload surface — inventory 21). autoProceed uploads the
  // dropped file immediately; success hands back the S3 key like the gallery.
  const uppy = useUppy(
    {
      backend: "",
      uppyOptions: {
        id: "transcriptions-drop",
        allowedFileTypes: [...AUDIO_FILE_TYPES],
      },
      callbacks: {
        uploadSuccess: (data) => {
          const fullKey = data.s3Key || data.key;
          setS3Key(fullKey);
          setUploading(false);
        },
      },
      maxNumberOfFiles: 1,
    },
    [],
  );

  React.useEffect(() => {
    if (!uppy) return;
    const onError = () => {
      setUploading(false);
      toast.error(t("toasts.uploadFailed"));
    };
    uppy.on("upload-error", onError);
    return () => {
      uppy.off("upload-error", onError);
    };
  }, [uppy, t]);

  const handleDroppedFiles = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!uppy) {
      // Uppy still initializing (token fetch) — fall back to the gallery.
      setGalleryOpen(true);
      return;
    }
    try {
      uppy.cancelAll();
      uppy.addFile({ name: file.name, type: file.type, data: file });
      setUploading(true);
    } catch {
      toast.error(t("toasts.uploadFailed"));
    }
  };

  const filename = React.useMemo(
    () => (s3Key ? decodeFilename(s3Key) : ""),
    [s3Key],
  );

  // Autofill the title from the chosen file (gallery or drop-upload path),
  // only while the title is still empty — same behavior as before.
  React.useEffect(() => {
    if (!s3Key) return;
    setTitle((current) =>
      current ? current : stripExtension(decodeFilename(s3Key)),
    );
  }, [s3Key]);

  const canStart = Boolean(s3Key) && !busy && !uploading;

  const onStart = async () => {
    if (!s3Key) return;
    setBusy(true);
    try {
      await startJob({
        variables: {
          input: {
            audio_s3key: s3Key,
            filename,
            title: title || filename,
            language: language === "auto" ? null : language,
            num_speakers: numSpeakers === "auto" ? null : Number(numSpeakers),
            project_id: projectId || null,
            target_rights_mode: rightsMode,
            target_rbac_users: rbacUsers,
            target_rbac_roles: rbacRoles,
          },
        },
      });
      toast.success(t("toasts.started"));
      onStarted();
    } catch (err: unknown) {
      toast.error(t("toasts.startFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  // Inline summary of the L3 defaults so nobody *needs* to open Options
  // ("Auto-detect language and speakers · Private · No project").
  const projectName = projects.find((p) => p.id === projectId)?.name;
  const optionsSummary = [
    language === "auto"
      ? t("composer.autoLanguage")
      : t(`lang.${language}`),
    numSpeakers === "auto"
      ? t("composer.autoSpeakers")
      : t("composer.speakerCount", { count: Number(numSpeakers) }),
    projectName ?? t("composer.noProjectSummary"),
    t(`mode.${rightsMode === "teams" ? "private" : rightsMode}`),
  ].join(" · ");

  return (
    <Card className="space-y-4 p-4 duration-200 animate-in fade-in slide-in-from-top-1 motion-reduce:animate-none">
      <div className="space-y-2">
        <Label>{t("composer.audioFile")}</Label>
        {s3Key || uploading ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 text-sm">
            {uploading ? (
              <Loader2
                aria-hidden="true"
                className="size-4 shrink-0 animate-spin text-muted-foreground"
              />
            ) : (
              <FileAudio
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
            )}
            <span className="min-w-0 flex-1 truncate">
              {uploading ? t("composer.uploading") : filename}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 md:size-8"
              aria-label={t("composer.removeFile")}
              disabled={uploading}
              onClick={() => setS3Key(null)}
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          </div>
        ) : (
          <Dropzone
            label={t("composer.dropLabel")}
            hint={t("composer.dropHint")}
            accept={[...AUDIO_FILE_TYPES]}
            onFiles={handleDroppedFiles}
            onBrowse={() => setGalleryOpen(true)}
          />
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="transcription-title">{t("composer.titleLabel")}</Label>
        <Input
          id="transcription-title"
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("composer.language")}</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
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
              <div className="space-y-2">
                <Label>{t("composer.speakers")}</Label>
                <Select value={numSpeakers} onValueChange={setNumSpeakers}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">
                      {t("composer.autoDetect")}
                    </SelectItem>
                    {SPEAKER_COUNTS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

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

            <div className="space-y-2">
              <Label>{t("composer.sharing")}</Label>
              <RBACControl
                allowedModes={ALLOWED_MODES}
                subjectLabel={t("sharing.subject")}
                initialRightsMode={rightsMode}
                initialUsers={rbacUsers}
                initialRoles={rbacRoles}
                modalMode
                // Teams arg deliberately not consumed — the mode isn't offered
                // (ALLOWED_MODES) and the mutation input carries no teams field.
                onChange={(mode, users, roles) => {
                  setRightsMode(mode);
                  setRbacUsers(users);
                  setRbacRoles(roles);
                }}
              />
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
            <Loader2
              aria-hidden="true"
              className="mr-2 size-4 animate-spin"
            />
          ) : null}
          {t("composer.start")}
        </Button>
      </div>

      <FileGalleryDialog
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        onSelect={setS3Key}
      />
    </Card>
  );
}
