"use client";

/**
 * /transcriptions/settings — workspace defaults for the Transcripts feature
 * (settings design doc, task-7 brief). A static segment that wins over the
 * sibling `/transcriptions/[itemId]` route, exactly like `/transcriptions/
 * review/[jobId]` already does — Next.js prefers the static match.
 *
 * The entry point (the Transcripts header's "…" menu) is visible to every
 * user, so this page is reachable by anyone — the server-side gate lives on
 * the mutation and the source-test route (settings design doc §6), not here.
 * A non-admin therefore gets a plain "ask an admin" state, never a 404 or the
 * shared hard `AccessDenied` (that would contradict the menu being visible to
 * everyone in the first place).
 *
 * Six sections (fix round 1, critical: the design doc's §5 names six —
 * Knowledge base and agents was missing from the original five), one open at
 * a time: the first whose summary needs attention opens automatically, once,
 * the first time settings finish loading — it never re-opens a section the
 * admin has since closed.
 *
 * Every `summariseX` returns a translation key + values (fix round 1, minor
 * #3) rather than rendered text, so this is the one place that actually
 * calls `t(...)` on them — `translate` below centralizes that.
 */
import { useTranslations } from "next-intl";
import * as React from "react";

import { UserContext } from "@/app/(application)/authenticated";
import { EmptyState } from "@/components/primitives/empty-state";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { ConfigContext } from "@/components/shell/config-context";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { useTranscriptsSettings } from "../hooks";
import { DefaultsSection } from "./defaults-section";
import { useTranscriptsContext, useTranscriptsEmbedder } from "./embedder";
import { useTranscriptsKnowledgeAgents } from "./knowledge";
import { KnowledgeSection } from "./knowledge-section";
import { LimitsSection } from "./limits-section";
import { MeetingBotSection } from "./meeting-bot-section";
import {
  summariseDefaults,
  summariseKnowledge,
  summariseLimits,
  summariseMeetingBot,
  summariseSources,
  summariseStorage,
  type SectionSummary,
} from "./section-summary";
import { SettingsSection } from "./settings-section";
import { SourcesSection } from "./sources-section";
import { StorageSection } from "./storage-section";

type SectionId = "sources" | "meetingBot" | "defaults" | "storage" | "limits" | "knowledge";

