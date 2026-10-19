"use client";

/**
 * The "Add …" picker of the Tools & skills section. The section itself shows
 * only what is enabled; this dialog is where the catalogue lives: search,
 * an optional category filter (tools), a scrollable list with checkboxes,
 * and one "Add N" action. Already-enabled entries are shown ticked and
 * cannot be selected again.
 */

import { Check, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { filterPickerItems, pickerCategories, type PickerItem } from "./pick-items";

export type PickerKind = "tools" | "agents" | "skills";

export interface AddItemsDialogProps<T extends PickerItem> {
  kind: PickerKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: T[];
  enabledIds: ReadonlySet<string>;
  onAdd: (items: T[]) => void;
  loading?: boolean;
}

export function AddItemsDialog<T extends PickerItem>({ kind, open, onOpenChange, items, enabledIds, onAdd, loading = false }: AddItemsDialogProps<T>) {
  const t = useTranslations("agents");
  const tCommon = useTranslations("common");
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setCategory(null);
    setSelected(new Set());
  }, [open]);

  const categories = React.useMemo(() => (kind === "tools" ? pickerCategories(items) : []), [kind, items]);
  const visible = React.useMemo(() => filterPickerItems(items, query, category), [items, query, category]);
  const addable = visible.filter((i) => !enabledIds.has(i.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const confirm = () => {
    const chosen = items.filter((i) => selected.has(i.id) && !enabledIds.has(i.id));
    if (chosen.length) onAdd(chosen);
    onOpenChange(false);
  };

  const title = kind === "tools" ? t("editor.tools.addTools") : kind === "agents" ? t("editor.tools.addSubAgents") : t("editor.tools.addSkills");
  const placeholder = kind === "tools" ? t("editor.tools.pickerSearchTools") : kind === "agents" ? t("editor.tools.pickerSearchAgents") : t("editor.tools.pickerSearchSkills");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("editor.tools.pickerDescription", { enabled: items.filter((i) => enabledIds.has(i.id)).length, total: items.length })}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="pl-9" autoFocus />
        </div>

        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={category === null ? "default" : "outline"} aria-pressed={category === null} onClick={() => setCategory(null)}>
              {t("editor.tools.allCategories")}
            </Button>
            {categories.map((c) => (
              <Button key={c} type="button" size="sm" variant={category === c ? "default" : "outline"} aria-pressed={category === c} className="capitalize" onClick={() => setCategory(c)}>
                {c}
              </Button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border" role="listbox" aria-multiselectable="true" aria-label={title}>
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">{tCommon("loading")}</p>
          ) : visible.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t("editor.tools.pickerNoResults")}</p>
          ) : (
            <ul className="divide-y">
              {visible.map((item) => {
                const enabled = enabledIds.has(item.id);
                const checked = enabled || selected.has(item.id);
                const inputId = `pick-${kind}-${item.id}`;
                return (
                  <li key={item.id} role="option" aria-selected={checked} className={cn("flex items-start gap-3 px-3 py-2.5", !enabled && "hover:bg-muted/50")}>
                    <Checkbox id={inputId} checked={checked} disabled={enabled} onCheckedChange={() => toggle(item.id)} className="mt-0.5" aria-label={item.name} />
                    <label htmlFor={inputId} className={cn("min-w-0 flex-1", enabled ? "cursor-default" : "cursor-pointer")}>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium capitalize">{item.name?.replace(/_/g, " ")}</span>
                        {item.category && kind === "tools" && (
                          <Badge variant="secondary" className="text-xs capitalize">
                            {item.category}
                          </Badge>
                        )}
                        {enabled && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Check aria-hidden="true" className="size-3" />
                            {t("editor.tools.pickerAlreadyEnabled")}
                          </Badge>
                        )}
                      </span>
                      {item.description && <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{item.description}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-sm text-muted-foreground">{t("editor.tools.pickerSelected", { selected: selected.size, addable: addable.length })}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="button" onClick={confirm} disabled={selected.size === 0}>
              {t("editor.tools.pickerAdd", { count: selected.size })}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
