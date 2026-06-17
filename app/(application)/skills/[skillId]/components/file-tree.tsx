"use client";

/**
 * FileTree — recursive folder/file list for the skill editor sidebar.
 *
 * Spec: design/pages/skills.md inventory #49, #50, #51, #67; design-concept
 * ladder rows 49/50/67. Keeps the existing recursive shape and ContextMenu
 * semantics; the redesign adds:
 *
 *  - **Per-node trailing kebab** (OverflowMenu) — touch path for the
 *    right-click context menus (responsive.md T7: long-press is an
 *    accelerator, never the sole path). The kebab is `revealOnHover=true`
 *    on hover-capable, fine-pointer devices (fades in on row hover / focus)
 *    and **always visible on touch** — OverflowMenu's primitive contract.
 *  - **Monochrome icons** (skills.md M8) — yellow folder / blue .md icons
 *    spent semantic color on taxonomy. Folders + files all `text-muted-foreground`;
 *    selection accent moves to the row chrome (bg-primary/10 + primary text).
 *  - **canWrite trimming** (skills.md #67) — without write access the per-node
 *    kebab + root context menu are suppressed entirely (no Rename / Delete /
 *    New). Selection still works.
 *  - **Touch targets** — row height `py-1.5` + the kebab uses size-8 (the
 *    OverflowMenu default). The whole row remains a single tap target.
 *
 * Folder rename fan-out (skills.md #56 / risk M3) is owned by the parent
 * via onRename — this component only requests it.
 */

