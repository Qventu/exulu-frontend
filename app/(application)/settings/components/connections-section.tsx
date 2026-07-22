"use client";

/**
 * /settings § Connections — stored tool credentials, metadata + revoke only
 * (spec — backend repo — 2026-07-22-tool-credentials-chat-ui-design.md §3).
 * UsageSection pattern: self-contained, brings its own leading Separator.
 * Page rules respected: FormSection + Separator, zero Cards, no new primary
 * elements (Revoke is outline + text-destructive). Values are never shown —
 * there is nothing to reveal, only revoke.
 */

import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { FormSection } from "@/components/primitives/form-section";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  credentialsApi,
  useStoredCredentials,
  type StoredCredential,
} from "@/lib/credentials";

export function ConnectionsSection() {
  const t = useTranslations("settings");
  const { data, loading, error, refetch } = useStoredCredentials();
  const [revokeTarget, setRevokeTarget] = React.useState<StoredCredential | null>(null);

  // Resolve closes the dialog; rejecting keeps it open (ConfirmDialog owns
  // the pending state). Error toast leads plain-language, raw detail below.
  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await credentialsApi.remove(revokeTarget.provider);
    } catch (err) {
      toast.error(t("connections.revokeErrorTitle"), {
        description: err instanceof Error ? err.message : String(err),
        duration: 5000,
      });
      throw err;
    }
    toast.success(t("connections.revokedTitle"), { duration: 3000 });
    setRevokeTarget(null);
    refetch();
  };

  return (
    <>
      <Separator />
      <FormSection
        id="connections"
        className="scroll-mt-24"
        title={t("connections.title")}
        description={t("connections.description")}
      >
        {error ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">{t("connections.error")}</p>
            <Button variant="outline" size="sm" onClick={refetch}>
              {t("connections.retry")}
            </Button>
          </div>
        ) : loading || data === null ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("connections.empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {data.map((credential) => (
              <li
                key={credential.provider}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{credential.provider}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("connections.connectedOn", {
                      date: new Date(credential.updatedAt).toLocaleDateString(),
                    })}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="h-11 text-destructive hover:text-destructive md:h-8"
                  onClick={() => setRevokeTarget(credential)}
                >
                  {t("connections.revoke")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        title={t("connections.revokeConfirmTitle", {
          provider: revokeTarget?.provider ?? "",
        })}
        description={t("connections.revokeConfirmDescription", {
          provider: revokeTarget?.provider ?? "",
        })}
        confirmLabel={t("connections.revokeConfirmAction")}
        onConfirm={confirmRevoke}
      />
    </>
  );
}
