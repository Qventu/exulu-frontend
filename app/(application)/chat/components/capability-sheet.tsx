"use client";

/**
 * CapabilitySheet — the single "Skills & tools" surface (chat.md items 69/70 + 50).
 *
 * Replaces the two legacy CapabilityPopover instances (chat.tsx:1522–1616):
 *   - "Skills" and "Tools" sections with per-item switches wired to
 *     controller.disabledTools / toggleTool, plus per-section
 *     Enable all / Disable all via controller.enableAll / disableAll.
 *   - "Approved for this chat" section listing controller.preApprovedTools
 *     with a per-row Revoke → controller.revokePreApprovedTool — the
 *     revocation UI that fixes U4's invisible, irrevocable pre-approvals.
 *
 * No purple chips per item (fixes U16) — muted icons + StatusDot only.
 * Desktop (≥md): Popover anchored at its mount position inside the composer
 * card; <md: bottom Sheet (responsive.md T2/T5), max-h-[85dvh], safe-area aware.
 */

import * as React from "react";
import { Anchor as PopoverAnchor } from "@radix-ui/react-popover";
import { useTranslations } from "next-intl";
import { Sparkles, Wrench, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { StatusDot } from "@/components/primitives/status-dot";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import type { ChatSessionController } from "../hooks";

export interface CapabilitySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controller: ChatSessionController; // skills/tools from controller.agent
}

function prettify(name: string) {
  return name.replace(/_/g, " ");
}

function CapabilitySection({
  title,
  icon: Icon,
  items,
  controller,
}: {
  title: string;
  icon: LucideIcon;
  items: Array<{ id: string; name: string }>;
  controller: ChatSessionController;
}) {
  const t = useTranslations("chat");
  if (items.length === 0) return null;

  const ids = items.map((item) => item.id);
  const disabledCount = ids.filter((id) =>
    controller.disabledTools.includes(id),
  ).length;
  const allDisabled = disabledCount === items.length;

  return (
    <section aria-label={title}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <button
          type="button"
          onClick={() =>
            allDisabled ? controller.enableAll(ids) : controller.disableAll(ids)
          }
          className="rounded-sm text-[11px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {allDisabled
            ? t("capabilities.enableAll")
            : t("capabilities.disableAll")}
        </button>
      </div>
      <div className="py-1">
        {items.map((item) => {
          const isEnabled = !controller.disabledTools.includes(item.id);
          return (
            <label
              key={item.id}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 transition-colors duration-150 hover:bg-muted/50",
                // Touch targets ≥44px below md.
                "min-h-[44px] md:min-h-0 md:py-1.5",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    isEnabled
                      ? "text-muted-foreground"
                      : "text-muted-foreground/40",
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "truncate text-sm capitalize",
                    !isEnabled && "text-muted-foreground",
                  )}
                >
                  {prettify(item.name)}
                </span>
              </span>
              <Switch
                checked={isEnabled}
                onCheckedChange={() => controller.toggleTool(item.id)}
                aria-label={
                  isEnabled
                    ? t("capabilities.disableItem", { name: prettify(item.name) })
                    : t("capabilities.enableItem", { name: prettify(item.name) })
                }
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}

function ApprovedSection({ controller }: { controller: ChatSessionController }) {
  const t = useTranslations("chat");
  if (controller.preApprovedTools.length === 0) return null;

  const { agent } = controller;
  const resolveName = (id: string) =>
    agent.tools?.find((tool) => tool.id === id)?.name ??
    agent.skills?.find((skill) => skill.id === id)?.name ??
    id;

  return (
    <section aria-label={t("capabilities.approvedForChat")}>
      <div className="border-b px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("capabilities.approvedForChat")}
        </span>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("capabilities.approvedDescription")}
        </p>
      </div>
      <div className="py-1">
        {controller.preApprovedTools.map((toolId) => (
          <div
            key={toolId}
            className="flex min-h-[44px] items-center justify-between gap-2 px-3 py-1.5 md:min-h-0"
          >
            <span className="flex min-w-0 items-center gap-2">
              <StatusDot status="success" />
              <span className="truncate text-sm capitalize">
                {prettify(resolveName(toolId))}
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 px-3 text-xs md:h-7"
              onClick={() => controller.revokePreApprovedTool(toolId)}
            >
              {t("capabilities.revoke")}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function CapabilityContent({
  controller,
}: {
  controller: ChatSessionController;
}) {
  const t = useTranslations("chat");
  const { agent } = controller;

  return (
    <div className="flex flex-col">
      <div className="max-h-[60dvh] overflow-y-auto scrollbar-subtle md:max-h-96">
        <CapabilitySection
          title={t("capabilities.skills")}
          icon={Sparkles}
          items={agent.skills ?? []}
          controller={controller}
        />
        <CapabilitySection
          title={t("capabilities.tools")}
          icon={Wrench}
          items={agent.tools ?? []}
          controller={controller}
        />
        <ApprovedSection controller={controller} />
      </div>
    </div>
  );
}

export function CapabilitySheet({
  open,
  onOpenChange,
  controller,
}: CapabilitySheetProps) {
  const t = useTranslations("chat");
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-lg p-0 pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="px-4 pb-2 pt-4 text-left">
            <SheetTitle className="text-base">
              {t("capabilities.title")}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t("attach.skillsAndToolsDescription")}
            </SheetDescription>
          </SheetHeader>
          <CapabilityContent controller={controller} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {/* Zero-size anchor, out of flow: the popover opens above the spot
          where the sheet is mounted (next to the ＋ trigger in the composer
          card) without adding a flex-gap slot. */}
      <PopoverAnchor asChild>
        <span className="absolute" aria-hidden="true" />
      </PopoverAnchor>
      <PopoverContent side="top" align="start" className="w-80 p-0">
        <CapabilityContent controller={controller} />
      </PopoverContent>
    </Popover>
  );
}
