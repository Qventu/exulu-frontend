"use client";

import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CopyField } from "@/components/primitives/copy-field";
import { StatusDot } from "@/components/primitives/status-dot";
import { ProviderLogo } from "@/components/provider-logo";
import { cn } from "@/lib/utils";

import type { LiteLLMCatalogEntry } from "./types";
import { formatCostPerMillion, formatTokens } from "./format";

interface ModelDetailSheetProps {
  entry: LiteLLMCatalogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CapabilityRow({
  label,
  supported,
  notSupportedLabel,
}: {
  label: string;
  supported: boolean | null | undefined;
  notSupportedLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {supported ? (
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <Check aria-hidden="true" className="size-4 text-success" />
        </span>
      ) : (
        <span className="text-muted-foreground">{notSupportedLabel}</span>
      )}
    </div>
  );
}

function FieldRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export function ModelDetailSheet({
  entry,
  open,
  onOpenChange,
}: ModelDetailSheetProps) {
  const t = useTranslations("models");
  const tCommon = useTranslations("common");
  const [rawJsonOpen, setRawJsonOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) setRawJsonOpen(false);
  }, [open]);

  if (!entry) return null;

  const notSupported = t("detail.notSupported");
  const status = entry.active ? "success" : "muted";
  const statusLabel = entry.active
    ? t("status.active")
    : t("status.inactive");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex w-full flex-col gap-0 overflow-hidden p-0",
          "sm:max-w-md",
        )}
      >
        <SheetHeader className="border-b p-6">
          <div className="flex items-center gap-3">
            <ProviderLogo
              brand={entry.brand}
              region={entry.region}
              size={24}
            />
            <SheetTitle className="min-w-0 flex-1 truncate text-lg font-semibold">
              {entry.model_name}
            </SheetTitle>
          </div>
          <div className="pt-1">
            <StatusDot status={status} label={statusLabel} />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t("detail.capabilities")}
            </h3>
            <div className="space-y-2 rounded-md border bg-card p-4">
              <CapabilityRow
                label={t("modality.vision")}
                supported={entry.supports_vision}
                notSupportedLabel={notSupported}
              />
              <CapabilityRow
                label={t("modality.pdf")}
                supported={entry.supports_pdf_input}
                notSupportedLabel={notSupported}
              />
              <CapabilityRow
                label={t("modality.audio")}
                supported={entry.supports_audio_input}
                notSupportedLabel={notSupported}
              />
              <CapabilityRow
                label={t("modality.tools")}
                supported={entry.supports_function_calling}
                notSupportedLabel={notSupported}
              />
              <div className="border-t pt-2 space-y-2">
                <FieldRow
                  label={t("detail.maxInput")}
                  value={formatTokens(entry.max_input_tokens)}
                />
                <FieldRow
                  label={t("detail.maxOutput")}
                  value={formatTokens(entry.max_output_tokens)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t("detail.cost")}
            </h3>
            <div className="space-y-2 rounded-md border bg-card p-4">
              <FieldRow
                label={t("detail.inputCost")}
                value={
                  entry.input_cost_per_million_tokens != null
                    ? `$${formatCostPerMillion(entry.input_cost_per_million_tokens)} / 1M`
                    : notSupported
                }
              />
              <FieldRow
                label={t("detail.outputCost")}
                value={
                  entry.output_cost_per_million_tokens != null
                    ? `$${formatCostPerMillion(entry.output_cost_per_million_tokens)} / 1M`
                    : notSupported
                }
              />
            </div>
          </section>

          {entry.upstream_model ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t("detail.routing")}
              </h3>
              <CopyField
                label={t("detail.upstreamModel")}
                value={entry.upstream_model}
              />
            </section>
          ) : null}

          {entry.tags && entry.tags.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t("detail.tags")}
              </h3>
              <div className="flex flex-wrap gap-1">
                {entry.tags.map((tag, i) => (
                  <Badge key={`tag-${i}`} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-2">
            <button
              type="button"
              onClick={() => setRawJsonOpen((v) => !v)}
              aria-expanded={rawJsonOpen}
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {rawJsonOpen ? (
                <ChevronDown aria-hidden="true" className="size-4" />
              ) : (
                <ChevronRight aria-hidden="true" className="size-4" />
              )}
              {t("detail.rawJson")}
            </button>
            {rawJsonOpen ? (
              <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                {JSON.stringify(entry, null, 2)}
              </pre>
            ) : null}
          </section>
        </div>

        <SheetFooter className="border-t p-4">
          <SheetClose asChild>
            <Button variant="outline" type="button">
              {tCommon("close")}
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
