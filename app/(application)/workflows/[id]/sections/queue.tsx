"use client";

/**
 * QueueSection — editable select binding the routine's own queue
 * (workflow_templates.queue, the single source of truth) via the page-level
 * editor form. Options come from the backend's registered queues
 * (GET_AVAILABLE_QUEUES). The stored value is always shown as an option even if
 * it is no longer registered (see mergeQueueOptions), so the user can see and
 * change it. "Manage queue" opens the workbench QueuePanel Sheet for the
 * currently-selected queue.
 */

import { useQuery } from "@apollo/client";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { GET_AVAILABLE_QUEUES } from "../../queries";
import { mergeQueueOptions } from "./queue-options";
import type { RoutineSectionProps } from "./types";

export function QueueSection({ editor, workbench }: RoutineSectionProps) {
  const t = useTranslations("routines");
  const canWrite = workbench.access.canWrite;

  const { data, loading } = useQuery<{ queues?: { name: string }[] }>(
    GET_AVAILABLE_QUEUES,
    { fetchPolicy: "cache-first" },
  );

  const current = editor.form.watch("queue");
  const options = mergeQueueOptions(data?.queues ?? [], current);
  const noneAvailable = !loading && options.length === 0;

  return (
    <section id="queue" className="scroll-mt-20 space-y-4" tabIndex={-1}>
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{t("queue.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("queue.description")}
        </p>
      </div>

      <Form {...editor.form}>
        <FormField
          control={editor.form.control}
          name="queue"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("queue.label")}</FormLabel>
              <div className="flex flex-wrap items-center gap-3">
                <FormControl>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    disabled={!canWrite || loading || noneAvailable}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder={t("queue.placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((q) => (
                        <SelectItem key={q.name} value={q.name}>
                          <span className="capitalize">
                            {q.name.replaceAll("_", " ")}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                {field.value ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => workbench.openQueue(field.value)}
                  >
                    {t("queue.manage")}
                  </Button>
                ) : null}
              </div>
              {noneAvailable ? (
                <p className="text-sm text-muted-foreground">
                  {t("queue.noneAvailable")}
                </p>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    </section>
  );
}
