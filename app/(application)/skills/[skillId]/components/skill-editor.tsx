"use client";

/**
 * SkillEditor — the editor pane (file header + editor body).
 *
 * Spec: design/pages/skills.md inventory #58–#64, #67; design-concept ladder
 * rows 58/59/60/61/62/63/64/67.
 *
 * - `.md` → primitives/markdown-editor.tsx (#62, unchanged composition).
 * - Other files → plain mono textarea (#63).
 * - Header: mono path (#64) + Unsaved badge (#60) + Save (#61).
 * - Cmd/Ctrl+S binding (additive, ladder #61) — only fires when not pending
 *   and the file is dirty.
 * - Skeleton lines while content loads (#59) — replaces the legacy
 *   centered spinner (M6).
 * - canWrite=false (#67): the editor renders read-only — Save hidden,
 *   MarkdownEditor in `preview` mode (no edit), textarea `readOnly`. Path
 *   gets a "Read-only" badge so the affordance loss is explained
 *   (philosophy §10: never condescend, explain in place).
 * - Dirty guard on file switch (#60): emits `onRequestDiscardAndSwitch`
 *   when the host calls back through a ref-style API; the host owns the
 *   ConfirmDialog (anti-pattern #4: one pattern per job).
 */

import { Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { MarkdownEditor } from "@/components/primitives/markdown-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { skillsApi } from "@/lib/api/skills";
import { cn } from "@/lib/utils";

import type { SkillFileNode } from "../../types";

export interface SkillEditorProps {
  skillId: string;
  file: SkillFileNode | null;
  canWrite: boolean;
  onSaved: () => void;
  /** Lets the host know the editor is dirty (for unsaved-leave guard). */
  onDirtyChange?: (dirty: boolean) => void;
  /**
   * Imperative save trigger registered with the host. The host calls this
   * before swapping files when the user confirms "Save & switch" in the
   * future — today only used for Cmd/Ctrl+S; reserved API.
   */
  saveRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  md: "text/markdown",
  markdown: "text/markdown",
  json: "application/json",
};

function contentTypeFor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPE_BY_EXT[ext] ?? "text/plain";
}

export function SkillEditor({
  skillId,
  file,
  canWrite,
  onSaved,
  onDirtyChange,
  saveRef,
}: SkillEditorProps) {
  const t = useTranslations("skills");

  const [content, setContent] = React.useState<string>("");
  const [originalContent, setOriginalContent] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [loadedKey, setLoadedKey] = React.useState<string | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = React.useState(500);

  // ResizeObserver: keep the markdown editor sized to its container.
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setEditorHeight(Math.max(200, entry.contentRect.height - 2));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load file content whenever the selection changes.
  React.useEffect(() => {
    if (!file || file.type !== "file") return;
    if (file.key === loadedKey) return;

    let cancelled = false;
    setLoading(true);
    skillsApi
      .file(skillId, file.key)
      .then(({ content: c }) => {
        if (cancelled) return;
        const text = c ?? "";
        setContent(text);
        setOriginalContent(text);
        setLoadedKey(file.key);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        toast.error(t("editor.toasts.loadFailed", { error: err.message }));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [file, skillId, loadedKey, t]);

  const isDirty = content !== originalContent;

  // Surface dirty state to the host so it can mount the discard-on-switch
  // ConfirmDialog (anti-pattern #4: one dialog host).
  React.useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = React.useCallback(async () => {
    if (!file || !canWrite || !isDirty || saving) return;
    setSaving(true);
    try {
      const contentType = contentTypeFor(file.name);
      const filePath = file.path.replace(/^\/+/, "");
      const { url } = await skillsApi.sign(skillId, filePath, contentType);
      await skillsApi.uploadContent(url, content, contentType);
      setOriginalContent(content);
      toast.success(t("editor.toasts.fileSaved"));
      onSaved();
    } catch (err: unknown) {
      toast.error(
        t("editor.toasts.saveFailed", {
          error: (err as Error).message,
        }),
      );
    } finally {
      setSaving(false);
    }
  }, [file, canWrite, isDirty, saving, skillId, content, onSaved, t]);

  // Register the imperative save trigger with the host.
  React.useEffect(() => {
    if (!saveRef) return;
    saveRef.current = handleSave;
    return () => {
      saveRef.current = null;
    };
  }, [handleSave, saveRef]);

  // Cmd/Ctrl+S keyboard binding (ladder #61, additive).
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "s") return;
      // Only intercept when this editor is actively meaningful.
      if (!file || !canWrite) return;
      event.preventDefault();
      void handleSave();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [file, canWrite, handleSave]);

  // Empty state (no file selected, #58).
  if (!file) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center text-muted-foreground">
        <Save className="size-10" aria-hidden="true" />
        <p className="text-sm">{t("editor.emptyState")}</p>
      </div>
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isMd = ext === "md" || ext === "markdown";
  const displayPath = file.path.replace(/^\//, "");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* File header: mono path + Unsaved + Save (or Read-only badge). */}
      <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          {/*
            truncate-from-left on small widths (skills.md #64) — keeps the
            filename visible when the path is long. `direction: rtl` reverses
            the truncation side; the inner span keeps LTR for the text.
          */}
          <span
            className="min-w-0 truncate font-mono text-xs text-muted-foreground"
            dir="rtl"
            title={displayPath}
          >
            <span dir="ltr">{displayPath}</span>
          </span>
          {isDirty ? (
            <Badge variant="outline" className="shrink-0 text-xs">
              {t("editor.unsaved")}
            </Badge>
          ) : null}
          {!canWrite ? (
            <Badge variant="secondary" className="shrink-0 text-xs">
              {t("editor.readOnly")}
            </Badge>
          ) : null}
        </div>
        {canWrite ? (
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || !isDirty}
            aria-busy={saving}
            className="shrink-0 gap-1.5"
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-3.5" aria-hidden="true" />
            )}
            {t("editor.save")}
          </Button>
        ) : null}
      </div>

      {/* Editor body (or skeleton). */}
      {loading ? (
        // Skeleton lines (#59) replace the legacy centered spinner (M6).
        <div className="flex-1 space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                "h-3",
                // Vary the widths so the skeleton mirrors prose rather than
                // a uniform bar — matches MarkdownEditor / textarea content.
                i % 4 === 0 ? "w-5/6" : i % 3 === 0 ? "w-2/3" : "w-full",
              )}
            />
          ))}
        </div>
      ) : isMd ? (
        // .md → MarkdownEditor primitive. canWrite=false renders the
        // viewer-only preview (skills.md #67 read-only degradation).
        <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden">
          <MarkdownEditor
            value={content}
            onChange={setContent}
            height={editorHeight}
            preview={canWrite ? "edit" : "preview"}
            disabled={!canWrite}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            readOnly={!canWrite}
            disabled={!canWrite}
            className="h-full w-full resize-none bg-background p-4 font-mono text-sm focus:outline-none"
            spellCheck={false}
            aria-label={t("editor.fileContent", { name: file.name })}
          />
        </div>
      )}
    </div>
  );
}
