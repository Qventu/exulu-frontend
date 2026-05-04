"use client";

import { useState } from "react";
import { SkillFileNode } from "@/types/models/skill";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface FileTreeProps {
  root: SkillFileNode;
  selectedKey: string | null;
  onSelectFile: (node: SkillFileNode) => void;
  onCreateFile: (parentPath: string) => void;
  onCreateFolder: (parentPath: string) => void;
  onRename: (node: SkillFileNode) => void;
  onDelete: (node: SkillFileNode) => void;
}

export function FileTree({
  root,
  selectedKey,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
}: FileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["/"]) );

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderNode = (node: SkillFileNode, depth: number = 0): React.ReactNode => {
    if (node.type === "folder") {
      const isExpanded = expanded.has(node.path);
      return (
        <div key={node.path}>
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <button
                onClick={() => toggle(node.path)}
                className="w-full flex items-center gap-1.5 py-1 text-sm rounded hover:bg-accent/50 transition-colors text-left"
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                )}
                {isExpanded ? (
                  <FolderOpen className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
                ) : (
                  <Folder className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
                )}
                <span className="truncate text-xs font-medium">{node.name}</span>
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => onCreateFile(node.path)}>
                <FilePlus className="h-3.5 w-3.5 mr-2" />
                New File
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onCreateFolder(node.path)}>
                <FolderPlus className="h-3.5 w-3.5 mr-2" />
                New Folder
              </ContextMenuItem>
              {node.path !== "/" && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => onRename(node)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    Rename
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => onDelete(node)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Delete
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
          {isExpanded &&
            node.children?.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }

    // File node
    const ext = node.name.split(".").pop()?.toLowerCase() ?? "";
    const isMd = ext === "md";
    const isSelected = node.key === selectedKey;

    return (
      <ContextMenu key={node.key}>
        <ContextMenuTrigger asChild>
          <button
            onClick={() => onSelectFile(node)}
            className={cn(
              "w-full flex items-center gap-1.5 py-1 text-sm rounded hover:bg-accent/50 transition-colors text-left",
              isSelected && "bg-primary/10 text-primary",
            )}
            style={{ paddingLeft: `${depth * 12 + 8 + 14}px` }}
          >
            <File
              className={cn(
                "h-3.5 w-3.5 flex-shrink-0",
                isMd ? "text-blue-500" : "text-muted-foreground",
              )}
            />
            <span
              className={cn(
                "truncate text-xs",
                isSelected ? "font-semibold" : "",
              )}
            >
              {node.name}
            </span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onRename(node)}>
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Rename
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => onDelete(node)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="py-1 min-h-full">
          {root.children?.map((child) => renderNode(child, 0))}
          {(!root.children || root.children.length === 0) && (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center">
              No files yet. Right-click to create.
            </p>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onCreateFile("/")}>
          <FilePlus className="h-3.5 w-3.5 mr-2" />
          New File
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCreateFolder("/")}>
          <FolderPlus className="h-3.5 w-3.5 mr-2" />
          New Folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
