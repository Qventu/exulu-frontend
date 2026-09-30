"use client";

/**
 * ExportMenu — the reading view's Export ▾ menu (task-13 brief).
 *
 * Copy text and all five downloads go through the SAME server-side builder
 * (`GET {backend}/transcription-items/:itemId/export`) so the clipboard and
 * the downloaded .md file can never diverge — there is exactly one markdown
 * builder, and it lives on the backend.
 *
 * Deviation from the task-13 brief, on purpose: the brief specified
 * downloads via a plain `window.location.href` navigation. That cannot work
 * against this backend — confirmed with the plan's author before writing
 * this file. The export route authenticates purely through
 * `Authorization` / `exulu-api-key` / `x-api-key` HEADERS
 * (src/validators/requests.ts in the backend repo), with no cookie or
 * query-token fallback, and a bare browser navigation cannot attach a
 * header. Worse, a 401 there would replace the running app with a raw JSON
 * error page instead of failing quietly. This instead follows the
 * authenticated-fetch-plus-blob pattern already established in this
 * frontend for the sibling generic markdown-export route (see
 * `app/(application)/data/[ctx]/components/item-form-fields.tsx` and the
 * config downloads in `app/(application)/projects/hooks.ts`): fetch with a
 * bearer token, read the body, hand the browser a same-origin blob URL to
 * save via a throwaway anchor.
 *
 * The three Include toggles default on and persist per viewer in
 * localStorage under `transcripts:exportOptions`; every read/write is
 * wrapped in try/catch so a browser blocking site data still renders the
 * menu with the defaults instead of crashing the page.
 *
 * The backend returns the same 404 whether the item is missing or the
 * caller just can't read it (deliberately indistinguishable — see the
 * route's own comment). Every failure here — 400/404/500, a network error,
 * a clipboard permission denial — collapses to one generic toast per action
 * rather than speculating about which one happened.
 */
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { ConfigContext } from "@/components/shell/config-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getToken } from "@/lib/api/client";

export type ExportIncludeOptions = {
  summary: boolean;
  timestamps: boolean;
  speakers: boolean;
};

export interface ExportMenuProps {
  itemId: string;
}

type ExportFormat = "md" | "docx" | "pdf" | "csv" | "srt";

const STORAGE_KEY = "transcripts:exportOptions";

const DEFAULT_OPTIONS: ExportIncludeOptions = {
  summary: true,
  timestamps: true,
  speakers: true,
};

/** A browser with site data blocked throws on any localStorage access —
 *  read and write both degrade to "use the default" rather than crash. */
function loadIncludeOptions(): ExportIncludeOptions {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_OPTIONS;
    const parsed = JSON.parse(raw) as Partial<ExportIncludeOptions>;
    return {
      summary: typeof parsed.summary === "boolean" ? parsed.summary : true,
      timestamps: typeof parsed.timestamps === "boolean" ? parsed.timestamps : true,
      speakers: typeof parsed.speakers === "boolean" ? parsed.speakers : true,
    };
  } catch {
    return DEFAULT_OPTIONS;
  }
}

function saveIncludeOptions(options: ExportIncludeOptions): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    // Site data blocked, or quota exceeded — the toggle already applies in
    // memory for this session; persistence is a nice-to-have, not required.
  }
}

/** Blob URLs carry none of the response's headers, so the anchor's
 *  `download` attribute is the only thing that names the saved file — read
 *  the name the backend already chose off Content-Disposition, falling back
 *  to a generic one if it's missing or unparseable. */
function filenameFromResponse(res: Response, format: ExportFormat): string {
  const header = res.headers.get("content-disposition");
  const match = header?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return `transcript.${format}`;
}

/** Throws on a missing backend config or a non-OK response — callers treat
 *  both the same as any other failure. */
async function fetchExport(
  backend: string | undefined,
  itemId: string,
  format: ExportFormat,
  options: ExportIncludeOptions,
): Promise<Response> {
  if (!backend) {
    throw new Error("Backend is not configured.");
  }
  const token = await getToken();
  const url =
    `${backend}/transcription-items/${encodeURIComponent(itemId)}/export?format=${format}` +
    `&summary=${options.summary ? 1 : 0}` +
    `&timestamps=${options.timestamps ? 1 : 0}` +
    `&speakers=${options.speakers ? 1 : 0}`;
  const res = await fetch(url, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(`Export failed with status ${res.status}.`);
  }
  return res;
}

export function ExportMenu({ itemId }: ExportMenuProps) {
  const t = useTranslations("transcriptions");
  const config = React.useContext(ConfigContext);
  const backend = config?.backend;

  // Controlled so a failed action can leave the menu open while a
  // successful one closes it — Radix only auto-closes on select, and
  // `preventDefault` in `onSelect` below suppresses that for every item so
  // this state is the sole source of truth for open/closed.
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<ExportIncludeOptions>(() =>
    loadIncludeOptions(),
  );

  const updateOption = (key: keyof ExportIncludeOptions, value: boolean) => {
    setOptions((prev) => {
      const next = { ...prev, [key]: value };
      saveIncludeOptions(next);
      return next;
    });
  };

  const handleCopyText = async () => {
    let text: string;
    try {
      const res = await fetchExport(backend, itemId, "md", options);
      text = await res.text();
    } catch {
      toast.error(t("export.copyFailed"));
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("export.copied"));
      setOpen(false);
    } catch {
      // Clipboard access can reject too (permissions, insecure context) —
      // same user-facing failure either way.
      toast.error(t("export.copyFailed"));
    }
  };

  const handleDownload = async (format: ExportFormat) => {
    try {
      const res = await fetchExport(backend, itemId, format, options);
      const blob = await res.blob();
      const filename = filenameFromResponse(res, format);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      setOpen(false);
    } catch {
      toast.error(t("export.downloadFailed"));
    }
  };

  const downloads: { format: ExportFormat; label: string }[] = [
    { format: "md", label: t("export.markdown") },
    { format: "docx", label: t("export.word") },
    { format: "pdf", label: t("export.pdf") },
    { format: "csv", label: t("export.csv") },
    { format: "srt", label: t("export.srt") },
  ];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="max-md:h-11">
          {t("export.label")}
          <ChevronDown aria-hidden="true" className="ml-1 size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("export.include")}</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={options.summary}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={(checked) => updateOption("summary", checked === true)}
        >
          {t("export.includeSummary")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={options.timestamps}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={(checked) => updateOption("timestamps", checked === true)}
        >
          {t("export.includeTimestamps")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={options.speakers}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={(checked) => updateOption("speakers", checked === true)}
        >
          {t("export.includeSpeakers")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void handleCopyText();
          }}
        >
          {t("export.copyText")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {downloads.map(({ format, label }) => (
          <DropdownMenuItem
            key={format}
            onSelect={(event) => {
              event.preventDefault();
              void handleDownload(format);
            }}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
