"use client";

import { Copy, Download, ExternalLink, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { ArtifactListItem } from "../hooks";

export interface ArtifactRowMenuProps {
  item: ArtifactListItem;
  onOpenInNewTab: () => void;
  onCopyLink: () => void;
  onDownload: () => void;
  onRename: () => void;
  onSharing: () => void;
  onDelete: () => void;
}

/**
 * The per-row "…" menu: the quick actions for everyone, and — for the
 * creator or a super admin — rename, sharing and delete.
 */
export function ArtifactRowMenu({ item, onOpenInNewTab, onCopyLink, onDownload, onRename, onSharing, onDelete }: ArtifactRowMenuProps) {
  const t = useTranslations("artifacts");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={`${t("moreActions")}: ${item.name}`} title={t("moreActions")}>
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={onOpenInNewTab}>
          <ExternalLink aria-hidden="true" className="mr-2 size-4" />
          {t("openInNewTab")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCopyLink}>
          <Copy aria-hidden="true" className="mr-2 size-4" />
          {t("copyLink")}
        </DropdownMenuItem>
        {!item.type.inline && (
          <DropdownMenuItem onSelect={onDownload}>
            <Download aria-hidden="true" className="mr-2 size-4" />
            {t("download")}
          </DropdownMenuItem>
        )}
        {item.canManage && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onRename}>
              <Pencil aria-hidden="true" className="mr-2 size-4" />
              {t("rename")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onSharing}>
              <Share2 aria-hidden="true" className="mr-2 size-4" />
              {t("sharing")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 aria-hidden="true" className="mr-2 size-4" />
              {t("delete")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
