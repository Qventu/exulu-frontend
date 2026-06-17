import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Project avatar — image thumbnail or a neutral `bg-muted` initial
 * (projects.md §3: replaces the decorative green→blue gradient, UX 13;
 * philosophy §4 "semantic colors only for meaning"). Decorative: the project
 * name is always rendered as text next to it.
 */
export function ProjectAvatar({
  name,
  image,
  className,
}: {
  name?: string | null;
  image?: string | null;
  className?: string;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-provided URL; matches legacy behavior (project-nav.tsx:72)
      <img
        src={image}
        alt=""
        aria-hidden="true"
        className={cn(
          "size-8 shrink-0 rounded-full object-cover",
          className,
        )}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {(name?.trim()?.charAt(0) || "P").toUpperCase()}
    </div>
  );
}
