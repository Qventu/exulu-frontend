"use client";

/**
 * Basics section — inline form for name, description, and the agent the
 * routine runs on. Replaces the killed RoutineEditorDialog's Setup tab fields.
 *
 * Wired via RHF FormField from editor.form (the page-level form). Disabled
 * branches honour workbench.access.canWrite (read-only mode).
 *
 * Agent dropdown sources its options from a route-local agents listing
 * (GET_AGENTS_FOR_ROUTINE) — bounded page, name-sorted. If the routine's
 * existing agent id is not in the loaded page, we still render it as the
 * selected option (resolved via the workbench-resolved agentName) so the
 * trigger does not show a blank value while the list is paging in.
 */

import { useQuery } from "@apollo/client";
import { useTranslations } from "next-intl";
import * as React from "react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { GET_AGENTS_FOR_ROUTINE } from "../../queries";
import type { RoutineSectionProps } from "./types";

interface AgentOption {
  id: string;
  name: string;
}

export function BasicsSection({ routine, editor, workbench }: RoutineSectionProps) {
  const t = useTranslations("routines");
  const canWrite = workbench.access.canWrite;

  const { data, loading } = useQuery<{
    agentsPagination?: { items: AgentOption[] };
  }>(GET_AGENTS_FOR_ROUTINE, {
    variables: { page: 1, limit: 100 },
    fetchPolicy: "cache-first",
  });

  const items: AgentOption[] = data?.agentsPagination?.items ?? [];

  // Ensure the currently-selected agent is always available as an option
  // (the listing is bounded to 100; routines configured against an agent
  // outside that page would otherwise show a blank trigger).
  const currentAgentId = editor.form.watch("agent");
  const options = React.useMemo(() => {
    const known = new Set(items.map((a) => a.id));
    const extras: AgentOption[] = [];
    if (currentAgentId && !known.has(currentAgentId)) {
      extras.push({
        id: currentAgentId,
        name: workbench.agentName ?? currentAgentId,
      });
    }
    return [...extras, ...items];
  }, [items, currentAgentId, workbench.agentName]);

  return (
    <section id="basics" className="scroll-mt-20 space-y-4" tabIndex={-1}>
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
                  <Input
                    type="text"
                    placeholder={t("editor.name.placeholder")}
                    {...field}
                    value={field.value ?? ""}
                    readOnly={!canWrite}
                  />
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
                    placeholder={t("editor.description.placeholder")}
                    {...field}
                    value={field.value ?? ""}
                    readOnly={!canWrite}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={editor.form.control}
            name="agent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("editor.basics.agentLabel")}</FormLabel>
                <FormControl>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    disabled={!canWrite || loading}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t("editor.basics.agentPlaceholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Form>

      {/* Created/Updated meta moved here from the deleted Overview section. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
        <span>
          {t("overview.created")}{" "}
          {new Date(routine.createdAt).toLocaleString()}
        </span>
        <span>
          {t("overview.updated")}{" "}
          {new Date(routine.updatedAt).toLocaleString()}
        </span>
      </div>
    </section>
  );
}
