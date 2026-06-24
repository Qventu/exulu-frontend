"use client";

import { useEffect } from "react";

export function Centered({
  title,
  subtitle,
  actionHref,
  actionLabel,
}: {
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      {actionHref && (
        <a href={actionHref} className="text-sm text-primary underline">
          {actionLabel ?? "Download"}
        </a>
      )}
    </div>
  );
}

export function AutoDownload({ url, filename }: { url: string; filename: string }) {
  useEffect(() => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [url, filename]);

  return (
    <Centered
      title="Your download should begin…"
      subtitle={filename}
      actionHref={url}
      actionLabel="Download manually"
    />
  );
}
