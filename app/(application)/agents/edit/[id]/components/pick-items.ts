/**
 * Filtering for the "Add …" picker of the Tools & skills section: a plain
 * substring match over name, description and category, plus an optional
 * category pin. Kept pure so it is testable without React.
 */
export interface PickerItem {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
}

export function filterPickerItems<T extends PickerItem>(items: T[], query: string, category: string | null): T[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (category && (item.category ?? "other") !== category) return false;
    if (!q) return true;
    return `${item.name} ${item.description ?? ""} ${item.category ?? ""}`.toLowerCase().includes(q);
  });
}

/** Distinct categories of the given items, sorted, "other" for items without one. */
export function pickerCategories(items: PickerItem[]): string[] {
  return Array.from(new Set(items.map((i) => i.category || "other"))).sort();
}
