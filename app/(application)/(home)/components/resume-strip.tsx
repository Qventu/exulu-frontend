"use client";

/**
 * Region A — "Pick up where you left off" (design/pages/dashboard.md §3 #2).
 *
 * Up to 4 compact session cards (GET_AGENT_SESSIONS, recency-sorted); one
 * click resumes at /chat/{agent}/{session}. Below `sm` the strip is a
 * vertical list capped at 3 full-width rows (doc mobile spec); cards are
 * ≥44px tap targets with a visible structure (responsive.md T7 — no
 * hover-only affordance).
 */

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { EmptyState } from "@/components/primitives/empty-state";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { ResumeSession } from "../hooks";

export interface ResumeStripProps {
  sessions: ResumeSession[];
  loading: boolean;
  error: boolean;
}

export function ResumeStrip({ sessions, loading, error }: ResumeStripProps) {
  const t = useTranslations("home");

  if (loading) {
    return (
      <div
        role="status"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn("h-24 w-full rounded-lg", index === 3 && "hidden sm:block")}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        {t("resume.error")}
      </p>
    );
  }

  if (sessions.length === 0) {
    // The zero-agents / first-session case on Home (inventory #4 equivalent
    // for elevated users): one quiet line + the path into chat.
    return (
      <EmptyState
        variant="quiet"
        icon={MessageCircle}
        title={t("resume.emptyTitle")}
        description={t("resume.emptyDescription")}
        action={{ label: t("resume.emptyAction"), href: "/chat" }}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {sessions.slice(0, 4).map((session, index) => {
        const href = session.agentId
          ? `/chat/${session.agentId}/${session.id}`
          : "/chat";
        return (
          <Card
            key={session.id}
            className={cn(
              "transition-colors duration-150 hover:border-primary/40",
              // Mobile caps the strip at 3 full-width rows (doc mobile spec).
              index === 3 && "hidden sm:block",
            )}
          >
            <Link
              href={href}
              className="block min-h-11 space-y-1 rounded-lg p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {session.agentName && (
                <p className="truncate text-sm font-medium text-foreground">
                  {session.agentName}
                </p>
              )}
              <p
                className={cn(
                  "truncate text-sm",
                  session.agentName
                    ? "text-muted-foreground"
                    : "font-medium text-foreground",
                )}
              >
                {session.title || t("resume.untitled")}
              </p>
              <p className="text-xs text-muted-foreground">
                <RelativeTime date={session.updatedAt} />
              </p>
            </Link>
          </Card>
        );
      })}
    </div>
  );
}
