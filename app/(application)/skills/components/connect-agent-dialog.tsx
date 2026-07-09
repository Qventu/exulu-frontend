"use client";

/**
 * ConnectAgentDialog — shows the one-liner install command for this Exulu
 * instance so a coding agent can pull and install skills locally.
 *
 * Reads `window.location.origin` client-side (no server round-trip needed
 * because the install route lives on this same origin).
 */

import { Copy, Terminal } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ConnectAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectAgentDialog({
  open,
  onOpenChange,
}: ConnectAgentDialogProps) {
  const t = useTranslations("skills");
  const tCommon = useTranslations("common");

  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const cmd = `curl -fsSL ${origin}/api/skills/install.sh | sh`;

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      toast.success(tCommon("copied"));
    } catch {
      toast.error(tCommon("copyFailed"));
    }
  }, [cmd, tCommon]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal aria-hidden="true" className="size-5 text-primary" />
            {t("connect.title")}
          </DialogTitle>
          <DialogDescription>{t("connect.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              {t("connect.instruction")}
            </p>
            <div className="flex items-stretch gap-2">
              <div className="min-w-0 flex-1 overflow-hidden rounded-md border bg-muted/30">
                <pre className="overflow-x-auto p-3 text-xs font-mono leading-relaxed">
                  <code>{cmd}</code>
                </pre>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 self-stretch"
                onClick={() => void handleCopy()}
                aria-label={tCommon("copy")}
              >
                <Copy aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {t("connect.details")}
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {tCommon("close")}
          </Button>
          <Button type="button" onClick={() => void handleCopy()}>
            <Copy aria-hidden="true" className="mr-2 size-4" />
            {t("connect.copy")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
