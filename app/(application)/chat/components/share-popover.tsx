"use client";

/**
 * SharePopover — the session Share surface (chat.md item 29, L2 with the
 * access-rights editor at L3 inside an "Access" collapsible).
 *
 * Replaces the legacy header Share popover (chat.tsx:903–969). Opened from
 * the ChatHeader ⋯ menu, so it renders as a small controlled Dialog rather
 * than an anchored Popover (a menu item cannot host a popover anchor; the
 * menu closes before the surface opens — one overlay at a time).
 *
 * CONTRACT DIVERGENCE (flagged in the builder report): the binding
 * `SharePopoverProps` is `{ session, creatorEmail }` only — without a
 * controlled `open`/`onOpenChange` the surface could never be launched from
 * the OverflowMenu. The two controlled props are added; everything else is
 * verbatim.
 *
 * Gating (write access + existing session) is owned by the caller
 * (ChatHeader only offers the menu item when `controller.writeAccess` and a
 * session exist).
 *
 * Mutation semantics identical to legacy: UPDATE_AGENT_SESSION_RBAC
 * (chat/queries.ts byte-identical copy), no refetchQueries.
 */

import { useMutation } from "@apollo/client";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { CopyButton } from "@/components/primitives/copy-button";
import { Loading } from "@/components/primitives/loading";
import { RBACControl } from "@/components/rbac";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AgentSession } from "@/types/models/agent-session";

import { UPDATE_AGENT_SESSION_RBAC } from "../queries";

export interface SharePopoverProps {
  session: AgentSession;
  creatorEmail?: string;
  /** Controlled open state — see CONTRACT DIVERGENCE note above. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RbacDraft = {
  rights_mode: "private" | "users" | "roles" | "teams" | "public";
  users: Array<{ id: number; rights: "read" | "write" }>;
  roles: Array<{ id: string; rights: "read" | "write" }>;
};

export function SharePopover({
  session,
  creatorEmail,
  open,
  onOpenChange,
}: SharePopoverProps) {
  const t = useTranslations("chat");
  const [accessOpen, setAccessOpen] = React.useState(false);
  const [rbac, setRbac] = React.useState<RbacDraft>(() => ({
    rights_mode: session.rights_mode || "private",
    users: session.RBAC?.users || [],
    roles: session.RBAC?.roles || [],
  }));
  const [updateRbac, { loading: saving }] = useMutation(
    UPDATE_AGENT_SESSION_RBAC,
  );

  // Re-seed the draft from the session whenever the surface (re)opens.
  React.useEffect(() => {
    if (open) {
      setRbac({
        rights_mode: session.rights_mode || "private",
        users: session.RBAC?.users || [],
        roles: session.RBAC?.roles || [],
      });
      setAccessOpen(false);
    }
  }, [open, session]);

  // Safe: the dialog body only mounts client-side after `open` flips true.
  const url = typeof window !== "undefined" ? window.location.href : "";

  const handleSave = async () => {
    try {
      await updateRbac({
        variables: {
          id: session.id,
          rights_mode: rbac.rights_mode,
          RBAC: {
            users: rbac.users,
            roles: rbac.roles,
          },
        },
      });
      toast.success(t("share.saved"));
    } catch (error) {
      toast.error(t("share.saveFailed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-4 overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("share.title")}</DialogTitle>
          <DialogDescription>{t("share.description")}</DialogDescription>
        </DialogHeader>

        {/* Session link (L2) */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium">{t("share.linkLabel")}</p>
          {creatorEmail ? (
            <p className="text-xs text-muted-foreground">
              {t("share.createdBy", { email: creatorEmail })}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={url}
              aria-label={t("share.linkLabel")}
              onFocus={(event) => event.currentTarget.select()}
              className="h-9 min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-2.5 text-xs text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <CopyButton value={url} label={t("share.copyLink")} />
          </div>
        </div>

        {/* Access-rights editor (L3) — deliberate step into configuration. */}
        <Collapsible
          open={accessOpen}
          onOpenChange={setAccessOpen}
          className="border-t pt-2"
        >
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full justify-between px-2 sm:min-h-9"
            >
              <span className="text-sm font-medium">{t("share.access")}</span>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                  accessOpen && "rotate-180",
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            <RBACControl
              allowedModes={["private", "users", "roles"]}
              subjectLabel={t("share.subjectLabel")}
              initialRightsMode={session.rights_mode}
              initialUsers={session.RBAC?.users}
              initialRoles={session.RBAC?.roles}
              onChange={(rights_mode, users, roles) => {
                setRbac({ rights_mode, users, roles });
              }}
            />
            <Button
              type="button"
              className="w-full"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {t("share.save")}
              {saving ? <Loading className="ml-2" /> : null}
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </DialogContent>
    </Dialog>
  );
}
