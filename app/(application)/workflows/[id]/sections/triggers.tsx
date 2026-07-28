"use client";

/**
 * TriggersSection — the routine's "ways to run it" grouped into one collapsible
 * section with tabs: Email (inbound webhook trigger), Schedule (cron), and API
 * (copyable runWorkflow cURL). Each tab body lives in its own focused file under
 * ./triggers/. Keeps id="triggers" for scroll-spy.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { DetailSection } from "@/components/primitives/detail-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { Routine, RoutineAccess } from "../../types";
import { ApiTriggerTab } from "./triggers/api-tab";
import { EmailTriggerTab } from "./triggers/email-tab";
import { ScheduleTab } from "./triggers/schedule-tab";

export interface TriggersSectionProps {
  routine: Routine;
  access: RoutineAccess;
}

export function TriggersSection({ routine, access }: TriggersSectionProps) {
  const t = useTranslations("routines");

  return (
    <section id="triggers" className="scroll-mt-20" tabIndex={-1}>
      <DetailSection title={t("editor.sections.triggers")} defaultOpen={true}>
        <Tabs defaultValue="email">
          <TabsList>
            <TabsTrigger value="email">{t("triggers.tabs.email")}</TabsTrigger>
            <TabsTrigger value="schedule">
              {t("triggers.tabs.schedule")}
            </TabsTrigger>
            <TabsTrigger value="api">{t("triggers.tabs.api")}</TabsTrigger>
          </TabsList>
          <TabsContent value="email">
            <EmailTriggerTab routine={routine} access={access} />
          </TabsContent>
          <TabsContent value="schedule">
            <ScheduleTab routine={routine} access={access} />
          </TabsContent>
          <TabsContent value="api">
            <ApiTriggerTab routine={routine} />
          </TabsContent>
        </Tabs>
      </DetailSection>
    </section>
  );
}
