"use client";

/**
 * Safety section (item 69 — RESTORED): firewall enable + five scanner
 * SettingRows, wired to staged firewall state and persisted via $firewall
 * (schema-gated by AGENT_FIREWALL_SUPPORTED). Fixes review #2 — until now
 * the capability was triply trapped (never fetched, no UI, never persisted).
 *
 * Fallback: when AGENT_FIREWALL_SUPPORTED=false the section renders a quiet,
 * honest "not available on this backend" notice — never lies.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { EmptyState } from "@/components/primitives/empty-state";
import { SettingRow } from "@/components/primitives/setting-row";
import { Switch } from "@/components/ui/switch";

import { AGENT_FIREWALL_SUPPORTED } from "../queries";
import type { FirewallScanner as FirewallScannerKey } from "../hooks";
import type { EditorSectionProps } from "./types";

const SCANNERS: FirewallScannerKey[] = [
  "promptGuard",
  "codeShield",
  "agentAlignment",
  "hiddenAscii",
  "piiDetection",
];

export function SafetySection({ editor }: EditorSectionProps) {
  const t = useTranslations("agents");

  if (!AGENT_FIREWALL_SUPPORTED) {
    return (
      <section id="safety" className="scroll-mt-20 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">
            {t("editor.sections.safety")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("editor.safety.description")}
          </p>
        </div>
        <EmptyState
          variant="quiet"
          title={t("editor.safety.unsupportedTitle")}
          description={t("editor.safety.unsupportedDescription")}
        />
      </section>
    );
  }

  return (
    <section id="safety" className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{t("editor.sections.safety")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("editor.safety.description")}
        </p>
      </div>

      <div className="space-y-3">
        <SettingRow
          htmlFor="agent-firewall-enabled"
          label={t("editor.safety.enableLabel")}
          description={t("editor.safety.enableDescription")}
        >
          <Switch
            id="agent-firewall-enabled"
            checked={editor.firewall.enabled}
            onCheckedChange={(checked) =>
              editor.setFirewall({ ...editor.firewall, enabled: checked })
            }
          />
        </SettingRow>

        {SCANNERS.map((key) => (
          <SettingRow
            key={key}
            htmlFor={`agent-firewall-${key}`}
            label={t(`editor.safety.scanners.${key}.label`)}
            description={t(`editor.safety.scanners.${key}.description`)}
          >
            <Switch
              id={`agent-firewall-${key}`}
              checked={editor.firewall.scanners[key]}
              disabled={!editor.firewall.enabled}
              onCheckedChange={(checked) =>
                editor.setFirewall({
                  ...editor.firewall,
                  scanners: {
                    ...editor.firewall.scanners,
                    [key]: checked,
                  },
                })
              }
            />
          </SettingRow>
        ))}
      </div>
    </section>
  );
}
