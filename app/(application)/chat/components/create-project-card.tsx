"use client";

/**
 * create_project: the approval summary (what exactly is approved: the project
 * name and the files to move) and the project card under the result.
 * Never navigates by itself; the link opens a new tab, so the chat (or the
 * artifact hosting it) stays where it is.
 */

import { ExternalLink, FolderOpen } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createContext, useContext } from "react";

import { Button } from "@/components/ui/button";

import { describeCreateProjectInput, projectIdOf } from "../lib/create-project";

export function CreateProjectApprovalSummary({ input }: { input: unknown }) {
  const t = useTranslations("chat");
  const { name, files } = describeCreateProjectInput(input);
  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
      <p className="font-medium [overflow-wrap:anywhere]">{t("approval.createProject.summary", { name, count: files.length })}</p>
      <div>
        <p className="text-xs text-muted-foreground">{t("approval.createProject.files")}</p>
        {files.length === 0 ? (
          <p className="text-muted-foreground">{t("approval.createProject.noFiles")}</p>
        ) : (
          <ul className="max-h-48 list-disc overflow-y-auto pl-5">
            {files.map((file, i) => (
              <li key={`${i}-${file}`} className="[overflow-wrap:anywhere]">
                {file}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("approval.createProject.private")}</p>
    </div>
  );
}

/**
 * The open session's project id, provided by MessageColumn. A context rather
 * than a factory argument: the tool-card components are built by memoised
 * factories, and a changing project id in their deps would give every card a
 * new identity (remounting them and losing their expanded state).
 */
export const SessionProjectContext = createContext<string>("");

/**
 * Only for the project that was really created: the id in the result must be
 * the session's own project (known after the session lookup), so a failure
 * text that merely mentions a /projects path never gets a link.
 */
export function OpenProjectLink({
  output,
  name,
  sessionProjectId,
}: {
  output: unknown;
  /** The project's name as the call gave it; the card falls back to a generic title without it. */
  name?: string;
  sessionProjectId?: string | null;
}) {
  const t = useTranslations("chat");
  const fromContext = useContext(SessionProjectContext);
  sessionProjectId = sessionProjectId ?? fromContext;
  const id = projectIdOf(output);
  if (!id || !sessionProjectId || String(sessionProjectId).toLowerCase() !== id.toLowerCase()) return null;
  const title = name?.trim();
  return (
    <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <FolderOpen className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        {title ? <p className="text-xs text-muted-foreground">{t("createProject.label")}</p> : null}
        <p className="truncate text-sm font-medium" title={title || undefined}>
          {title || t("createProject.label")}
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0 gap-1.5">
        <Link href={`/projects/${id}`} target="_blank" rel="noopener noreferrer" title={t("createProject.newTab")}>
          {t("createProject.open")}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}
