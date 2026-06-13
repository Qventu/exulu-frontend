"use client";

/**
 * SkillEditorView — mini-IDE shell for /skills/[skillId].
 *
 * Spec: design/pages/skills.md §3 ("editor route" + concept) — full-bleed
 * work surface (PageShell variant="full-bleed", padding-free). Composes:
 *
 *  - EditorTopBar          (sidebar toggle · back · name + vN · refresh ·
 *                            history · save version · ⋯)
 *  - FileSidebar           (inline w-60 ≥md; left Sheet <md via the same
 *                            sidebar toggle in the top bar)
 *  - SkillEditor           (editor pane: file header + .md/textarea body)
 *  - VersionHistoryPanel   (right Sheet)
 *  - SkillDiffModal        (full-screen <md, centered ≥md)
 *  - InputDialog (×N)      (save-version label, create file, create folder,
 *                            rename file/folder)
 *  - ConfirmDialog (×N)    (delete file/folder, discard-and-switch on dirty
 *                            file selection)
 *
 * Ownership choices (anti-pattern #4 — one pattern per job):
 *  - This component is the SINGLE host for all ConfirmDialog +
 *    InputDialog instances in the editor route. SkillEditor surfaces
 *    `onDirtyChange`; FileTree requests rename/delete through callbacks;
 *    the host opens the right dialog.
 *  - The route-leave guard for in-flight edits uses the shared
 *    SaveBar/useUnsavedChangesGuard hook from primitives (the hook is
 *    sub-spec'd to fire `beforeunload` + intercept same-origin <a>
 *    clicks; mid-edit Save Version snapshots the in-flight content via
 *    REST `saveVersion`, so the navigation guard fires when the per-file
 *    editor is dirty).
 *
 * MobileTopbarAction integration: the shell renders a `MobileTopbar` <md
 * (navigation.md §5.1) with a slot for the page's primary action. The
 * editor's primary mobile action is Save Version; we also expose an
 * overflow trigger from the same slot so Refresh / History / Copy ID
 * stay reachable when the inline top bar collapses to icon-only.
 *
 * Not-found: skill query returned null → EmptyState + back link.
 */

import {
  Copy,
  GitBranch,
  History,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { type OverflowMenuItem } from "@/components/primitives/overflow-menu";
import { PageShell } from "@/components/primitives/page-shell";
import { useUnsavedChangesGuard } from "@/components/primitives/save-bar";
import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { skillsApi } from "@/lib/api/skills";
import { cn } from "@/lib/utils";

import { useSkillById, useSkillFiles } from "../../hooks";
import { hasSkillWriteAccess } from "../../types";
import type { SkillFileNode } from "../../types";

import { EditorTopBar } from "./editor-top-bar";
import { FileSidebar } from "./file-sidebar";
import { InputDialog } from "./input-dialog";
import { SkillDiffModal } from "./skill-diff-modal";
import { SkillEditor } from "./skill-editor";
import { VersionHistoryPanel } from "./version-history-panel";

// Local state shape for the InputDialog flows. The single dialog handles
// all four call sites (save-version label, create file, create folder,
// rename file/folder) via the `kind` discriminator.
type InputKind =
  | { kind: "save-version" }
  | { kind: "create-file"; parentPath: string }
  | { kind: "create-folder"; parentPath: string }
  | { kind: "rename"; node: SkillFileNode };

// Local state shape for ConfirmDialog: delete file vs. delete folder
// (different copy + cascade warning) and discard-and-switch.
type ConfirmState =
  | { kind: "delete"; node: SkillFileNode }
  | {
      kind: "discard-and-switch";
      target: SkillFileNode | null;
    };

// Validation helpers — names must not be empty after trim and must not
// contain path separators (the legacy code silently accepted these and
// produced broken S3 keys).
function validateFileName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null; // allowEmpty=false catches this elsewhere
  if (trimmed.includes("/") || trimmed.includes("\\"))
    return "name-no-slashes";
  return null;
}

export interface SkillEditorViewProps {
  skillId: string;
}

