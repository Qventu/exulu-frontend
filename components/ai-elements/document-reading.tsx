"use client";

/**
 * Progress card for the `parse_document` tool. While the backend reads a long
 * document it streams preliminary outputs ({ status: "reading", phase,
 * pagesDone, pagesTotal }, at most one per second); this card turns them into
 * a compact bar instead of the generic JSON tool card. Finished, it collapses
 * to one line.
 */

import { FileText, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const DOCUMENT_READING_TOOL_TYPE = "tool-parse_document";

/** Documents with at least this many pages get the "result is kept" hint. */
const LONG_DOCUMENT_PAGES = 50;

const PHASES = ["cached", "text", "ocr", "vision", "storing"] as const;
type Phase = (typeof PHASES)[number];

export interface DocumentReadingPart {
  type?: string;
  state?: string;
  preliminary?: boolean;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

interface ReadProgress {
  filename?: string;
  phase?: Phase;
  pagesDone: number;
  pagesTotal: number;
}

const parseMaybeJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

/** Unwraps a string / `{ result }` envelope; tolerant of unknown shapes. */
const unwrap = (output: unknown): Record<string, unknown> | null => {
  let value = parseMaybeJson(output);
  if (value && typeof value === "object" && "result" in value) {
    const inner = parseMaybeJson((value as { result: unknown }).result);
    if (inner && typeof inner === "object") value = inner;
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
};

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;

export const isDocumentReadingPart = (part: unknown): boolean =>
  (part as { type?: unknown } | null)?.type?.toString().toLowerCase() ===
  DOCUMENT_READING_TOOL_TYPE;

export interface DocumentReadingProps {
  part: DocumentReadingPart;
  /** True while the message this part belongs to is still being streamed. */
  streaming: boolean;
  className?: string;
}

export const DocumentReading = ({ part, streaming, className }: DocumentReadingProps) => {
  const t = useTranslations("chat.documentReading");

  const inputName = (part.input as { filename?: unknown } | undefined)?.filename;
  const out = unwrap(part.output);
  const preliminary = part.state === "output-available" && part.preliminary === true;

  const filename =
    (typeof out?.filename === "string" && out.filename) ||
    (typeof inputName === "string" && inputName) ||
    "";

  const shell = (children: React.ReactNode, tone?: "error") => (
    <div
      className={cn(
        "mt-3 rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground",
        tone === "error" && "border-destructive/40",
        className,
      )}
      data-testid="document-reading"
    >
      {children}
    </div>
  );
  const nameRow = (suffix?: React.ReactNode, icon?: React.ReactNode) => (
    <div className="flex items-center gap-2 text-foreground">
      {icon ?? <FileText aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />}
      <span className="truncate font-medium">{filename}</span>
      {suffix}
    </div>
  );

  // Errors: SDK-level, or the tool's own { error } payload.
  const error =
    part.state === "output-error"
      ? part.errorText ?? ""
      : !preliminary && typeof out?.error === "string"
        ? out.error
        : null;
  if (error !== null) {
    return shell(
      <>
        {nameRow()}
        <p className="mt-1 text-destructive">{t("error", { message: error })}</p>
      </>,
      "error",
    );
  }

  // Finished.
  if (part.state === "output-available" && !preliminary) {
    const pages = num(out?.totalPages);
    return shell(
      <div className="flex items-center gap-2 text-foreground">
        <FileText aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">
          {pages ? `${filename} · ${t("pages", { count: pages })}` : filename}
        </span>
        {out?.fromStore === true ? (
          <span className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {t("alreadyRead")}
          </span>
        ) : null}
      </div>,
    );
  }

  // Left running although the turn is over: the user stopped it.
  if (!streaming) {
    return shell(
      <>
        {nameRow()}
        <p className="mt-1">{t("interrupted")}</p>
      </>,
    );
  }

  // Running (preliminary update, or input only so far).
  const progress: ReadProgress | null = preliminary
    ? {
        phase: PHASES.includes(out?.phase as Phase) ? (out?.phase as Phase) : undefined,
        pagesDone: num(out?.pagesDone),
        pagesTotal: num(out?.pagesTotal),
      }
    : null;
  const total = progress?.pagesTotal ?? 0;
  const determinate = total > 0;
  const done = Math.min(progress?.pagesDone ?? 0, total);
  const percent = determinate ? Math.round((done / total) * 100) : 0;

  return shell(
    <>
      {nameRow(
        null,
        <Loader2
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted-foreground motion-safe:animate-spin"
        />,
      )}
      {determinate ? (
        <Progress
          value={percent}
          className="mt-2 h-1.5"
          aria-label={t("title")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        />
      ) : (
        <div
          role="progressbar"
          aria-label={t("title")}
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary"
        >
          <div className="h-full w-1/3 rounded-full bg-primary motion-safe:animate-pulse" />
        </div>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span>{progress?.phase ? t(progress.phase) : t("title")}</span>
        {determinate ? <span>{t("page", { done, total })}</span> : null}
      </div>
      {total >= LONG_DOCUMENT_PAGES ? <p className="mt-1">{t("longHint")}</p> : null}
    </>,
  );
};
