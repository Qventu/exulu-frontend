"use client";

/**
 * CreateSkillDialog — blank vs upload create (work item 2.10; skills.md §3
 * "Create dialog" + inventory items 31-40).
 *
 * Replaces the legacy inline dialog in skills/page.tsx:
 * - Mode toggle uses shadcn <Tabs> (was a div+button grid — keyboard/ARIA
 *   correctness, ladder #31).
 * - Upload mode uses the shared <Dropzone /> primitive (#32; .zip / .md).
 * - Access uses <RBACControl modalMode> with allowedModes excluding "teams",
 *   replacing the legacy plain Select that mislabeled "users" as "All Users"
 *   and dropped the RBAC payload entirely (fixes H9/M5; ladder #36).
 * - Reset on close (#40), cancel + "Create & Open" footer (#39).
 *
 * Blank flow: CREATE_SKILL → skillsApi.init seeds templated SKILL.md →
 *   onCreated → caller navigates to /skills/[id].
 * Upload flow: CREATE_SKILL → skillsApi.uploadSign → S3 PUT → initFromUpload.
 *   Documented failure mode (#38) preserved: empty skill row survives a
 *   failed extract so the user can retry from the editor.
 */

import { FileArchive, Loader2, Plus, Sparkles, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Dropzone } from "@/components/primitives/dropzone";
import { RBACControl } from "@/components/rbac";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { skillsApi } from "@/lib/api/skills";
import {
  collectFromFileList,
  validateBundleFiles,
  zipFiles,
  readSkillMetaFromZip,
} from "@/lib/skills/bundle";

import { useCreateSkillLocal } from "../hooks";
import { SKILLS_RBAC_TEAMS_SUPPORTED } from "../queries";
import type { Skill, SkillRBACEntry, SkillRightsMode } from "../types";

const ALLOWED_MODES_NO_TEAMS = [
  "private",
  "users",
  "roles",
  "public",
] as const;

export interface CreateSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after S3 init finishes — library navigates to /skills/[id]. */
  onCreated: (skill: Skill) => void;
}

type CreateMode = "blank" | "upload";

