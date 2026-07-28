"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import AgentVisual from "@/components/lottie";
import { Button } from "@/components/ui/button";
import { ConfigContext } from "@/components/shell/config-context";
import UppyDashboard, { FileDataCard } from "@/components/primitives/file-picker";

import { AGENT_IMAGE_UPDATE_SUPPORTED } from "../queries";
import type { EditorSectionProps } from "./types";

export function AppearanceSection({ agent, editor }: EditorSectionProps) {
  const t = useTranslations("agents");
  const configContext = React.useContext(ConfigContext);
  const [generatorOpen, setGeneratorOpen] = React.useState(false);

  const initial = (agent.name ?? "A").charAt(0).toUpperCase();

  return (
    <section id="appearance" className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">
          {t("editor.sections.appearance")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("editor.appearance.description")}
        </p>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-4">
          <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
            {editor.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={editor.image}
                alt={agent.name ?? ""}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-muted-foreground">
                {initial}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {t("editor.appearance.avatarTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("editor.appearance.avatarDescription")}
            </p>
            {AGENT_IMAGE_UPDATE_SUPPORTED && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setGeneratorOpen(true)}
              >
                <Sparkles className="mr-2 size-4" />
                {t("editor.appearance.generateButton")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Custom Lottie visualizations (item 55) — s3-gated */}
      {configContext?.fileUploads?.s3endpoint && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">
                {t("editor.appearance.idleLabel")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("editor.appearance.idleDescription")}
              </p>
            </div>
            <FileDataCard s3key={editor.animationIdle}>
              <UppyDashboard
                id="agent-idle-animation"
                global
                allowedFileTypes={[".json"]}
                selectionLimit={1}
                buttonText=""
                dependencies={[agent.id]}
                onConfirm={(keys: string[]) => {
                  if (keys.length > 0) editor.setAnimationIdle(keys[0]);
                }}
              />
              {editor.animationIdle && (
                <div className="mt-2 rounded border bg-muted/30 p-2">
                  <p className="mb-1 text-xs text-muted-foreground">
                    {t("editor.appearance.preview")}
                  </p>
                  <div className="mx-auto size-12">
                    <AgentVisual
                      agent={
                        { ...agent, animation_idle: editor.animationIdle } as any
                      }
                      status="ready"
                    />
                  </div>
                </div>
              )}
            </FileDataCard>
          </div>

          <div className="space-y-2 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">
                {t("editor.appearance.respondingLabel")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("editor.appearance.respondingDescription")}
              </p>
            </div>
            <FileDataCard s3key={editor.animationResponding}>
              <UppyDashboard
                id="agent-responding-animation"
                global
                allowedFileTypes={[".json"]}
                selectionLimit={1}
                buttonText=""
                dependencies={[agent.id]}
                onConfirm={(keys: string[]) => {
                  if (keys.length > 0)
                    editor.setAnimationResponding(keys[0]);
                }}
              />
              {editor.animationResponding && (
                <div className="mt-2 rounded border bg-muted/30 p-2">
                  <p className="mb-1 text-xs text-muted-foreground">
                    {t("editor.appearance.preview")}
                  </p>
                  <div className="mx-auto size-12">
                    <AgentVisual
                      agent={
                        {
                          ...agent,
                          animation_responding: editor.animationResponding,
                        } as any
                      }
                      status="streaming"
                    />
                  </div>
                </div>
              )}
            </FileDataCard>
          </div>
        </div>
      )}
    </section>
  );
}
