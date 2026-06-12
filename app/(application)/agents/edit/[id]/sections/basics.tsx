"use client";

/**
 * Basics section — items 36 (name), 37 (category, 9 hard-coded values),
 * 38 (description), 47 (AgentModelSelector), 46/25 (model/provider badge +
 * semantic-token modality tiles with tap Popovers under the selector).
 *
 * Fixes agents.md #14: capability tiles use semantic tokens (bg-muted /
 * bg-primary-10), never bg-gray-500.
 */

import { FileText, Image as ImageIcon, Text, Video, Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { AgentModelSelector } from "@/app/(application)/agents/components/agent-model-selector";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { EditorSectionProps } from "./types";

const CATEGORIES = [
  "marketing",
  "sales",
  "finance",
  "hr",
  "coding",
  "support",
  "research",
  "knowledge",
  "product",
] as const;

export function BasicsSection({ agent, editor }: EditorSectionProps) {
  const t = useTranslations("agents");
  const tCommon = useTranslations("common");

  const capabilities = [
    {
      key: "text",
      icon: Text,
      enabled: !!agent.capabilities?.text,
      list: agent.capabilities?.text ? [tCommon("enabled")] : [],
    },
    {
      key: "images",
      icon: ImageIcon,
      enabled: !!agent.capabilities?.images?.length,
      list: agent.capabilities?.images ?? [],
    },
    {
      key: "files",
      icon: FileText,
      enabled: !!agent.capabilities?.files?.length,
      list: agent.capabilities?.files ?? [],
    },
    {
      key: "audio",
      icon: Volume2,
      enabled: !!agent.capabilities?.audio?.length,
      list: agent.capabilities?.audio ?? [],
    },
    {
      key: "video",
      icon: Video,
      enabled: !!agent.capabilities?.video?.length,
      list: agent.capabilities?.video ?? [],
    },
  ] as const;

  return (
    <section id="basics" className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{t("editor.sections.basics")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("editor.basics.description")}
        </p>
      </div>

      <Form {...editor.form}>
        <div className="space-y-4">
          <FormField
            control={editor.form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("editor.basics.nameLabel")}</FormLabel>
                <FormControl>
                  <Input type="text" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={editor.form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("editor.basics.categoryLabel")}</FormLabel>
                <FormControl>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue
                        className="capitalize"
                        placeholder={t("editor.basics.categoryPlaceholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((category) => (
                        <SelectItem
                          key={category}
                          value={category}
                          className="capitalize"
                        >
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={editor.form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("editor.basics.descriptionLabel")}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Form>

      <div className="space-y-3">
        <FormLabel className="text-sm font-medium">
          {t("editor.basics.modelLabel")}
        </FormLabel>
        {agent.modelName && agent.providerName && (
          <Badge variant="outline" className="font-normal">
            {t("editor.basics.modelBadge", {
              model: agent.modelName,
              provider: agent.providerName,
            })}
          </Badge>
        )}
        <AgentModelSelector
          value={editor.model}
          onSelect={(id) => {
            editor.setModel(id);
            editor.form.setValue("name", editor.form.getValues("name"), {
              shouldDirty: true,
            });
          }}
        />

        {/* Modality tiles — semantic tokens; tap-friendly popovers for MIME. */}
        <div className="flex flex-wrap items-center gap-2">
          {capabilities.map(({ key, icon: Icon, enabled, list }) => (
            <Popover key={key}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={key}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-xs transition-colors duration-150 md:min-h-8",
                    enabled
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="capitalize">{key}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 text-sm">
                <p className="font-medium capitalize">{key}</p>
                <p className="mt-1 text-muted-foreground">
                  {list.length
                    ? list.join(", ")
                    : t("detailsSheet.capabilityLabels.none")}
                </p>
              </PopoverContent>
            </Popover>
          ))}
        </div>
      </div>
    </section>
  );
}
