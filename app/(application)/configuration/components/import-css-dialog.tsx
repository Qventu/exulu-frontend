"use client";

/**
 * Import-CSS dialog (settings-config.md ladder rows 20–22, L3): the mono
 * paste textarea + the `:root`/`.dark` regex parser preserved verbatim from
 * the old configuration/page.tsx:62-95 — first block only, no nested braces,
 * a documented deliberate limit (risk 6). New here:
 *
 * - live parse preview ("N light · M dark variables detected") plus a
 *   non-blocking warning list for unparseable lines (U16) and a "no blocks
 *   found" hint, all visible BEFORE importing;
 * - the artificial 500 ms import delay is dropped (U14) — parsing is
 *   synchronous and instant;
 * - on import the dialog closes and the parent merges + reveals the values
 *   (merge semantics preserved; the editor switches to "Modified only").
 *
 * Responsive (T5): simple centered dialog ≤ max-w-lg fits 390 px; the
 * textarea is dvh-capped and 16 px on touch (no iOS focus zoom).
 */

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import type { ThemeOverrides } from "../theme-defaults";

export interface ParsedThemeCss {
  light: ThemeOverrides;
  dark: ThemeOverrides;
}

/**
 * Preserved parser (old configuration/page.tsx:62-95): extracts the first
 * `:root {…}` and `.dark {…}` blocks and splits `--var: value` declarations.
 */
export function parseCssTheme(css: string): ParsedThemeCss {
  const light: ThemeOverrides = {};
  const dark: ThemeOverrides = {};

  const rootMatch = css.match(/:root\s*\{([^}]+)\}/s);
  if (rootMatch) {
    const variables = rootMatch[1].match(/--[\w-]+:\s*[^;]+/g);
    if (variables) {
      variables.forEach((variable) => {
        const [key, ...valueParts] = variable.split(":");
        light[key.trim()] = valueParts.join(":").trim();
      });
    }
  }

  const darkMatch = css.match(/\.dark\s*\{([^}]+)\}/s);
  if (darkMatch) {
    const variables = darkMatch[1].match(/--[\w-]+:\s*[^;]+/g);
    if (variables) {
      variables.forEach((variable) => {
        const [key, ...valueParts] = variable.split(":");
        dark[key.trim()] = valueParts.join(":").trim();
      });
    }
  }

  return { light, dark };
}

interface CssAnalysis extends ParsedThemeCss {
  /** Declarations inside the found blocks the parser could not read (U16). */
  skippedLines: string[];
  /** Input is non-empty but neither block was found. */
  noBlocks: boolean;
}

function analyzeCss(css: string): CssAnalysis {
  const parsed = parseCssTheme(css);
  const skippedLines: string[] = [];

  const collectSkipped = (blockMatch: RegExpMatchArray | null) => {
    if (!blockMatch) return;
    blockMatch[1]
      .split(";")
      .map((line) => line.trim())
      .filter((line) => line !== "")
      .forEach((line) => {
        if (!/^--[\w-]+\s*:\s*.+$/s.test(line)) skippedLines.push(line);
      });
  };
  collectSkipped(css.match(/:root\s*\{([^}]+)\}/s));
  collectSkipped(css.match(/\.dark\s*\{([^}]+)\}/s));

  const noBlocks =
    css.trim() !== "" &&
    !/:root\s*\{/.test(css) &&
    !/\.dark\s*\{/.test(css);

  return { ...parsed, skippedLines, noBlocks };
}

export interface ImportCssDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the parsed variables; the parent merges them into the draft. */
  onImport: (parsed: ParsedThemeCss) => void;
}

const MAX_SKIPPED_SHOWN = 5;

export function ImportCssDialog({
  open,
  onOpenChange,
  onImport,
}: ImportCssDialogProps) {
  const t = useTranslations("configuration");
  const tCommon = useTranslations("common");
  const [cssInput, setCssInput] = React.useState("");

  // Fresh textarea every time the dialog opens.
  React.useEffect(() => {
    if (open) setCssInput("");
  }, [open]);

  const analysis = React.useMemo(() => analyzeCss(cssInput), [cssInput]);
  const lightCount = Object.keys(analysis.light).length;
  const darkCount = Object.keys(analysis.dark).length;
  const hasInput = cssInput.trim() !== "";

  const handleImport = () => {
    // Parsing is synchronous — no artificial delay (U14 fixed).
    onImport({ light: analysis.light, dark: analysis.dark });
    setCssInput("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] max-w-lg flex-col gap-4 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("import.title")}</DialogTitle>
          <DialogDescription>{t("import.description")}</DialogDescription>
        </DialogHeader>

        <Textarea
          value={cssInput}
          onChange={(event) => setCssInput(event.target.value)}
          placeholder={t("import.placeholder")}
          aria-label={t("import.title")}
          className="min-h-48 max-h-[40dvh] resize-y font-mono text-base md:text-xs"
        />

        {hasInput ? (
          <div className="flex flex-col gap-2 text-xs" role="status">
            {analysis.noBlocks ? (
              <p className="flex items-start gap-1.5 text-warning">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0"
                />
                {t("import.noBlocks")}
              </p>
            ) : (
              <p className="text-muted-foreground">
                {t("import.detected", { lightCount, darkCount })}
              </p>
            )}
            {analysis.skippedLines.length > 0 ? (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-2">
                <p className="flex items-start gap-1.5 font-medium">
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0 text-warning"
                  />
                  {t("import.skipped", {
                    count: analysis.skippedLines.length,
                  })}
                </p>
                <ul className="mt-1.5 space-y-0.5 font-mono text-muted-foreground">
                  {analysis.skippedLines
                    .slice(0, MAX_SKIPPED_SHOWN)
                    .map((line, index) => (
                      <li key={index} className="truncate">
                        {line}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={!hasInput || lightCount + darkCount === 0}
          >
            {t("import.action")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
