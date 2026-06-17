"use client";

/**
 * ItemCalculatedSection — collapsed DetailSection "Calculated" rendering
 * read-only context-defined calculated fields. When the context has a
 * processor, "Last processed at" appears as the first row.
 *
 * Inventory item #43 (Calculated fields DetailSection — collapsed by
 * default).
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { DetailSection } from "@/components/primitives/detail-section";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Badge } from "@/components/ui/badge";
import type { Item } from "@EXULU_SHARED/models/item";
import type { Context } from "@/types/models/context";

export interface ItemCalculatedSectionProps {
  context: Context;
  item: Item;
}

export function ItemCalculatedSection({
  context,
  item,
}: ItemCalculatedSectionProps) {
  const t = useTranslations("knowledge");

  const calculated = (context.fields ?? []).filter((f) => f.calculated);
  if (!context.processor && calculated.length === 0) return null;

  return (
    <DetailSection
      title={t("workspace.sections.calculated")}
      defaultOpen={false}
      meta={
        <Badge variant="outline" className="text-xs">
          {calculated.length + (context.processor ? 1 : 0)}
        </Badge>
      }
    >
      <dl className="grid grid-cols-1 gap-3 md:grid-cols-[200px_1fr]">
        {context.processor && (
          <>
            <dt className="text-sm font-medium text-muted-foreground">
              {t("workspace.calculated.lastProcessedAt")}
            </dt>
            <dd className="text-sm">
              {item.last_processed_at ? (
                <RelativeTime date={item.last_processed_at} />
              ) : (
                t("workspace.items.never")
              )}
            </dd>
          </>
        )}
        {calculated.map((field) => {
          const value = (item as Record<string, unknown>)[field.name];
          return (
            <React.Fragment key={field.name}>
              <dt className="text-sm font-medium text-muted-foreground">
                {field.label}
              </dt>
              <dd className="text-sm">
                {value === null || value === undefined || value === "" ? (
                  <span className="text-muted-foreground">—</span>
                ) : field.type === "enum" ? (
                  <Badge variant="secondary">{String(value)}</Badge>
                ) : (
                  <span className="whitespace-pre-wrap">{String(value)}</span>
                )}
              </dd>
            </React.Fragment>
          );
        })}
      </dl>
    </DetailSection>
  );
}