export default function TranscriptsSettingsPage() {
  const t = useTranslations("transcriptions");
  // Turns a pure summariseX() result into the localized summary line — the
  // only place these keys get rendered (section-summary.ts's docstring).
  // next-intl's TranslationValues has no boolean case (string | number |
  // Date only), so booleans are stringified here — the ICU `select` clauses
  // in messages/*.json match on the resulting "true"/"false" literally.
  const translate = (summary: SectionSummary | null): string => {
    if (!summary) return "";
    const values = summary.values
      ? Object.fromEntries(
          Object.entries(summary.values).map(([key, value]) => [
            key,
            typeof value === "boolean" ? String(value) : value,
          ]),
        )
      : undefined;
    return t(summary.key, values);
  };

  const { user } = React.useContext(UserContext);
  const config = React.useContext(ConfigContext);
  const isAdmin = !!user?.super_admin;

  const { settings, stalePresets, loading, error, save, testSource } = useTranscriptsSettings();
  const {
    context,
    loading: contextLoading,
    error: contextError,
  } = useTranscriptsContext(!isAdmin);
  const embedder = useTranscriptsEmbedder(!isAdmin);
  const knowledgeAgents = useTranscriptsKnowledgeAgents(!isAdmin);

  const [openSection, setOpenSection] = React.useState<SectionId | null>(null);
  const autoOpenedRef = React.useRef(false);

  const embedderConfigured = !!embedder.info?.effectiveModel;
  const sourcesSummary = summariseSources({
    upload: !!config?.whisper?.enabled,
    meeting: !!config?.recall?.enabled,
    record: !!config?.transcription?.enabled,
    embedderConfigured,
  });

  const meetingBotSummary = settings
    ? summariseMeetingBot({
        botName: settings.botName.value ?? t("composer.botNamePlaceholder"),
        notifyChat: settings.notifyChat.value ?? true,
        mayOverride: settings.recordersMayOverrideBot.value ?? true,
      })
    : null;

  const defaultsSummary = settings
    ? summariseDefaults({
        // Already translated here — summariseDefaults never calls `t` itself.
        defaultRightsMode: t(`mode.${settings.defaultRightsMode.value ?? "private"}`),
        presetCount: settings.summaryPresets.value.length,
        stalePresetCount: stalePresets.length,
      })
    : null;

  const storageSummary = settings
    ? summariseStorage({
        retentionHours: settings.videoRetentionHours.value,
        storeVideoLocally: settings.storeVideoLocally.value ?? false,
        costPerHour: settings.videoStorageCostPerHour.value ?? 0,
      })
    : null;

  const limitsSummary = settings
    ? summariseLimits({ limitMinutes: settings.monthlyRecordingLimitMinutes.value })
    : null;

  const knowledgeSummary = summariseKnowledge({
    readCount: knowledgeAgents.readCount,
    writeCount: knowledgeAgents.writeCount,
  });

  // Auto-open the first section that needs attention, in render order, once
  // settings have loaded — and only once, so closing it again doesn't get
  // fought.
  React.useEffect(() => {
    if (autoOpenedRef.current || !settings) return;
    autoOpenedRef.current = true;
    if (sourcesSummary.needsAttention) {
      setOpenSection("sources");
    } else if (defaultsSummary?.needsAttention) {
      setOpenSection("defaults");
    } else if (!knowledgeAgents.loading && knowledgeSummary.needsAttention) {
      setOpenSection("knowledge");
    }
  }, [
    settings,
    sourcesSummary.needsAttention,
    defaultsSummary?.needsAttention,
    knowledgeAgents.loading,
    knowledgeSummary.needsAttention,
  ]);

  if (!isAdmin) {
    return (
      <PageShell variant="content">
        <PageHeader
          title={t("settings.pageTitle")}
          breadcrumb={{ label: t("title"), href: "/transcriptions" }}
        />
        <EmptyState
          variant="quiet"
          title={t("settings.notAdmin.title")}
          description={t("settings.notAdmin.description")}
        />
      </PageShell>
    );
  }

  return (
    <PageShell variant="content">
      <PageHeader
        title={t("settings.pageTitle")}
        description={t("settings.pageDescription")}
        breadcrumb={{ label: t("title"), href: "/transcriptions" }}
        meta={<Badge variant="secondary">{t("settings.adminsOnlyBadge")}</Badge>}
      />

      {loading && !settings ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : !settings ? (
        <EmptyState
          variant="error"
          title={t("settings.loadError")}
          description={error?.message}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <SettingsSection
            title={t("settings.sections.sources")}
            summary={translate(sourcesSummary)}
            needsAttention={sourcesSummary.needsAttention}
            open={openSection === "sources"}
            onOpenChange={(open) => setOpenSection(open ? "sources" : null)}
          >
            <SourcesSection
              testSource={testSource}
              context={context}
              contextLoading={contextLoading}
              contextError={contextError}
              embedderInfo={embedder.info}
              embedderModels={embedder.models}
              embedderQueues={embedder.queues}
              onSetEmbedder={embedder.setEmbedder}
            />
          </SettingsSection>

          <SettingsSection
            title={t("settings.sections.meetingBot")}
            summary={translate(meetingBotSummary)}
            needsAttention={meetingBotSummary?.needsAttention ?? false}
            open={openSection === "meetingBot"}
            onOpenChange={(open) => setOpenSection(open ? "meetingBot" : null)}
          >
            <MeetingBotSection settings={settings} onSave={save} />
          </SettingsSection>

          <SettingsSection
            title={t("settings.sections.defaults")}
            summary={translate(defaultsSummary)}
            needsAttention={defaultsSummary?.needsAttention ?? false}
            open={openSection === "defaults"}
            onOpenChange={(open) => setOpenSection(open ? "defaults" : null)}
          >
            <DefaultsSection settings={settings} stalePresets={stalePresets} onSave={save} />
          </SettingsSection>

          <SettingsSection
            title={t("settings.sections.storage")}
            summary={translate(storageSummary)}
            needsAttention={storageSummary?.needsAttention ?? false}
            open={openSection === "storage"}
            onOpenChange={(open) => setOpenSection(open ? "storage" : null)}
          >
            <StorageSection settings={settings} onSave={save} />
          </SettingsSection>

          <SettingsSection
            title={t("settings.sections.limits")}
            summary={translate(limitsSummary)}
            needsAttention={limitsSummary?.needsAttention ?? false}
            open={openSection === "limits"}
            onOpenChange={(open) => setOpenSection(open ? "limits" : null)}
          >
            <LimitsSection settings={settings} onSave={save} />
          </SettingsSection>

          <SettingsSection
            title={t("settings.sections.knowledge")}
            summary={translate(knowledgeSummary)}
            needsAttention={knowledgeSummary.needsAttention}
            open={openSection === "knowledge"}
            onOpenChange={(open) => setOpenSection(open ? "knowledge" : null)}
          >
            <KnowledgeSection
              agents={knowledgeAgents.agents}
              loading={knowledgeAgents.loading}
              error={knowledgeAgents.error}
            />
          </SettingsSection>
        </div>
      )}
    </PageShell>
  );
}