export function CreateSkillDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateSkillDialogProps) {
  const t = useTranslations("skills");
  const tCommon = useTranslations("common");

  const [mode, setMode] = React.useState<CreateMode>("blank");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [tagsInput, setTagsInput] = React.useState("");
  const [rightsMode, setRightsMode] = React.useState<SkillRightsMode>("private");
  const [rbacUsers, setRbacUsers] = React.useState<SkillRBACEntry[]>([]);
  const [rbacRoles, setRbacRoles] = React.useState<SkillRBACEntry[]>([]);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const [createSkill] = useCreateSkillLocal();

  const reset = React.useCallback(() => {
    setMode("blank");
    setName("");
    setDescription("");
    setTagsInput("");
    setRightsMode("private");
    setRbacUsers([]);
    setRbacRoles([]);
    setUploadFile(null);
    setSubmitting(false);
  }, []);

  // Reset on open transitions (#40 — full reset whenever the dialog closes).
  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handleFiles = (files: File[]) => {
    const file = files[0] ?? null;
    if (!file) {
      setUploadFile(null);
      return;
    }
    const lower = file.name.toLowerCase();
    if (
      !lower.endsWith(".zip") &&
      !lower.endsWith(".md") &&
      !lower.endsWith(".skill")
    ) {
      toast.error(t("create.unsupportedFile"));
      return;
    }
    setUploadFile(file);
    if (lower.endsWith(".zip") || lower.endsWith(".skill")) {
      void (async () => {
        try {
          const buf = new Uint8Array(await file.arrayBuffer());
          const meta = readSkillMetaFromZip(buf);
          // Only fill fields the user hasn't typed into.
          setName((prev) => prev || meta.name || "");
          setDescription((prev) => prev || meta.description || "");
        } catch {
          /* prefill is best-effort; ignore parse failures */
        }
      })();
    }
  };

  const handleFolderFiles = async (fileList: File[]) => {
    const collected = await collectFromFileList(fileList);
    const check = validateBundleFiles(collected);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    // Root folder name = the common top segment; fall back to the skill name.
    const top = collected[0]?.path.split("/")[0] || "skill";
    const zipBytes = zipFiles(collected, top);
    setUploadFile(new File([zipBytes.buffer as ArrayBuffer], `${top}.zip`, { type: "application/zip" }));
    const meta = readSkillMetaFromZip(zipBytes);
    setName((prev) => prev || meta.name || top);
    setDescription((prev) => prev || meta.description || "");
  };

  const submitDisabled =
    submitting ||
    !name.trim() ||
    (mode === "upload" && !uploadFile);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t("create.nameRequired"));
      return;
    }
    if (mode === "upload" && !uploadFile) {
      toast.error(t("create.fileRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      // Build RBAC payload only when a scoped mode requires it (mirrors
      // prompts editor). Teams flag gated; today omitted entirely.
      const useScopedRbac = rightsMode === "users" || rightsMode === "roles";
      const rbacPayload = useScopedRbac
        ? { users: rbacUsers, roles: rbacRoles }
        : undefined;

      const newSkill = await createSkill({
        name: name.trim(),
        description: description.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        rights_mode: rightsMode,
        RBAC: rbacPayload,
      });

      if (mode === "blank") {
        await skillsApi.init(
          newSkill.id,
          newSkill.name,
          newSkill.description ?? "",
        );
      } else if (uploadFile) {
        const lower = uploadFile.name.toLowerCase();
        const isZip = lower.endsWith(".zip") || lower.endsWith(".skill");
        const ext = lower.endsWith(".md")
          ? ".md"
          : lower.endsWith(".skill")
            ? ".skill"
            : ".zip";
        const contentType =
          uploadFile.type || (isZip ? "application/zip" : "text/markdown");

        const { uploadUrl, stagingKey } = await skillsApi.uploadSign(
          newSkill.id,
          ext,
          contentType,
        );

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: uploadFile,
        });
        if (!putRes.ok) {
          throw new Error(
            `S3 upload failed: ${putRes.status} ${putRes.statusText}`,
          );
        }

        await skillsApi.initFromUpload(newSkill.id, stagingKey, isZip);
      }

      toast.success(t("create.success", { name: newSkill.name }));
      onCreated(newSkill);
      onOpenChange(false);
    } catch (err) {
      toast.error(t("create.failed"), {
        description: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting && !next) return; // never dismiss mid-flight
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles aria-hidden="true" className="size-5 text-primary" />
            {t("create.title")}
          </DialogTitle>
          <DialogDescription>{t("create.description")}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as CreateMode)}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="blank" className="gap-1.5">
              <Plus aria-hidden="true" className="size-4" />
              {t("create.modes.blank")}
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-1.5">
              <Upload aria-hidden="true" className="size-4" />
              {t("create.modes.upload")}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-4 py-1">
          {mode === "upload" ? (
            <div className="space-y-1.5">
              <Label>{t("create.bundleLabel")}</Label>
              {uploadFile ? (
                <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
                  <FileArchive
                    aria-hidden="true"
                    className="size-6 shrink-0 text-primary"
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-medium">
                      {uploadFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(uploadFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setUploadFile(null)}
                  >
                    {t("create.chooseDifferent")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Dropzone
                    onFiles={handleFiles}
                    accept={[".zip", ".md", ".skill"]}
                    label={t("create.dropzoneLabel")}
                    hint={t("create.dropzoneHint")}
                  />
                  <Dropzone
                    onFiles={(files) => void handleFolderFiles(files)}
                    directory
                    label={t("create.dropzoneFolderLabel")}
                    hint={t("create.dropzoneFolderHint")}
                  />
                </div>
              )}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="skill-name">
              {tCommon("name")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="skill-name"
              placeholder={t("create.namePlaceholder")}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="skill-description">{tCommon("description")}</Label>
            <Textarea
              id="skill-description"
              placeholder={t("create.descriptionPlaceholder")}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="skill-tags">{t("create.tagsLabel")}</Label>
            <Input
              id="skill-tags"
              placeholder={t("create.tagsPlaceholder")}
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("create.accessLabel")}</Label>
            <RBACControl
              modalMode
              subjectLabel={t("detail.subjectLabel")}
              initialRightsMode={rightsMode}
              initialUsers={
                rbacUsers as { id: number; rights: "read" | "write" }[]
              }
              initialRoles={
                rbacRoles as { id: string; rights: "read" | "write" }[]
              }
              initialTeams={[]}
              allowedModes={
                SKILLS_RBAC_TEAMS_SUPPORTED
                  ? undefined
                  : (ALLOWED_MODES_NO_TEAMS as unknown as Array<
                      "private" | "users" | "roles" | "teams" | "public"
                    >)
              }
              onChange={(nextMode, users, roles /* teams */) => {
                setRightsMode(nextMode as SkillRightsMode);
                setRbacUsers(users);
                setRbacRoles(roles);
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitDisabled}
            aria-busy={submitting}
          >
            {submitting ? (
              <>
                <Loader2
                  aria-hidden="true"
                  className="mr-2 size-4 animate-spin"
                />
                {mode === "upload"
                  ? t("create.uploading")
                  : t("create.creating")}
              </>
            ) : (
              <>
                <Plus aria-hidden="true" className="mr-2 size-4" />
                {t("create.submit")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
