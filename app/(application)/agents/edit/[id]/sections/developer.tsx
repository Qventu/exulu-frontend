"use client";

/**
 * Developer section — item 35 (CopyField for agent ID + slug, P4 bias),
 * item 51 (model-auth note + "Edit this model" link — only when a model is
 * set; the unreachable /models fallback is sanctioned dead-code drop).
 */

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";

import { CopyField } from "@/components/primitives/copy-field";
import { Button } from "@/components/ui/button";

import type { EditorSectionProps } from "./types";

export function DeveloperSection({ agent, editor }: EditorSectionProps) {
  const t = useTranslations("agents");

  return (
    <section id="developer" className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">
          {t("editor.sections.developer")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("editor.developer.description")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CopyField label={t("editor.developer.idLabel")} value={agent.id} />
        {agent.slug && (
          <CopyField
            label={t("editor.developer.slugLabel")}
            value={agent.slug}
          />
        )}
      </div>

      {/* Item 51 — model auth row */}
      <div className="space-y-3 rounded-lg border p-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {t("editor.developer.modelAuthTitle")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("editor.developer.modelAuthDescription")}
          </p>
        </div>
        {editor.model ? (
          <Button asChild type="button" variant="outline" size="sm">
            <Link
              href={`/models/edit/${editor.model}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 size-4" />
              {t("editor.developer.editModel")}
            </Link>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("editor.developer.noModelHint")}
          </p>
        )}
      </div>
    </section>
  );
}
