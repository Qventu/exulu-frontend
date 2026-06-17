"use client";

/**
 * SavePresetModal — relocated from components/save-preset-modal.tsx (single
 * importer = chat) with a T5 responsive pass (chat.md item 68).
 *
 * Behavior unchanged: name (required) / description / tags / advanced RBAC
 * collapsible, selected-item stats, create + update modes. GraphQL operations
 * now come from chat/queries.ts (byte-identical copies; refetch keeps the
 * STRING operation name "GetContextPresets" so both document instances
 * refresh). Below `sm` the dialog fills the screen with an internally
 * scrollable body and sticky footer (responsive.md T5/V3/V4).
 *
 * Public API frozen: { isOpen, onClose, currentItems } (+ the existing
 * optional existingPreset/onSave edit-mode props).
 */

import React, { useState, useCallback, useContext, useMemo } from "react";
import { useMutation } from "@apollo/client";
import { useTranslations } from "next-intl";
import { ChevronDown, Tag, Database } from "lucide-react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/primitives/loading";
import { RBACControl } from "@/components/rbac";
import { cn } from "@/lib/utils";
import { parsePresetItemsForDisplay } from "@/lib/validate-preset-items";

import {
  CREATE_CONTEXT_PRESET,
  UPDATE_CONTEXT_PRESET,
  GET_CONTEXT_PRESETS,
} from "../queries";

interface ContextPreset {
  id: string;
  name: string;
  description?: string;
  preset_items: string[];
  tags?: string[];
  rights_mode?: "private" | "users" | "roles" | "teams" | "public";
  RBAC?: {
    users?: Array<{ id: number; rights: "read" | "write" }>;
    roles?: Array<{ id: string; rights: "read" | "write" }>;
    teams?: Array<{ id: string; rights: "read" | "write" }>;
  };
}

interface SavePresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentItems: string[];
  existingPreset?: ContextPreset;
  onSave?: (preset: ContextPreset) => void;
}

