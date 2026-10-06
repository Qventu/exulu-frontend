"use client";

/**
 * Header-sized trigger for a draft transcript's sharing.
 *
 * `RBACControl` is a form field — it renders its own "Visibility & sharing"
 * label above a select — so dropping it straight into the page header made
 * the header a head taller than its own content. It is shared with other
 * features, so rather than restyle it this wraps it in a dialog behind a
 * button that reads like the rest of the header, and shows the current mode
 * the way read mode's chip does.
 */
import { Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { RBACControl } from "@/components/rbac";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Mode, RbacRole, RbacUser } from "../types";

export function SharingButton({
  allowedModes,
  rightsMode,
  users,
  roles,
  onChange,
}: {
  allowedModes: Mode[];
  rightsMode: Mode;
  users: RbacUser[];
  roles: RbacRole[];
  onChange: (mode: Mode, users: RbacUser[], roles: RbacRole[]) => void;
}) {
  const t = useTranslations("transcriptions");
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="max-md:h-11"
        onClick={() => setOpen(true)}
      >
        <Share2 aria-hidden="true" className="mr-2 size-4" />
        {t("document.sharingButton")}
        <span className="ml-1.5 text-muted-foreground">
          {t(`mode.${rightsMode === "teams" ? "private" : rightsMode}`)}
        </span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{t("document.sharingDialogTitle")}</DialogTitle>
          </DialogHeader>
          <RBACControl
            allowedModes={allowedModes}
            subjectLabel={t("sharing.subject")}
            initialRightsMode={rightsMode}
            initialUsers={users}
            initialRoles={roles}
            modalMode
            onChange={(nextMode, nextUsers, nextRoles) =>
              onChange(nextMode as Mode, nextUsers, nextRoles)
            }
          />
          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)} className="max-md:h-11">
              {t("document.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
