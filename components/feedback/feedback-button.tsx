"use client";

import { useContext, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { useTranslations } from "next-intl";

import { ConfigContext } from "@/components/shell/config-context";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { FeedbackDialog } from "./feedback-dialog";

export function FeedbackButton() {
  const config = useContext(ConfigContext);
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  if (!config?.feedback?.enabled) return null;

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={() => setOpen(true)}
          tooltip={t("feedback.label")}
          aria-label={t("feedback.openButton")}
        >
          <MessageSquarePlus className="h-4 w-4" strokeWidth={1.5} />
          <span className="group-data-[collapsible=icon]:hidden">
            {t("feedback.label")}
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
