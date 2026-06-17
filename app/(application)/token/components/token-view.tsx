"use client";

/**
 * /token — the masked, expiry-honest, grab-and-go card (keys-token.md §3).
 * Primary persona P4: copy a working bearer token in under five seconds.
 *
 * - One card; the page's single purple element is the "Copy token" action
 *   (PageHeader slot + the same action in the mobile top bar) — the job is
 *   copying, not reading.
 * - The token renders in a SecretField: masked by default, deliberate reveal
 *   (fixes U11), copy works without revealing.
 * - The expiry chip decodes the JWT `exp` claim (fixes U12): quiet while
 *   >1 h, orange under 1 h, red when expired — superseding the binary
 *   Active/Unavailable badge while preserving its meaning (row 27: the
 *   no-token "Unavailable" signal is the EmptyState error variant below,
 *   which replaces the card — the chip never renders without a token).
 * - A collapsed "Usage example (cURL)" disclosure (L2) carries a copyable
 *   snippet with the backend URL pre-filled; the token itself stays a
 *   placeholder in the snippet — the secret is never rendered un-masked.
 * - Skeleton instead of the dark-mode-invisible spinner (fixes U10); the
 *   no-token / unauthenticated edges render EmptyState variants with a
 *   "Sign in again" action (rows 26/31).
 */

import { Check, ChevronRight, Copy } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { CopyButton } from "@/components/primitives/copy-button";
import { EmptyState } from "@/components/primitives/empty-state";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { SecretField } from "@/components/primitives/secret-field";
import { StatusDot } from "@/components/primitives/status-dot";
import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import { ConfigContext } from "@/components/shell/config-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { UserContext } from "@/app/(application)/authenticated";
import { can } from "@/lib/rights";

import { type TokenExpiryState, usePersonalToken } from "../hooks";

export function TokenView() {
  const t = useTranslations("token");
  const tCommon = useTranslations("common");
  const { status, token, loading, expiry } = usePersonalToken();
  const config = React.useContext(ConfigContext);
  const userContext = React.useContext(UserContext);

  const showKeysLink = React.useMemo(() => {
    const user = userContext?.user;
    if (!user) return false;
    // Same predicate as the /keys nav entry + route guard (nav-config "keys").
    return can(
      { super_admin: user.super_admin === true, role: user.role },
      { area: "api", level: "write" },
    );
  }, [userContext]);

  const snippet = React.useMemo(() => {
    const backend = config?.backend || "";
    return [
      `curl -X POST ${backend}/graphql \\`,
      `  -H "Authorization: Bearer $EXULU_TOKEN" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '{"query":"{ agentsPagination(page: 1, limit: 10) { items { id name } } }"}'`,
    ].join("\n");
  }, [config]);

  const isLoading = status === "loading" || loading;

  return (
    <PageShell variant="narrow">
      {token ? (
        <MobileTopbarAction>
          <CopyTokenButton token={token} size="sm" />
        </MobileTopbarAction>
      ) : null}

      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          token ? <CopyTokenButton token={token} /> : undefined
        }
      />

      {isLoading ? (
        <TokenSkeleton />
      ) : status === "unauthenticated" ? (
        // Edge: client-side session lag (the layout normally redirects first).
        <EmptyState
          variant="error"
          title={t("authRequiredTitle")}
          description={t("authRequiredDescription")}
          action={{ label: t("signInAgain"), href: "/login" }}
        />
      ) : !token ? (
        <EmptyState
          variant="error"
          title={t("noTokenTitle")}
          description={t("noTokenDescription")}
          action={{ label: t("signInAgain"), href: "/login" }}
        />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg">
                {t("cardTitle")}
                <ExpiryChip expiry={expiry} activeLabel={tCommon("active")} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SecretField
                getValue={async () => token}
                copyLabel={t("copyToken")}
              />
              <p className="text-xs text-muted-foreground">
                {t("sentAs")}{" "}
                <code className="break-all font-mono">
                  {"Authorization: Bearer <token>"}
                </code>
              </p>
              <p className="text-xs text-muted-foreground">
                {t("securityNote")}
              </p>

              {/* L2: usage example disclosure */}
              <Collapsible className="group">
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="-ml-2 h-9 gap-1 px-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 transition-transform duration-200 group-data-[state=open]:rotate-90"
                    />
                    {t("usageExample")}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 flex items-start gap-2 rounded-md bg-muted p-3">
                    <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-xs leading-relaxed">
                      {snippet}
                    </pre>
                    <CopyButton value={snippet} label={t("copySnippet")} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Quiet cross-link, only when the caller passes the keys gate. */}
          {showKeysLink ? (
            <p className="text-xs text-muted-foreground">
              {t("keysCrossLink")}{" "}
              <Link
                href="/keys"
                className="underline underline-offset-2 transition-colors duration-150 hover:text-foreground"
              >
                {t("keysCrossLinkAction")}
              </Link>
            </p>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}

/**
 * The page's primary action: a labeled copy button with the standard
 * Copy→Check feedback (2 s revert) and toast — the one purple element.
 */
function CopyTokenButton({
  token,
  size = "default",
}: {
  token: string;
  size?: "default" | "sm";
}) {
  const t = useTranslations("token");
  const tCommon = useTranslations("common");
  const [copied, setCopied] = React.useState(false);
  const resetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      toast.success(tCommon("copied"));
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(tCommon("copyFailed"));
    }
  };

  return (
    <Button type="button" size={size} onClick={handleCopy}>
      {copied ? (
        <Check aria-hidden="true" className="mr-2 size-4" />
      ) : (
        <Copy aria-hidden="true" className="mr-2 size-4" />
      )}
      {t("copyToken")}
    </Button>
  );
}

/**
 * Expiry chip — semantic colors only by state (philosophy §4): quiet while
 * healthy, orange under an hour, red when expired. Static — a visibly ticking
 * countdown is anxiety, not transparency. The chip renders only when a token
 * exists; the no-token "Unavailable" signal (ladder row 27) is carried by the
 * EmptyState error variant that replaces the whole card.
 */
function ExpiryChip({
  expiry,
  activeLabel,
}: {
  expiry: TokenExpiryState;
  activeLabel: string;
}) {
  const t = useTranslations("token");

  const { status, label } = React.useMemo(() => {
    switch (expiry.kind) {
      case "expired":
        return { status: "error" as const, label: t("expired") };
      case "soon":
        return {
          status: "warning" as const,
          label: t("expiresInMinutes", { minutes: expiry.minutes }),
        };
      case "ok":
        return {
          status: "success" as const,
          label: t("expiresInHours", { hours: expiry.hours }),
        };
      case "noExpiry":
      default:
        // Row 27 preserved: no exp claim ⇒ the old "Active" signal.
        return { status: "success" as const, label: activeLabel };
    }
  }, [expiry, t, activeLabel]);

  return <StatusDot status={status} label={label} />;
}

/** Skeleton mirroring the card (header line + field row) — fixes U10. */
function TokenSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-28" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}