import {
  ChevronDown,
  ChevronRight,
  File,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { OverflowMenu, type OverflowMenuItem } from "@/components/primitives/overflow-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

import type { SkillFileNode } from "../../types";

export interface FileTreeProps {
  root: SkillFileNode;
  selectedKey: string | null;
  canWrite: boolean;
  onSelectFile: (node: SkillFileNode) => void;
  onCreateFile: (parentPath: string) => void;
  onCreateFolder: (parentPath: string) => void;
  onRename: (node: SkillFileNode) => void;
  onDelete: (node: SkillFileNode) => void;
}

export function FileTree({
  root,
  selectedKey,
  canWrite,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
}: FileTreeProps) {
  const t = useTranslations("skills");
  // Root is always expanded; everything else defaults closed (matches legacy).
  const [expanded, setExpanded] = React.useState<Set<string>>(
    () => new Set(["/"]),
  );

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderNode = (
    node: SkillFileNode,
    depth: number = 0,
  ): React.ReactNode => {
    if (node.type === "folder") {
      const isExpanded = expanded.has(node.path);
      const isRoot = node.path === "/";

      // Build OverflowMenu items — folders always offer New File/Folder.
      // Rename/Delete are only offered to non-root nodes with write access.
      const items: OverflowMenuItem[] = canWrite
        ? [
            {
              label: t("editor.tree.newFile"),
              icon: FilePlus,
              onSelect: () => onCreateFile(node.path),
            },
            {
              label: t("editor.tree.newFolder"),
              icon: FolderPlus,
              onSelect: () => onCreateFolder(node.path),
            },
            ...(isRoot
              ? []
              : [
                  {
                    label: t("editor.tree.rename"),
                    icon: Pencil,
                    onSelect: () => onRename(node),
                  },
                  {
                    label: t("editor.tree.delete"),
                    icon: Trash2,
                    destructive: true,
                    onSelect: () => onDelete(node),
                  },
                ]),
          ]
        : [];

      return (
        <div key={node.path}>
          <ContextMenu>
            <ContextMenuTrigger asChild disabled={!canWrite && isRoot}>
              <div
                className={cn(
                  "group flex items-center gap-1 rounded transition-colors hover:bg-accent/50",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(node.path)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-xs"
                  style={{ paddingLeft: `${depth * 12 + 8}px` }}
                >
                  {isExpanded ? (
                    <ChevronDown
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  ) : (
                    <ChevronRight
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                  {isExpanded ? (
                    <FolderOpen
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  ) : (
                    <Folder
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate font-medium">{node.name}</span>
                </button>
                {items.length > 0 ? (
                  <OverflowMenu
                    items={items}
                    revealOnHover
                    label={t("editor.tree.folderActions", { name: node.name })}
                    className="mr-1 size-6"
                  />
                ) : null}
              </div>
            </ContextMenuTrigger>
            {canWrite ? (
              <ContextMenuContent>
                <ContextMenuItem onClick={() => onCreateFile(node.path)}>
                  <FilePlus className="mr-2 size-3.5" aria-hidden="true" />
                  {t("editor.tree.newFile")}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onCreateFolder(node.path)}>
                  <FolderPlus className="mr-2 size-3.5" aria-hidden="true" />
                  {t("editor.tree.newFolder")}
                </ContextMenuItem>
                {!isRoot ? (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => onRename(node)}>
                      <Pencil className="mr-2 size-3.5" aria-hidden="true" />
                      {t("editor.tree.rename")}
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => onDelete(node)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 size-3.5" aria-hidden="true" />
                      {t("editor.tree.delete")}
                    </ContextMenuItem>
                  </>
                ) : null}
              </ContextMenuContent>
            ) : null}
          </ContextMenu>
          {isExpanded
            ? node.children?.map((child) => renderNode(child, depth + 1))
            : null}
        </div>
      );
    }

    // File node — selection is the only action without write access (skills.md #67).
    const isSelected = node.key === selectedKey;
    const items: OverflowMenuItem[] = canWrite
      ? [
          {
            label: t("editor.tree.rename"),
            icon: Pencil,
            onSelect: () => onRename(node),
          },
          {
            label: t("editor.tree.delete"),
            icon: Trash2,
            destructive: true,
            onSelect: () => onDelete(node),
          },
        ]
      : [];

    return (
      <ContextMenu key={node.key}>
        <ContextMenuTrigger asChild disabled={!canWrite}>
          <div
            className={cn(
              "group flex items-center gap-1 rounded transition-colors",
              isSelected
                ? "bg-primary/10 text-primary"
                : "hover:bg-accent/50",
            )}
          >
            <button
              type="button"
              onClick={() => onSelectFile(node)}
              className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-xs"
              style={{ paddingLeft: `${depth * 12 + 8 + 14}px` }}
            >
              <File
                className={cn(
                  "size-3.5 shrink-0",
                  isSelected ? "text-primary" : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
              <span className={cn("truncate", isSelected && "font-semibold")}>
                {node.name}
              </span>
            </button>
            {items.length > 0 ? (
              <OverflowMenu
                items={items}
                revealOnHover
                label={t("editor.tree.fileActions", { name: node.name })}
                className="mr-1 size-6"
              />
            ) : null}
          </div>
        </ContextMenuTrigger>
        {canWrite ? (
          <ContextMenuContent>
            <ContextMenuItem onClick={() => onRename(node)}>
              <Pencil className="mr-2 size-3.5" aria-hidden="true" />
              {t("editor.tree.rename")}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => onDelete(node)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-3.5" aria-hidden="true" />
              {t("editor.tree.delete")}
            </ContextMenuItem>
          </ContextMenuContent>
        ) : null}
      </ContextMenu>
    );
  };

  const isEmpty = !root.children || root.children.length === 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={!canWrite}>
        <div className="min-h-full py-1">
          {root.children?.map((child) => renderNode(child, 0))}
          {isEmpty ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              {canWrite
                ? t("editor.tree.emptyHint")
                : t("editor.tree.emptyReadOnly")}
            </p>
          ) : null}
        </div>
      </ContextMenuTrigger>
      {canWrite ? (
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onCreateFile("/")}>
            <FilePlus className="mr-2 size-3.5" aria-hidden="true" />
            {t("editor.tree.newFile")}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCreateFolder("/")}>
            <FolderPlus className="mr-2 size-3.5" aria-hidden="true" />
            {t("editor.tree.newFolder")}
          </ContextMenuItem>
        </ContextMenuContent>
      ) : null}
    </ContextMenu>
  );
}