export function SkillEditorView({ skillId }: SkillEditorViewProps) {
  const t = useTranslations("skills");
  const router = useRouter();
  const isMobile = useIsMobile();

  // --- Data ---------------------------------------------------------------
  const { skill, loading: skillLoading } = useSkillById(skillId);
  const { user } = React.useContext(UserContext) ?? { user: null };
  const canWrite = hasSkillWriteAccess(skill ?? null, user);

  const {
    files: filesData,
    loading: filesLoading,
    reload: reloadFiles,
  } = useSkillFiles(skillId);

  // --- Selection & dirty tracking ----------------------------------------
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<SkillFileNode | null>(
    null,
  );
  const [editorDirty, setEditorDirty] = React.useState(false);

  // Sheets / dialogs
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [diffOpen, setDiffOpen] = React.useState(false);
  const [savingVersion, setSavingVersion] = React.useState(false);

  // Input + Confirm orchestration — single host (anti-pattern #4).
  const [inputState, setInputState] = React.useState<InputKind | null>(null);
  const [confirmState, setConfirmState] = React.useState<ConfirmState | null>(
    null,
  );
  const [folderOpBusy, setFolderOpBusy] = React.useState(false);

  // Imperative save handle into SkillEditor for Cmd/Ctrl+S + future
  // "Save & switch" flow.
  const editorSaveRef = React.useRef<(() => Promise<void>) | null>(null);

  // --- Route-leave guard for in-flight edits -----------------------------
  // The editor's "dirty" signal is per-file; if the user navigates away
  // while a file is unsaved, intercept. (Save Version is a separate
  // snapshot op and doesn't dirty in the same sense.)
  const { confirmIfDirty, guardDialog } = useUnsavedChangesGuard(editorDirty);

  // --- Handlers ----------------------------------------------------------

  // Sidebar toggle: desktop flips the inline rail, mobile opens the Sheet.
  const handleToggleSidebar = () => {
    if (isMobile) setMobileSidebarOpen((v) => !v);
    else setSidebarOpen((v) => !v);
  };

  // File selection — if the current editor is dirty, surface the discard
  // confirm (the editor itself doesn't host the dialog; this view does).
  const requestSelectFile = (node: SkillFileNode) => {
    if (editorDirty && node.key !== selectedFile?.key) {
      setConfirmState({ kind: "discard-and-switch", target: node });
      return;
    }
    setSelectedFile(node);
    // Selecting a file on mobile closes the sheet.
    if (isMobile) setMobileSidebarOpen(false);
  };

  // --- Save Version --------------------------------------------------------
  const openSaveVersionDialog = () => {
    if (!canWrite) return;
    setInputState({ kind: "save-version" });
  };

  const performSaveVersion = async (label: string) => {
    if (!skill) return;
    setSavingVersion(true);
    try {
      await skillsApi.saveVersion(skillId, label || undefined);
      toast.success(t("editor.toasts.versionSaved"));
      // Refresh both skill (for current_version + history) and files.
      await reloadFiles();
      // The version flip invalidates the open file's key (v{n} → v{n+1}).
      setSelectedFile(null);
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        t("editor.toasts.versionFailed", {
          error: (err as Error).message,
        }),
      );
      throw err; // keep InputDialog open
    } finally {
      setSavingVersion(false);
    }
  };

  // --- Refresh -------------------------------------------------------------
  const handleRefresh = () => {
    void reloadFiles();
  };

  // --- File operations -----------------------------------------------------
  const handleCreateFile = (parentPath: string) => {
    setInputState({ kind: "create-file", parentPath });
  };

  const handleCreateFolder = (parentPath: string) => {
    setInputState({ kind: "create-folder", parentPath });
  };

  const handleRename = (node: SkillFileNode) => {
    setInputState({ kind: "rename", node });
  };

  const handleDelete = (node: SkillFileNode) => {
    setConfirmState({ kind: "delete", node });
  };

  const performCreateFile = async (name: string, parentPath: string) => {
    const parentRelPath = parentPath === "/" ? "" : parentPath.replace(/^\//, "") + "/";
    const filePath = parentRelPath + name;
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const contentType =
      ext === "md"
        ? "text/markdown"
        : ext === "json"
          ? "application/json"
          : "text/plain";
    try {
      const { url } = await skillsApi.sign(skillId, filePath, contentType);
      await skillsApi.uploadContent(url, "", contentType);
      toast.success(t("editor.toasts.fileCreated"));
      await reloadFiles();
    } catch (err: unknown) {
      toast.error(
        t("editor.toasts.opFailed", { error: (err as Error).message }),
      );
      throw err;
    }
  };

  const performCreateFolder = async (name: string, parentPath: string) => {
    const parentRelPath = parentPath === "/" ? "" : parentPath.replace(/^\//, "") + "/";
    try {
      const { url } = await skillsApi.sign(
        skillId,
        parentRelPath + name + "/.gitkeep",
        "text/plain",
      );
      await skillsApi.uploadContent(url, "", "text/plain");
      toast.success(t("editor.toasts.folderCreated"));
      await reloadFiles();
    } catch (err: unknown) {
      toast.error(
        t("editor.toasts.opFailed", { error: (err as Error).message }),
      );
      throw err;
    }
  };

  const performRename = async (newName: string, node: SkillFileNode) => {
    const parentDir = node.path.split("/").slice(0, -1).join("/");
    const newRelPath = (parentDir + "/" + newName).replace(/^\//, "");

    if (node.type === "file") {
      try {
        await skillsApi.rename(skillId, node.key, newRelPath);
        if (selectedFile?.key === node.key) setSelectedFile(null);
        toast.success(t("editor.toasts.renamed"));
        await reloadFiles();
      } catch (err: unknown) {
        toast.error(
          t("editor.toasts.opFailed", { error: (err as Error).message }),
        );
        throw err;
      }
      return;
    }

    // Folder rename: client-side fan-out kept (skills.md M3 mitigation —
    // a backend bulk-rename is the real fix; here we add a busy state +
    // a clear toast on partial failure).
    setFolderOpBusy(true);
    try {
      const oldFolderPath = node.path.replace(/^\//, "");
      const version = skill?.current_version ?? 1;
      const prefix = `skills/${skillId}/v${version}/${oldFolderPath}/`;
      const allFiles = await skillsApi.files(skillId);
      const flatten = (n: SkillFileNode): SkillFileNode[] =>
        n.type === "file" ? [n] : (n.children ?? []).flatMap(flatten);
      const filesToRename = flatten(allFiles.tree).filter(
        (f: SkillFileNode) => f.path.startsWith("/" + oldFolderPath + "/"),
      );

      const results = await Promise.allSettled(
        filesToRename.map((f) => {
          const rel = f.path.replace(/^\//, "");
          return skillsApi.rename(
            skillId,
            f.key,
            rel.replace(oldFolderPath, newRelPath),
          );
        }),
      );
      // Best-effort cleanup of the old prefix.
      await skillsApi.deleteFile(skillId, { prefix }).catch(() => undefined);

      if (selectedFile && selectedFile.path.startsWith("/" + oldFolderPath + "/")) {
        setSelectedFile(null);
      }

      const failures = results.filter((r) => r.status === "rejected").length;
      if (failures > 0) {
        toast.warning(
          t("editor.toasts.folderRenamePartial", { count: failures }),
        );
      } else {
        toast.success(t("editor.toasts.renamed"));
      }
      await reloadFiles();
    } catch (err: unknown) {
      toast.error(
        t("editor.toasts.opFailed", { error: (err as Error).message }),
      );
      throw err;
    } finally {
      setFolderOpBusy(false);
    }
  };

  const performDelete = async (node: SkillFileNode) => {
    try {
      if (node.type === "file") {
        await skillsApi.deleteFile(skillId, { key: node.key });
        if (selectedFile?.key === node.key) setSelectedFile(null);
      } else {
        const version = skill?.current_version ?? 1;
        const folderPath = node.path.replace(/^\//, "");
        const prefix = `skills/${skillId}/v${version}/${folderPath}/`;
        await skillsApi.deleteFile(skillId, { prefix });
        if (selectedFile && selectedFile.path.startsWith(node.path))
          setSelectedFile(null);
      }
      toast.success(t("editor.toasts.deleted"));
      await reloadFiles();
    } catch (err: unknown) {
      toast.error(
        t("editor.toasts.deleteFailed", { error: (err as Error).message }),
      );
      throw err;
    }
  };

  // --- InputDialog dispatch ----------------------------------------------
  const handleInputSubmit = async (value: string) => {
    if (!inputState) return;
    switch (inputState.kind) {
      case "save-version":
        await performSaveVersion(value);
        break;
      case "create-file":
        await performCreateFile(value, inputState.parentPath);
        break;
      case "create-folder":
        await performCreateFolder(value, inputState.parentPath);
        break;
      case "rename":
        await performRename(value, inputState.node);
        break;
    }
  };

  // --- ConfirmDialog dispatch --------------------------------------------
  const handleConfirm = async () => {
    if (!confirmState) return;
    if (confirmState.kind === "delete") {
      await performDelete(confirmState.node);
    } else {
      // discard-and-switch
      setSelectedFile(confirmState.target);
      if (isMobile) setMobileSidebarOpen(false);
    }
  };

  // --- Copy skill ID (additive) ------------------------------------------
  const handleCopyId = async () => {
    if (!skill) return;
    try {
      await navigator.clipboard.writeText(skill.id);
      toast.success(t("editor.toasts.idCopied"));
    } catch {
      toast.error(t("editor.toasts.copyFailed"));
    }
  };

  // --- Mobile shell action: Save Version + overflow -----------------------
  const mobileOverflowItems: OverflowMenuItem[] = React.useMemo(() => {
    if (!skill) return [];
    return [
      {
        label: t("editor.topbar.refresh"),
        icon: RefreshCw,
        onSelect: handleRefresh,
        disabled: filesLoading,
      },
      {
        label: t("editor.topbar.history"),
        icon: History,
        onSelect: () => setHistoryOpen(true),
      },
      {
        label: t("editor.topbar.copyId"),
        icon: Copy,
        onSelect: () => void handleCopyId(),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill, filesLoading, t]);

  // --- Not-found / loading branches --------------------------------------
  if (skillLoading) {
    return (
      <PageShell variant="full-bleed">
        <div className="flex h-full flex-1 items-center justify-center">
          <Loader2
            className="size-6 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </PageShell>
    );
  }

  if (!skill) {
    return (
      <PageShell variant="full-bleed">
        <div className="flex h-full flex-1 items-center justify-center p-6">
          <EmptyState
            icon={Sparkles}
            title={t("editor.notFound.title")}
            description={t("editor.notFound.description")}
            action={{
              label: t("editor.notFound.back"),
              href: "/skills",
            }}
          />
        </div>
      </PageShell>
    );
  }

  // --- Render ------------------------------------------------------------
  // Validation in the InputDialog scope — uses the current inputState to
  // craft per-kind rules. Returns `null` when not applicable.
  const inputValidate = (value: string): string | null => {
    if (!inputState) return null;
    if (inputState.kind === "save-version") return null;
    const v = validateFileName(value);
    if (v === "name-no-slashes") return t("editor.input.errorNoSlashes");
    return null;
  };

  // Resolve InputDialog props per kind.
  const inputProps = (() => {
    if (!inputState) return null;
    switch (inputState.kind) {
      case "save-version":
        return {
          title: t("editor.input.saveVersionTitle"),
          description: t("editor.input.saveVersionDescription"),
          label: t("editor.input.saveVersionLabel"),
          placeholder: t("editor.input.saveVersionPlaceholder"),
          helperText: t("editor.input.saveVersionHelper", {
            current: skill.current_version ?? 1,
            next: (skill.current_version ?? 1) + 1,
          }),
          confirmLabel: t("editor.input.saveVersionConfirm"),
          allowEmpty: true,
        };
      case "create-file":
        return {
          title: t("editor.input.newFileTitle"),
          description:
            inputState.parentPath === "/"
              ? t("editor.input.newFileDescriptionRoot")
              : t("editor.input.newFileDescription", {
                  path: inputState.parentPath,
                }),
          label: t("editor.input.fileNameLabel"),
          placeholder: t("editor.input.fileNamePlaceholder"),
          helperText: t("editor.input.fileNameHelper"),
          confirmLabel: t("editor.input.createConfirm"),
        };
      case "create-folder":
        return {
          title: t("editor.input.newFolderTitle"),
          description:
            inputState.parentPath === "/"
              ? t("editor.input.newFolderDescriptionRoot")
              : t("editor.input.newFolderDescription", {
                  path: inputState.parentPath,
                }),
          label: t("editor.input.folderNameLabel"),
          placeholder: t("editor.input.folderNamePlaceholder"),
          confirmLabel: t("editor.input.createConfirm"),
        };
      case "rename":
        return {
          title:
            inputState.node.type === "file"
              ? t("editor.input.renameFileTitle")
              : t("editor.input.renameFolderTitle"),
          description: t("editor.input.renameDescription", {
            name: inputState.node.name,
          }),
          label: t("editor.input.renameLabel"),
          placeholder: inputState.node.name,
          defaultValue: inputState.node.name,
          confirmLabel: t("editor.input.renameConfirm"),
        };
    }
  })();

  // ConfirmDialog content per kind.
  const confirmProps = (() => {
    if (!confirmState) return null;
    if (confirmState.kind === "delete") {
      const isFolder = confirmState.node.type === "folder";
      return {
        title: isFolder
          ? t("editor.confirm.deleteFolderTitle", {
              name: confirmState.node.name,
            })
          : t("editor.confirm.deleteFileTitle", {
              name: confirmState.node.name,
            }),
        description: isFolder
          ? t("editor.confirm.deleteFolderDescription")
          : t("editor.confirm.deleteFileDescription"),
        confirmLabel: t("editor.confirm.deleteConfirm"),
        variant: "destructive" as const,
      };
    }
    // discard-and-switch
    return {
      title: t("editor.confirm.discardSwitchTitle"),
      description: t("editor.confirm.discardSwitchDescription"),
      confirmLabel: t("editor.confirm.discardSwitchConfirm"),
      variant: "default" as const,
    };
  })();

  const currentVersion = skill.current_version ?? 1;

  return (
    <PageShell variant="full-bleed">
      {/* Mobile shell action — Save Version (purple) + overflow trigger.
          The shell renders these next to the burger; this slot is the only
          path to Save Version on mobile because the inline top bar's
          purple button goes icon-only at <sm and disappears below 320px. */}
      <MobileTopbarAction>
        {canWrite ? (
          <Button
            type="button"
            size="sm"
            onClick={openSaveVersionDialog}
            disabled={savingVersion}
            aria-label={t("editor.topbar.saveVersion")}
            className="gap-1.5"
          >
            {savingVersion ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <GitBranch className="size-3.5" aria-hidden="true" />
            )}
            <span className="sr-only sm:not-sr-only">
              {t("editor.topbar.saveVersion")}
            </span>
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t("editor.topbar.moreActions")}
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {mobileOverflowItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem
                  key={idx}
                  onSelect={item.onSelect}
                  disabled={item.disabled}
                >
                  {Icon ? (
                    <Icon className="mr-2 size-4 shrink-0" aria-hidden="true" />
                  ) : null}
                  {item.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </MobileTopbarAction>

      <EditorTopBar
        skill={skill}
        canWrite={canWrite}
        sidebarOpen={isMobile ? mobileSidebarOpen : sidebarOpen}
        filesLoading={filesLoading}
        savingVersion={savingVersion}
        onToggleSidebar={handleToggleSidebar}
        onBack={() => confirmIfDirty(() => router.push("/skills"))}
        onRefresh={handleRefresh}
        onOpenHistory={() => setHistoryOpen(true)}
        onRequestSaveVersion={openSaveVersionDialog}
      />

      {/* Main content — desktop side-by-side, mobile sidebar in a Sheet. */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop inline sidebar (≥md). */}
        <div
          className={cn(
            "hidden flex-shrink-0 flex-col overflow-hidden border-r bg-background transition-all duration-200 ease-in-out md:flex",
            sidebarOpen ? "w-60" : "w-0 border-r-0",
          )}
          aria-hidden={!sidebarOpen}
        >
          {sidebarOpen ? (
            <FileSidebar
              filesData={filesData}
              filesLoading={filesLoading}
              fallbackVersion={currentVersion}
              selectedKey={selectedFile?.key ?? null}
              canWrite={canWrite}
              onSelectFile={requestSelectFile}
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          ) : null}
        </div>

        {/* Editor pane fills the rest. */}
        <div className="flex min-w-0 flex-1">
          <SkillEditor
            skillId={skillId}
            file={selectedFile}
            canWrite={canWrite}
            onSaved={() => void reloadFiles()}
            onDirtyChange={setEditorDirty}
            saveRef={editorSaveRef}
          />
        </div>
      </div>

      {/* Mobile file-tree Sheet (<md) — same content as the inline rail.
          Triggered by the top-bar sidebar toggle (handleToggleSidebar). */}
      <Sheet
        open={isMobile && mobileSidebarOpen}
        onOpenChange={setMobileSidebarOpen}
      >
        <SheetContent
          side="left"
          className="w-[85vw] max-w-sm p-0 sm:max-w-sm"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t("editor.sidebar.files")}</SheetTitle>
          </SheetHeader>
          <FileSidebar
            filesData={filesData}
            filesLoading={filesLoading}
            fallbackVersion={currentVersion}
            selectedKey={selectedFile?.key ?? null}
            canWrite={canWrite}
            onSelectFile={requestSelectFile}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        </SheetContent>
      </Sheet>

      {/* Version history sheet. */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col p-0 sm:max-w-sm"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t("editor.history.title")}</SheetTitle>
          </SheetHeader>
          <VersionHistoryPanel
            skill={skill}
            onCompare={() => {
              setHistoryOpen(false);
              setDiffOpen(true);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Diff modal — mounted only while open so the REST diff doesn't
          fire prematurely. */}
      {diffOpen ? (
        <SkillDiffModal
          open={diffOpen}
          onOpenChange={setDiffOpen}
          skill={skill}
        />
      ) : null}

      {/* InputDialog — single host for all 4 flows. */}
      {inputProps ? (
        <InputDialog
          open={inputState !== null}
          onOpenChange={(open) => {
            if (!open) setInputState(null);
          }}
          title={inputProps.title}
          description={inputProps.description}
          label={inputProps.label}
          placeholder={inputProps.placeholder}
          defaultValue={inputProps.defaultValue}
          helperText={inputProps.helperText}
          confirmLabel={inputProps.confirmLabel}
          allowEmpty={inputProps.allowEmpty}
          validate={inputValidate}
          onSubmit={handleInputSubmit}
        />
      ) : null}

      {/* ConfirmDialog — single host for delete + discard-and-switch. */}
      {confirmProps ? (
        <ConfirmDialog
          open={confirmState !== null}
          onOpenChange={(open) => {
            if (!open) setConfirmState(null);
          }}
          title={confirmProps.title}
          description={confirmProps.description}
          confirmLabel={confirmProps.confirmLabel}
          variant={confirmProps.variant}
          onConfirm={handleConfirm}
        />
      ) : null}

      {/* Folder-rename busy overlay (skills.md M3 mitigation). */}
      {folderOpBusy ? (
        <Dialog open onOpenChange={() => undefined}>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {t("editor.toasts.folderRenaming")}
              </DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Same-origin unsaved-leave + back-link guard. */}
      {guardDialog}
    </PageShell>
  );
}
