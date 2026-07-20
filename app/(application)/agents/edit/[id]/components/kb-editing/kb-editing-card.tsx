"use client";

/**
 * Knowledge base editing — per-agent write access to knowledge bases. Stages a
 * knowledge_base_editor entry in editor.tools; per-context create/update
 * checkboxes are explicit opt-in (unchecking both removes the context).
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

import type { ToolConfigEntry } from "../tool-config-fields";
import {
  KB_EDITOR_TOOL_ID,
  makeKbEditorTool,
  parseKbEditingConfig,
  serializeKbEditingConfig,
  type KbEditingConfig,
} from "./config-schema";
import type { EditorSectionProps } from "../../sections/types";

export function KbEditingCard({ editor, refs }: EditorSectionProps) {
  const t = useTranslations("agents");

  const entry = editor.tools.find((tool) => tool.id === KB_EDITOR_TOOL_ID);
  const enabled = !!entry;
  const config = parseKbEditingConfig(entry?.config as ToolConfigEntry[] | undefined);

  const applyConfig = (next: KbEditingConfig) => {
    editor.setTools(
      editor.tools.map((tool) =>
        tool.id === KB_EDITOR_TOOL_ID
          ? { ...tool, config: serializeKbEditingConfig(next) as never }
          : tool,
      ),
    );
  };

  const toggleEnabled = (on: boolean) => {
    if (on) {
      editor.setTools([
        ...editor.tools,
        makeKbEditorTool({ knowledgeBases: {}, skipApproval: false }),
      ]);
    } else {
      editor.setTools(editor.tools.filter((tool) => tool.id !== KB_EDITOR_TOOL_ID));
    }
  };

  const setContextEnabled = (id: string, on: boolean) => {
    const next: KbEditingConfig = {
      ...config,
      knowledgeBases: { ...config.knowledgeBases },
    };
    if (on) {
      next.knowledgeBases[id] = { create: true, update: false };
    } else {
      delete next.knowledgeBases[id];
    }
    applyConfig(next);
  };

  const setPermission = (id: string, key: "create" | "update", on: boolean) => {
    const current = config.knowledgeBases[id] ?? { create: false, update: false };
    const nextPerm = { ...current, [key]: on };
    const next: KbEditingConfig = {
      ...config,
      knowledgeBases: { ...config.knowledgeBases },
    };
    if (!nextPerm.create && !nextPerm.update) {
      delete next.knowledgeBases[id];
    } else {
      next.knowledgeBases[id] = nextPerm;
    }
    applyConfig(next);
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {t("editor.knowledge.editing.title")}{" "}
            <Badge variant="outline" className="ml-1 font-normal">
              {enabled ? t("editor.knowledge.enabled") : t("editor.knowledge.disabled")}
            </Badge>
          </p>
          <p className="text-sm text-muted-foreground">
            {t("editor.knowledge.editing.description")}
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={toggleEnabled}
          aria-label={t("editor.knowledge.editing.title")}
        />
      </div>

      {enabled && (
        <div className="space-y-3 border-t pt-3">
          {refs.contexts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("editor.knowledge.noContexts")}
            </p>
          )}
          {refs.contexts.map((ctx) => {
            const perms = config.knowledgeBases[ctx.id];
            const isOn = !!perms;
            return (
              <div key={ctx.id} className="space-y-3 rounded-md border p-3">
                <label className="flex items-start gap-3">
                  <Checkbox
                    checked={isOn}
                    onCheckedChange={(v) => setContextEnabled(ctx.id, v === true)}
                    className="mt-0.5"
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{ctx.name}</span>
                    {ctx.description && (
                      <span className="block text-xs text-muted-foreground">
                        {ctx.description}
                      </span>
                    )}
                  </span>
                </label>
                {isOn && (
                  <div className="flex gap-6 border-t pt-3">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={perms.create}
                        onCheckedChange={(v) => setPermission(ctx.id, "create", v === true)}
                      />
                      {t("editor.knowledge.editing.createLabel")}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={perms.update}
                        onCheckedChange={(v) => setPermission(ctx.id, "update", v === true)}
                      />
                      {t("editor.knowledge.editing.updateLabel")}
                    </label>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex items-start justify-between gap-3 border-t pt-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {t("editor.knowledge.editing.skipApprovalTitle")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("editor.knowledge.editing.skipApprovalDescription")}
              </p>
            </div>
            <Switch
              checked={config.skipApproval}
              onCheckedChange={(v) => applyConfig({ ...config, skipApproval: v })}
              aria-label={t("editor.knowledge.editing.skipApprovalTitle")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
