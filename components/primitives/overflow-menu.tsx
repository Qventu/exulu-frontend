"use client";

/**
 * OverflowMenu — the standardized "⋯" actions menu used by every list-row
 * action set, the chat header, evals run columns and skills rows/editor.
 *
 * Spec: design/codebase-structure.md §2.3 (registry prop sketch:
 * `{ items: {label, icon?, onSelect, destructive?, disabled?, shortcut?}[]; align? }`,
 * ARIA-labeled trigger); design/pages/chat.md (destructive section rendered
 * last); design/responsive.md T7 (hover → touch: the trigger is ALWAYS visible
 * on touch devices — `revealOnHover` only fades it on hover-capable,
 * fine-pointer devices, and never removes the keyboard/touch path).
 *
 * ConfirmDialog integration point (codebase-structure §2.2): destructive items
 * are styled and grouped here but never confirmed here. The consumer opens the
 * shared `<ConfirmDialog>` from the item's `onSelect`, rendering the dialog as
 * a sibling of the menu (not inside it) so it survives the menu closing —
 * one overlay at a time, never menu-in-dialog nesting.
 */

import { type LucideIcon, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface OverflowMenuItem {
  /** Visible item label (already translated by the consumer). */
  label: string;
  icon?: LucideIcon;
  /**
   * Action callback. For destructive items, open the shared ConfirmDialog
   * from here (rendered outside the menu); never mutate without confirmation.
   */
  onSelect: () => void;
  /**
   * Destructive items are styled with destructive tokens and grouped last,
   * behind a separator. Gate the action via ConfirmDialog (see file JSDoc).
   */
  destructive?: boolean;
  /** When true, renders a DropdownMenuSeparator after this item within the standard items group. */
  dividerAfter?: boolean;
  disabled?: boolean;
  /**
   * Optional one-line muted sub-label rendered under the label. Use it to
   * explain WHY an item is disabled (disabled menu items receive no pointer
   * events, so a tooltip can never fire on them).
   */
  description?: string;
  /** Display-only keyboard shortcut hint (e.g. "⌘D"). */
  shortcut?: string;
}

export interface OverflowMenuProps {
  items: OverflowMenuItem[];
  /** Menu alignment relative to the trigger. Defaults to "end". */
  align?: "start" | "center" | "end";
  /** Accessible label for the icon-only trigger. Defaults to common "Actions". */
  label?: string;
  /**
   * T7 hover→touch: when true, the trigger fades out until its `group`
   * container is hovered or focused — but ONLY under
   * `@media (hover: hover) and (pointer: fine)`. On touch devices it stays
   * always visible (hover-only affordances are banned). Requires a `group`
   * class on the surrounding row/card container.
   */
  revealOnHover?: boolean;
  /** Extra classes for the trigger button (e.g. sizing overrides). */
  className?: string;
}

const OverflowMenu = React.forwardRef<HTMLButtonElement, OverflowMenuProps>(
  ({ items, align = "end", label, revealOnHover = false, className }, ref) => {
    const t = useTranslations();

    const standardItems = items.filter((item) => !item.destructive);
    const destructiveItems = items.filter((item) => item.destructive);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={ref}
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label ?? t("common.actions")}
            className={cn(
              "size-8",
              revealOnHover && [
                "transition-opacity duration-150 motion-reduce:transition-none",
                // Hide only on hover-capable fine-pointer devices (T7) …
                "[@media(hover:hover)_and_(pointer:fine)]:opacity-0",
                // … and reveal on row hover/focus, own focus, or open menu.
                "group-hover:opacity-100 group-focus-within:opacity-100",
                "focus-visible:opacity-100 data-[state=open]:opacity-100",
              ],
              className,
            )}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align}>
          {standardItems.map((item, index) => (
            <React.Fragment key={`${index}-${item.label}`}>
              <OverflowMenuEntry item={item} />
              {item.dividerAfter && index < standardItems.length - 1 && (
                <DropdownMenuSeparator />
              )}
            </React.Fragment>
          ))}
          {standardItems.length > 0 && destructiveItems.length > 0 ? (
            <DropdownMenuSeparator />
          ) : null}
          {destructiveItems.map((item, index) => (
            <OverflowMenuEntry key={`${index}-${item.label}`} item={item} />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);
OverflowMenu.displayName = "OverflowMenu";

function OverflowMenuEntry({ item }: { item: OverflowMenuItem }) {
  const Icon = item.icon;
  return (
    <DropdownMenuItem
      disabled={item.disabled}
      onSelect={() => item.onSelect()}
      className={cn(
        item.destructive &&
          "text-destructive focus:bg-destructive/10 focus:text-destructive",
      )}
    >
      {Icon ? <Icon className="mr-2 size-4 shrink-0" /> : null}
      {item.description ? (
        <span className="flex min-w-0 flex-col">
          <span>{item.label}</span>
          <span className="text-xs text-muted-foreground">
            {item.description}
          </span>
        </span>
      ) : (
        item.label
      )}
      {item.shortcut ? (
        <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>
      ) : null}
    </DropdownMenuItem>
  );
}

export { OverflowMenu };
