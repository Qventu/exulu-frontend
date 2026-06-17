"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@apollo/client";
import {
  CREATE_IMAGE_GENERATION_STYLE,
  UPDATE_IMAGE_GENERATION_STYLE,
  DELETE_IMAGE_GENERATION_STYLE,
} from "@/queries/queries";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RBACControl } from "@/components/rbac";
import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

/**
 * Create / edit a saved image-generation style. Styles are stored in the
 * platform_configurations table under the key prefix
 * `image_generation_style:<slug>`. The slug is derived from the name on
 * create and never changes — renaming a style updates config_value.name
 * but not config_key, so existing image_generations.applied_style_id
 * references remain valid.
 */
export type StyleEditTarget = {
  id?: string;
  name?: string;
  description?: string;
  markdown?: string;
  rights_mode?: "private" | "users" | "roles" | "teams" | "public";
  users?: { id: number; rights: "read" | "write" }[];
  roles?: { id: string; rights: "read" | "write" }[];
  teams?: { id: string; rights: "read" | "write" }[];
};

const toSlug = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || `style-${Date.now()}`;

export function EditStyleDialog({
  open,
  onOpenChange,
  initialStyle,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStyle?: StyleEditTarget;
  onSaved: () => void;
}) {
  const isEdit = !!initialStyle?.id;
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");

  // In-dialog two-step delete confirm (replaces the native confirm(); a
  // stacked ConfirmDialog would be modal-on-modal — anti-pattern #3).
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [name, setName] = useState(initialStyle?.name ?? "");
  const [description, setDescription] = useState(initialStyle?.description ?? "");
  const [markdown, setMarkdown] = useState(initialStyle?.markdown ?? "");
  const [rightsMode, setRightsMode] = useState<
    "private" | "users" | "roles" | "teams" | "public"
  >(initialStyle?.rights_mode ?? "private");
  const [users, setUsers] = useState(initialStyle?.users ?? []);
  const [roles, setRoles] = useState(initialStyle?.roles ?? []);

  useEffect(() => {
    if (open) {
      setName(initialStyle?.name ?? "");
      setDescription(initialStyle?.description ?? "");
      setMarkdown(initialStyle?.markdown ?? "");
      setRightsMode(initialStyle?.rights_mode ?? "private");
      setUsers(initialStyle?.users ?? []);
      setRoles(initialStyle?.roles ?? []);
      setConfirmingDelete(false);
    }
  }, [open, initialStyle]);

  const [createStyle, { loading: creating }] = useMutation(CREATE_IMAGE_GENERATION_STYLE);
  const [updateStyle, { loading: updating }] = useMutation(UPDATE_IMAGE_GENERATION_STYLE);
  const [deleteStyle, { loading: deleting }] = useMutation(DELETE_IMAGE_GENERATION_STYLE);

  const saving = creating || updating;

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name required", { description: "Give the style a name." });
      return;
    }
    if (!markdown.trim()) {
      toast.error("Style content required", { description: "Add markdown describing the style." });
      return;
    }

    const data: any = {
      config_value: JSON.stringify({ name: name.trim(), markdown: markdown.trim() }),
      description: description.trim(),
      rights_mode: rightsMode,
      RBAC: {
        users,
        roles,
      },
    };

    try {
      if (isEdit) {
        await updateStyle({ variables: { id: initialStyle!.id, data } });
        toast.success("Style updated");
      } else {
        data.config_key = `image_generation_style:${toSlug(name)}`;
        await createStyle({ variables: { data } });
        toast.success("Style created");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error("[EXULU] Failed to save style", err);
      toast.error("Couldn't save style", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const handleDelete = async () => {
    if (!initialStyle?.id) return;
    try {
      await deleteStyle({ variables: { id: initialStyle.id } });
      toast.success("Style deleted");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error("[EXULU] Failed to delete style", err);
      toast.error("Couldn't delete style", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* T5 (item 86): full-screen sheet below `sm` (h-dvh, internal scroll,
          pinned footer); centered max-w-[600px] dialog from `sm` up. */}
      <DialogContent className="flex h-dvh max-h-dvh w-full max-w-full flex-col gap-4 overflow-hidden rounded-none sm:h-auto sm:max-h-[85dvh] sm:max-w-[600px] sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit style" : "New image style"}</DialogTitle>
          <DialogDescription>
            Saved styles append markdown to the user prompt before sending to the image model.
            Use them to capture reusable creative direction (lighting, color palette, format).
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="space-y-2">
            <Label htmlFor="style-name">Name</Label>
            <Input
              id="style-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cinematic portrait"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="style-description">Short description</Label>
            <Input
              id="style-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Shown in the style picker as a subtitle"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="style-markdown">Style markdown</Label>
            <Textarea
              id="style-markdown"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              rows={8}
              placeholder={`Style:\n- photorealistic, 35mm film grain\n- shallow depth of field\n- warm golden hour lighting`}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Visibility</Label>
            <RBACControl
              initialRightsMode={rightsMode}
              initialUsers={users}
              initialRoles={roles}
              onChange={(mode, u, r) => {
                setRightsMode(mode);
                setUsers(u);
                setRoles(r);
              }}
            />
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 pb-[env(safe-area-inset-bottom)] sm:gap-0 sm:pb-0">
          {isEdit && !confirmingDelete && (
            <Button
              variant="outline"
              className="h-11 sm:mr-auto sm:h-10 text-destructive hover:text-destructive"
              onClick={() => setConfirmingDelete(true)}
              disabled={deleting || saving}
            >
              <Trash2 className="h-4 w-4 mr-1" aria-hidden="true" />
              Delete
            </Button>
          )}
          {isEdit && confirmingDelete && (
            <div className="flex items-center gap-2 sm:mr-auto" role="alert">
              <Button
                variant="destructive"
                className="h-11 sm:h-10"
                onClick={handleDelete}
                disabled={deleting || saving}
              >
                {deleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />}
                {t("imageGen.confirmDeleteStyle")}
              </Button>
              <Button
                variant="ghost"
                className="h-11 sm:h-10"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                {tCommon("cancel")}
              </Button>
            </div>
          )}
          <Button variant="outline" className="h-11 sm:h-10" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button className="h-11 sm:h-10" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />}
            {isEdit ? "Save changes" : "Create style"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
