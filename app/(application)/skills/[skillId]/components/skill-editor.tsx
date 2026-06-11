"use client";

import { useState, useEffect, useRef } from "react";
import { SkillFileNode } from "@/types/models/skill";
import { skillsApi } from "@/lib/api/skills";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Save, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

interface SkillEditorProps {
  skillId: string;
  file: SkillFileNode | null;
  onSaved?: () => void;
}

export function SkillEditor({ skillId, file, onSaved }: SkillEditorProps) {
  const [content, setContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState(500);

  // Track container height for the markdown editor
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setEditorHeight(Math.max(200, entry.contentRect.height - 2));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load file content when selection changes
  useEffect(() => {
    if (!file || file.type !== "file") return;
    if (file.key === loadedKey) return;

    setLoading(true);
    skillsApi
      .file(skillId, file.key)
      .then(({ content: c }) => {
        const text = c ?? "";
        setContent(text);
        setOriginalContent(text);
        setLoadedKey(file.key);
      })
      .catch((err: Error) => {
        toast.error(`Failed to load file: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [file, skillId, loadedKey]);

  const handleSave = async () => {
    if (!file) return;
    setSaving(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const contentType =
        ext === "md"
          ? "text/markdown"
          : ext === "json"
          ? "application/json"
          : "text/plain";

      // filePath is the path relative to the version folder (strip leading /)
      const filePath = file.path.replace(/^\/+/, "");
      const { url } = await skillsApi.sign(skillId, filePath, contentType);
      await skillsApi.uploadContent(url, content, contentType);
      setOriginalContent(content);
      toast.success("File saved");
      onSaved?.();
    } catch (err: unknown) {
      toast.error(`Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const isDirty = content !== originalContent;
  const ext = file?.name.split(".").pop()?.toLowerCase() ?? "";
  const isMd = ext === "md";

  if (!file) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <FileText className="h-14 w-14" strokeWidth={1} />
        <p className="text-sm">Select a file from the tree to edit</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* File header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-mono text-muted-foreground truncate">
            {file.path.replace(/^\//, "")}
          </span>
          {isDirty && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Unsaved
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="h-7 text-xs gap-1.5 flex-shrink-0"
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          Save
        </Button>
      </div>

      {/* Editor body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isMd ? (
        <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden">
          <MarkdownEditor
            value={content}
            onChange={setContent}
            height={editorHeight}
            preview="edit"
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full p-4 font-mono text-sm resize-none bg-background focus:outline-none"
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}