export function SavePresetModal({
  isOpen,
  onClose,
  currentItems,
  existingPreset,
  onSave,
}: SavePresetModalProps) {
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");
  const { user } = useContext(UserContext);

  const isEditing = Boolean(existingPreset);
  const [presetName, setPresetName] = useState(existingPreset?.name || "");
  const [presetDescription, setPresetDescription] = useState(
    existingPreset?.description || "",
  );
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(existingPreset?.tags || []);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rbac, setRbac] = useState<{
    rights_mode: "private" | "users" | "roles" | "teams" | "public";
    users: Array<{ id: number; rights: "read" | "write" }>;
    roles: Array<{ id: string; rights: "read" | "write" }>;
    teams: Array<{ id: string; rights: "read" | "write" }>;
  }>({
    rights_mode: existingPreset?.rights_mode || "private",
    users: existingPreset?.RBAC?.users || [],
    roles: existingPreset?.RBAC?.roles || [],
    teams: existingPreset?.RBAC?.teams || [],
  });

  // refetchQueries keep the STRING operation name so observers of both the
  // monolith documents and the chat/queries.ts copies refresh (contract §0).
  const [createPreset, { loading: creating }] = useMutation(
    CREATE_CONTEXT_PRESET,
    {
      refetchQueries: [GET_CONTEXT_PRESETS, "GetContextPresets"],
    },
  );
  const [updatePreset, { loading: updating }] = useMutation(
    UPDATE_CONTEXT_PRESET,
    {
      refetchQueries: [GET_CONTEXT_PRESETS, "GetContextPresets"],
    },
  );

  // Parse current items for display
  const itemStats = useMemo(() => {
    const items = isEditing ? existingPreset?.preset_items || [] : currentItems;
    return parsePresetItemsForDisplay(items);
  }, [currentItems, existingPreset, isEditing]);

  // Handle adding tags
  const handleAddTag = useCallback(() => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput("");
    }
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      setTags(tags.filter((tag) => tag !== tagToRemove));
    },
    [tags],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag],
  );

  // Save preset
  const handleSave = useCallback(async () => {
    if (!user?.id) return;

    if (!presetName.trim()) {
      toast.error(t("presets.nameRequiredToastTitle"), {
        description: t("presets.nameRequiredToastDescription"),
      });
      return;
    }

    try {
      const variables = {
        name: presetName.trim(),
        description: presetDescription.trim() || null,
        preset_items: isEditing ? existingPreset?.preset_items : currentItems,
        tags: tags.length > 0 ? tags : null,
        rights_mode: rbac.rights_mode,
        RBAC: {
          users: rbac.users,
          roles: rbac.roles,
        },
      };

      if (isEditing && existingPreset) {
        const { data } = await updatePreset({
          variables: {
            id: existingPreset.id,
            ...variables,
          },
        });

        toast.success(t("presets.updatedToastTitle"), {
          description: t("presets.updatedToastDescription", {
            name: presetName,
          }),
        });

        if (onSave && data?.context_presetsUpdateOneById?.item) {
          onSave(data.context_presetsUpdateOneById.item);
        }
      } else {
        const { data } = await createPreset({ variables });

        toast.success(t("presets.createdToastTitle"), {
          description: t("presets.createdToastDescription", {
            name: presetName,
          }),
        });

        if (onSave && data?.context_presetsCreateOne?.item) {
          onSave(data.context_presetsCreateOne.item);
        }
      }

      onClose();
    } catch (error) {
      console.error("Error saving preset:", error);
      toast.error(t("presets.errorToastTitle"), {
        description:
          error instanceof Error
            ? error.message
            : t("presets.errorToastDescription"),
      });
    }
  }, [
    user?.id,
    presetName,
    presetDescription,
    currentItems,
    tags,
    rbac,
    createPreset,
    updatePreset,
    onClose,
    isEditing,
    existingPreset,
    onSave,
    t,
  ]);

  const loading = creating || updating;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* T5: full-screen below sm with scrollable body + sticky footer. */}
      <DialogContent className="flex h-dvh max-h-dvh flex-col gap-0 p-0 sm:h-auto sm:max-h-[85dvh] sm:max-w-2xl">
        <DialogHeader className="shrink-0 px-6 pb-2 pt-6 text-left">
          <DialogTitle>
            {isEditing ? t("presets.editTitle") : t("presets.saveTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t("presets.editDescription")
              : t("presets.saveDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4 scrollbar-subtle">
          {/* Preview of selected items */}
          <div className="space-y-2 rounded-lg bg-muted/50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Database className="size-4" aria-hidden="true" />
              <span>{t("presets.selectedItems")}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>
                {t("presets.contextCount", { count: itemStats.contextCount })}
              </span>
              <span className="text-muted-foreground/50">•</span>
              <span>
                {t("presets.itemCount", { count: itemStats.itemCount })}
              </span>
              <span className="text-muted-foreground/50">•</span>
              <span className="font-medium">
                {t("presets.totalCount", {
                  count: itemStats.contextCount + itemStats.itemCount,
                })}
              </span>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="preset-name">
              {t("presets.nameLabel")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="preset-name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder={t("presets.namePlaceholder")}
              className="h-10 text-base sm:text-sm"
            />
            {!presetName.trim() && (
              <p className="text-sm text-destructive">
                {t("presets.nameRequired")}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="preset-description">
              {t("presets.descriptionLabel")}
            </Label>
            <Textarea
              id="preset-description"
              value={presetDescription}
              onChange={(e) => setPresetDescription(e.target.value)}
              placeholder={t("presets.descriptionPlaceholder")}
              rows={3}
              className="resize-none text-base sm:text-sm"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="preset-tags">
              <div className="flex items-center gap-2">
                <Tag className="size-4" aria-hidden="true" />
                {t("presets.tagsLabel")}
              </div>
            </Label>
            <div className="flex gap-2">
              <Input
                id="preset-tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("presets.tagsPlaceholder")}
                className="h-10 text-base sm:text-sm"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
              >
                {t("presets.addTag")}
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      aria-label={t("presets.removeTag", { tag })}
                      className="rounded-sm text-xs hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* RBAC — advanced collapsible (L3) */}
          <div className="border-t pt-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="mb-1 text-sm font-semibold">
                  {t("presets.sharingTitle")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("presets.sharingDescription")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced
                  ? t("presets.hideAdvanced")
                  : t("presets.showAdvanced")}
                <ChevronDown
                  className={cn(
                    "ml-1 size-4 transition-transform duration-200",
                    showAdvanced && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </Button>
            </div>
            {showAdvanced ? (
              <RBACControl
                allowedModes={["private", "users", "roles", "teams"]}
                initialRightsMode={existingPreset?.rights_mode}
                initialUsers={existingPreset?.RBAC?.users}
                initialRoles={existingPreset?.RBAC?.roles}
                initialTeams={existingPreset?.RBAC?.teams}
                onChange={(rights_mode, users, roles, teams) => {
                  setRbac({ rights_mode, users, roles, teams });
                }}
              />
            ) : (
              <div className="rounded-md bg-muted/30 p-3 text-sm text-muted-foreground">
                {t("presets.defaultPermissions")}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !presetName.trim()}
            className="min-w-[120px]"
          >
            {loading ? (
              <>
                <Loading className="mr-2 size-4" />
                {isEditing ? t("presets.updating") : t("presets.saving")}
              </>
            ) : isEditing ? (
              t("presets.update")
            ) : (
              t("presets.save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
