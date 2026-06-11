"use client";

import { useState, useEffect, useCallback } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useSkill } from "@/hooks/use-skills";
import { skillsApi } from "@/lib/api/skills";
import { SkillFileNode, SkillFilesResponse } from "@/types/models/skill";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  GitBranch,
  History,
  Loader2,
  FilePlus,
  FolderPlus,
  Sparkles,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { toast } from "sonner";
import { FileTree } from "./components/file-tree";
import { SkillEditor } from "./components/skill-editor";
import { VersionHistoryPanel } from "./components/version-history-panel";
import { SkillDiffModal } from "./components/skill-diff-modal";
import { CreateItemModal } from "./components/create-item-modal";

interface PageProps {
  params: Promise<{ skillId: string }>;
}

export default function SkillEditorPage({ params }: PageProps) {
  const { skillId } = use(params);
  const router = useRouter();

  const { data: skillData, loading: skillLoading, refetch: refetchSkill } = useSkill(skillId);
  const skill = skillData?.skillById;

  const [filesData, setFilesData] = useState<SkillFilesResponse | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SkillFileNode | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);

  const [createModal, setCreateModal] = useState<{
    open: boolean;
    type: "file" | "folder";
    mode: "create" | "rename";
    parentPath: string;
    targetNode: SkillFileNode | null;
    defaultName: string;
  }>({
    open: false,
    type: "file",
    mode: "create",
    parentPath: "/",
    targetNode: null,
    defaultName: "",
  });

  const loadFiles = useCallback(async () => {
    if (!skillId) return;
    setFilesLoading(true);
    try {
      const data = await skillsApi.files(skillId);
      setFilesData(data);
    } catch (err: unknown) {
      toast.error(`Failed to load files: ${(err as Error).message}`);
    } finally {
      setFilesLoading(false);
    }
  }, [skillId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleSaveVersion = async () => {
    if (!skill) return;
    const label = window.prompt("Version label (optional):");
    if (label === null) return;

    setSavingVersion(true);
    try {
      await skillsApi.saveVersion(skillId, label || undefined);
      toast.success("New version saved");
      await refetchSkill();
      await loadFiles();
      setSelectedFile(null);
    } catch (err: unknown) {
      toast.error(`Failed to save version: ${(err as Error).message}`);
    } finally {
      setSavingVersion(false);
    }
  };

  const handleCreateFile = (parentPath: string) => {
    setCreateModal({ open: true, type: "file", mode: "create", parentPath, targetNode: null, defaultName: "" });
  };

  const handleCreateFolder = (parentPath: string) => {
    setCreateModal({ open: true, type: "folder", mode: "create", parentPath, targetNode: null, defaultName: "" });
  };

  const handleRename = (node: SkillFileNode) => {
    setCreateModal({
      open: true,
      type: node.type,
      mode: "rename",
      parentPath: node.path.split("/").slice(0, -1).join("/") || "/",
      targetNode: node,
      defaultName: node.name,
    });
  };

  const handleDelete = async (node: SkillFileNode) => {
    const label = node.type === "folder"
      ? `folder "${node.name}" and all its contents`
      : `file "${node.name}"`;
    // eslint-disable-next-line no-restricted-globals -- pre-existing native dialog; replace with ConfirmDialog in this page's redesign
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;

    try {
      if (node.type === "file") {
        await skillsApi.deleteFile(skillId, { key: node.key });
        if (selectedFile?.key === node.key) setSelectedFile(null);
      } else {
        const version = skill?.current_version ?? 1;
        const folderPath = node.path.replace(/^\//, "");
        const prefix = `skills/${skillId}/v${version}/${folderPath}/`;
        await skillsApi.deleteFile(skillId, { prefix });
        if (selectedFile && selectedFile.path.startsWith(node.path)) setSelectedFile(null);
      }
      toast.success("Deleted");
      await loadFiles();
    } catch (err: unknown) {
      toast.error(`Delete failed: ${(err as Error).message}`);
    }
  };

  const handleCreateConfirm = async (name: string) => {
    const { type, mode, parentPath, targetNode } = createModal;

    try {
      if (mode === "rename" && targetNode) {
        const parentDir = targetNode.path.split("/").slice(0, -1).join("/");
        const newRelPath = (parentDir + "/" + name).replace(/^\//, "");

        if (type === "file") {
          await skillsApi.rename(skillId, targetNode.key, newRelPath);
          if (selectedFile?.key === targetNode.key) setSelectedFile(null);
        } else {
          const oldFolderPath = targetNode.path.replace(/^\//, "");
          const version = skill?.current_version ?? 1;
          const prefix = `skills/${skillId}/v${version}/${oldFolderPath}/`;
          const allFiles = await skillsApi.files(skillId);
          const flatten = (n: SkillFileNode): SkillFileNode[] =>
            n.type === "file" ? [n] : (n.children ?? []).flatMap(flatten);
          const filesToRename = flatten(allFiles.tree).filter(
            (f: SkillFileNode) => f.path.startsWith("/" + oldFolderPath + "/"),
          );
          await Promise.all(
            filesToRename.map((f: SkillFileNode) => {
              const rel = f.path.replace(/^\//, "");
              return skillsApi.rename(skillId, f.key, rel.replace(oldFolderPath, newRelPath));
            }),
          );
          await skillsApi.deleteFile(skillId, { prefix }).catch(() => {});
          if (selectedFile && selectedFile.path.startsWith("/" + oldFolderPath + "/")) {
            setSelectedFile(null);
          }
        }
        toast.success("Renamed");
      } else {
        const parentRelPath = parentPath === "/" ? "" : parentPath.replace(/^\//, "") + "/";
        if (type === "file") {
          const filePath = parentRelPath + name;
          const ext = name.split(".").pop()?.toLowerCase() ?? "";
          const contentType =
            ext === "md" ? "text/markdown" : ext === "json" ? "application/json" : "text/plain";
          const { url } = await skillsApi.sign(skillId, filePath, contentType);
          await skillsApi.uploadContent(url, "", contentType);
          toast.success("File created");
        } else {
          const { url } = await skillsApi.sign(skillId, parentRelPath + name + "/.gitkeep", "text/plain");
          await skillsApi.uploadContent(url, "", "text/plain");
          toast.success("Folder created");
        }
      }
      await loadFiles();
    } catch (err: unknown) {
      toast.error(`Operation failed: ${(err as Error).message}`);
    }
  };

  if (skillLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Skill not found.</p>
        <Button variant="outline" onClick={() => router.push("/skills")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Skills
        </Button>
      </div>
    );
  }

  const currentVersion = skill.current_version ?? 1;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-background flex-shrink-0">
        {/* Sidebar toggle — same placement as SidebarTrigger in main-nav */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              {sidebarOpen
                ? <PanelLeftClose className="h-4 w-4" />
                : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{sidebarOpen ? "Collapse files" : "Expand files"}</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={() => router.push("/skills")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to Skills</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5" />

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Sparkles className="size-4 text-primary flex-shrink-0" />
          <h1 className="text-sm font-semibold truncate">{skill.name}</h1>
          <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 flex-shrink-0">
            v{currentVersion}
          </Badge>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={loadFiles}
                disabled={filesLoading}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", filesLoading && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh files</TooltipContent>
          </Tooltip>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="h-3.5 w-3.5" />
            History
          </Button>

          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleSaveVersion}
            disabled={savingVersion}
          >
            {savingVersion
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <GitBranch className="h-3.5 w-3.5" />}
            Save Version
          </Button>
        </div>
      </div>

      {/* Main content — sidebar + editor side by side */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* File tree sidebar */}
        <div
          className={cn(
            "flex flex-col border-r bg-background transition-all duration-200 ease-in-out overflow-hidden flex-shrink-0",
            sidebarOpen ? "w-60" : "w-0 border-r-0",
          )}
        >
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20 flex-shrink-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
              Files
            </span>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleCreateFile("/")}
                  >
                    <FilePlus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New File</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleCreateFolder("/")}
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New Folder</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <ScrollArea className="flex-1">
            {filesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filesData?.tree ? (
              <FileTree
                root={filesData.tree}
                selectedKey={selectedFile?.key ?? null}
                onSelectFile={setSelectedFile}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-8 px-3 text-center text-muted-foreground gap-2">
                <p className="text-xs">No files yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 whitespace-nowrap"
                  onClick={() => handleCreateFile("/")}
                >
                  <FilePlus className="h-3.5 w-3.5 mr-1.5" />
                  New File
                </Button>
              </div>
            )}
          </ScrollArea>

          {/* Sidebar footer */}
          <div className="px-3 py-2 border-t bg-muted/10 flex items-center justify-between flex-shrink-0">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {filesData?.fileCount ?? 0} file{(filesData?.fileCount ?? 0) !== 1 ? "s" : ""}
            </span>
            <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
              v{filesData?.version ?? currentVersion}
            </Badge>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 min-w-0 flex">
          <SkillEditor
            skillId={skillId}
            file={selectedFile}
            onSaved={loadFiles}
          />
        </div>
      </div>

      {/* Version History Sheet */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent className="sm:max-w-sm p-0 flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>Version History</SheetTitle>
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

      {diffOpen && (
        <SkillDiffModal
          open={diffOpen}
          onOpenChange={setDiffOpen}
          skill={skill}
        />
      )}

      <CreateItemModal
        open={createModal.open}
        onOpenChange={(open) => setCreateModal((prev) => ({ ...prev, open }))}
        type={createModal.type}
        mode={createModal.mode}
        parentPath={createModal.parentPath}
        defaultName={createModal.defaultName}
        onConfirm={handleCreateConfirm}
      />
    </div>
  );
}
