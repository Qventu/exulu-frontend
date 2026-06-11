"use client";

/**
 * The genuine route-segment error boundary for /login (design/pages/auth.md
 * U8 — this reserved filename used to host an ordinary alert component,
 * which now lives in components/auth-error-alert.tsx).
 *
 * Renders inside the (authentication) layout, so the AuthShell frame
 * (wordmark, cover pane, footer) still wraps it — the failure stays inside
 * the brand. Calm copy + a real recovery action (`reset()`).
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";

export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("auth");

  React.useEffect(() => {
    // Surface the real failure for diagnostics — the UI stays calm.
    console.error("[login] render error:", error);
  }, [error]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("boundary.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("boundary.description")}
        </p>
      </div>
      <Button type="button" onClick={reset} className="h-11 w-full md:h-10">
        {t("boundary.retry")}
      </Button>
    </div>
  );
}
