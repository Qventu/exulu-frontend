import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

interface PromptFiltersProps {
  sortBy: string;
  onSortChange: (sort: string) => void;
}

export function PromptFilters({
  sortBy,
  onSortChange,
}: PromptFiltersProps) {

  const sortOptions = [
    { value: "updatedAt", label: "Recently Updated" },
    { value: "createdAt", label: "Recently Created" },
    { value: "favorite_count", label: "Most Favorited" },
    { value: "usage_count", label: "Most Used" },
    { value: "name", label: "Alphabetical" },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">
          Sort:{" "}
          {sortOptions.find((opt) => opt.value === sortBy)?.label ||
            "Recently Updated"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Sort By</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={sortBy} onValueChange={onSortChange}>
          {sortOptions.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
