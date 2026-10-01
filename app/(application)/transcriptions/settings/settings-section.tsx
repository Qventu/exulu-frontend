"use client";

/**
 * One of the five Transcripts settings sections — a collapsible card with a
 * one-line summary in its header, so an admin can read the current state
 * without opening it. `open`/`onOpenChange` are controlled by the page so
 * only one section is ever open at a time; a section whose summary
 * `needsAttention` renders the line in the warning color (no violet/purple —
 * brand petrol/teal + the existing semantic `text-warning` token, matching
 * the rest of the app).
 */
import { ChevronDown } from "lucide-react";
import * as React from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface SettingsSectionProps {
  title: string;
  summary: string;
  needsAttention: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function SettingsSection({
  title,
  summary,
  needsAttention,
  open,
  onOpenChange,
  children,
}: SettingsSectionProps) {
  const contentId = React.useId();

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="rounded-lg border">
      <h2 className="text-base font-medium">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            aria-controls={contentId}
            className={cn(
              "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left",
              "transition-colors duration-150 ease-in-out hover:bg-muted/50 motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate">{title}</span>
              <span
                className={cn(
                  "truncate text-sm font-normal",
                  needsAttention ? "text-warning" : "text-muted-foreground",
                )}
              >
                {summary}
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-in-out motion-reduce:transition-none",
                open && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent id={contentId} className="border-t px-4 pb-5 pt-4">
        <div className="flex flex-col gap-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
