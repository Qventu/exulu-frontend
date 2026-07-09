"use client";

import { Upload } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Dropzone — bordered-dashed drag-and-drop file target with click-to-browse
 * fallback and type hint.
 *
 * Spec: design/codebase-structure.md §2.3 (Dropzone) —
 * `{ onFiles: (files: File[]) => void; accept?: string[]; hint?: string; disabled? }`.
 * First consumer: the transcriptions composer; chat attachments and knowledge
 * upload share the same surface.
 *
 * Generic extensions (documented, not page-flavored):
 * - `label` — the main copy line. Primitives receive all copy via props
 *   (codebase-structure §3.5), so the label cannot be built in.
 * - `onBrowse` — replaces the default click-to-browse native file input with a
 *   consumer-owned browse surface (e.g. a file-gallery dialog). Drag-and-drop
 *   still calls `onFiles`.
 * - `multiple` — allow more than one file (default false).
 *
 * Accessibility/touch: the whole zone is one real `<button>` (≥44px target,
 * focus ring, Enter/Space activate); drag affordance is an enhancement, never
 * the only path (responsive.md T7).
 */
export interface DropzoneProps {
  onFiles: (files: File[]) => void;
  /** Allowed file extensions (e.g. ".mp3"). Filters drops; feeds the native input's `accept`. */
  accept?: string[];
  /** Type hint line under the label (e.g. "mp3, wav, m4a"). */
  hint?: string;
  disabled?: boolean;
  /** Main label copy ("Drop an audio file or browse"). */
  label: string;
  /** Override click-to-browse (e.g. open a gallery dialog). Default: native file input. */
  onBrowse?: () => void;
  multiple?: boolean;
  /** Enable folder picking (webkitdirectory) and recursive folder drop traversal. */
  directory?: boolean;
  className?: string;
}

async function readDropEntries(items: DataTransferItemList): Promise<File[]> {
  const out: File[] = [];
  const walk = (entry: any, prefix: string): Promise<void> =>
    new Promise((resolve) => {
      if (entry.isFile) {
        entry.file(
          (file: File) => {
            Object.defineProperty(file, "webkitRelativePath", {
              value: prefix + file.name,
              configurable: true,
            });
            out.push(file);
            resolve();
          },
          (err: unknown) => {
            console.warn("[dropzone] could not read file entry", entry.fullPath, err);
            resolve();
          },
        );
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readBatch = () => {
          reader.readEntries(
            (ents: any[]) => {
              if (!ents.length) {
                resolve();
                return;
              }
              Promise.all(ents.map((e) => walk(e, prefix + entry.name + "/")))
                .then(readBatch)
                .catch((err: unknown) => {
                  console.warn("[dropzone] error walking directory", entry.fullPath, err);
                  resolve();
                });
            },
            (err: unknown) => {
              console.warn("[dropzone] readEntries error", entry.fullPath, err);
              resolve();
            },
          );
        };
        readBatch();
      } else {
        resolve();
      }
    });
  const roots = Array.from(items)
    .map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null))
    .filter(Boolean);
  await Promise.all(roots.map((r: any) => walk(r, "")));
  return out;
}

const Dropzone = React.forwardRef<HTMLButtonElement, DropzoneProps>(
  (
    {
      onFiles,
      accept,
      hint,
      disabled = false,
      label,
      onBrowse,
      multiple = false,
      directory = false,
      className,
    },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const dragDepth = React.useRef(0);
    const [dragActive, setDragActive] = React.useState(false);

    const matchesAccept = React.useCallback(
      (file: File) => {
        if (!accept || accept.length === 0) return true;
        const name = file.name.toLowerCase();
        return accept.some((ext) => name.endsWith(ext.toLowerCase()));
      },
      [accept],
    );

    const emitFiles = (list: FileList | null) => {
      if (!list) return;
      const files = Array.from(list).filter(matchesAccept);
      if (files.length === 0) return;
      onFiles(multiple ? files : files.slice(0, 1));
    };

    const handleDragEnter = (event: React.DragEvent) => {
      event.preventDefault();
      if (disabled) return;
      dragDepth.current += 1;
      setDragActive(true);
    };

    const handleDragLeave = (event: React.DragEvent) => {
      event.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragActive(false);
    };

    const handleDrop = (event: React.DragEvent) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragActive(false);
      if (disabled) return;
      if (directory && event.dataTransfer?.items) {
        void readDropEntries(event.dataTransfer.items).then((files) => {
          if (files.length > 0) onFiles(files);
        });
      } else {
        emitFiles(event.dataTransfer?.files ?? null);
      }
    };

    const handleClick = () => {
      if (disabled) return;
      if (onBrowse) {
        onBrowse();
        return;
      }
      inputRef.current?.click();
    };

    return (
      <>
        <button
          ref={ref}
          type="button"
          disabled={disabled}
          onClick={handleClick}
          onDragEnter={handleDragEnter}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-transparent px-4 py-6 text-center transition-colors duration-150",
            "hover:border-muted-foreground/50 hover:bg-muted/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            dragActive && "border-primary bg-primary/5",
            disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
            className,
          )}
        >
          <Upload aria-hidden="true" className="size-5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{label}</span>
          {hint ? (
            <span className="text-xs text-muted-foreground">{hint}</span>
          ) : null}
        </button>
        {!onBrowse && (
          <input
            ref={inputRef}
            type="file"
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
            accept={accept?.join(",")}
            multiple={multiple}
            disabled={disabled}
            onChange={(event) => {
              if (directory && event.target.files) {
                const files = Array.from(event.target.files);
                if (files.length > 0) onFiles(files);
              } else {
                emitFiles(event.target.files);
              }
              event.target.value = "";
            }}
            {...(directory ? ({ webkitdirectory: "", directory: "" } as any) : {})}
          />
        )}
      </>
    );
  },
);
Dropzone.displayName = "Dropzone";

export { Dropzone };
