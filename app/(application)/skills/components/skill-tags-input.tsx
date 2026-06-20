"use client";

/**
 * SkillTagsInput — tag picker used by the detail-panel inline editor
 * (work item: skills tag editing parity with /prompts).
 *
 * Mirrors the prompts <TagSelector> interaction (pick an existing tag from the
 * accessible-tag universe, or type to create a new one) but is skill-scoped
 * and fully i18n'd. Tags are normalised to lowercase on add so they round-trip
 * cleanly with getUniqueSkillTags (which lowercases) and the
 * `tags: { contains }` jsonb filter on the list view.
 */

import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const normalize = (tag: string) => tag.trim().toLowerCase();

export interface SkillTagsInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Tag universe for autocomplete (from useUniqueSkillTagsLocal). */
  availableTags: string[];
  loading?: boolean;
  className?: string;
}

export function SkillTagsInput({
  value,
  onChange,
  availableTags,
  loading = false,
  className,
}: SkillTagsInputProps) {
  const t = useTranslations("skills");
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const trimmed = query.trim();
  const isNew =
    trimmed.length > 0 &&
    !availableTags.some((tag) => normalize(tag) === normalize(trimmed)) &&
    !value.some((tag) => normalize(tag) === normalize(trimmed));

  const filtered = availableTags.filter((tag) => {
    const matches = tag.toLowerCase().includes(trimmed.toLowerCase());
    const selected = value.some((v) => normalize(v) === normalize(tag));
    return matches && !selected;
  });

  const addTag = (tag: string) => {
    const next = normalize(tag);
    if (!next) return;
    if (value.some((v) => normalize(v) === next)) return;
    onChange([...value, next]);
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((v) => normalize(v) !== normalize(tag)));
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate text-muted-foreground">
              {t("detail.tagsPlaceholder")}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t("detail.tagsSearchPlaceholder")}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {loading ? (
                <CommandEmpty>{t("detail.tagsLoading")}</CommandEmpty>
              ) : (
                <>
                  {isNew ? (
                    <CommandGroup heading={t("detail.tagsCreateHeading")}>
                      <CommandItem
                        value={`__create__${trimmed}`}
                        onSelect={() => {
                          addTag(trimmed);
                          setQuery("");
                        }}
                        className="cursor-pointer"
                      >
                        <Plus className="mr-2 size-4" />
                        <span className="truncate">
                          {t("detail.tagsCreateOption", { tag: trimmed })}
                        </span>
                      </CommandItem>
                    </CommandGroup>
                  ) : null}

                  {filtered.length > 0 ? (
                    <CommandGroup heading={t("detail.tagsExistingHeading")}>
                      {filtered.map((tag) => (
                        <CommandItem
                          key={tag}
                          value={tag}
                          onSelect={() => {
                            addTag(tag);
                            setQuery("");
                          }}
                          className="cursor-pointer"
                        >
                          <Check className="mr-2 size-4 opacity-0" />
                          <span className="truncate">{tag}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}

                  {!isNew && filtered.length === 0 ? (
                    <CommandEmpty>
                      {trimmed
                        ? t("detail.tagsNoMatch")
                        : t("detail.tagsEmpty")}
                    </CommandEmpty>
                  ) : null}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 text-xs">
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-0.5 inline-flex size-4 items-center justify-center rounded hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("detail.tagsRemove", { tag })}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
