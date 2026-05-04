"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { File, Folder } from "lucide-react";

interface CreateItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "file" | "folder";
  mode?: "create" | "rename";
  parentPath: string;
  defaultName?: string;
  onConfirm: (name: string) => void;
}

export function CreateItemModal({
  open,
  onOpenChange,
  type,
  mode = "create",
  parentPath,
  defaultName = "",
  onConfirm,
}: CreateItemModalProps) {
  const [name, setName] = useState(defaultName);
  const Icon = type === "file" ? File : Folder;

  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    onOpenChange(false);
  };

  const isRename = mode === "rename";
  const title = isRename
    ? `Rename ${type === "file" ? "File" : "Folder"}`
    : `New ${type === "file" ? "File" : "Folder"}`;

  const subtitle = isRename
    ? `Rename "${defaultName}"`
    : parentPath && parentPath !== "/"
    ? `Inside ${parentPath}`
    : "In the root folder";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {title}
          </DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === "file" ? "e.g. guide.md" : "e.g. docs"}
              autoFocus
            />
            {type === "file" && !isRename && (
              <p className="text-xs text-muted-foreground">
                Use .md for Markdown files
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {isRename ? "Rename" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
