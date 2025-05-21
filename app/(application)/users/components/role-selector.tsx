"use client";

import { useQuery } from "@apollo/client";
import { CaretSortIcon } from "@radix-ui/react-icons";
import { useRouter } from "next/navigation";
import * as React from "react";
import { GET_USER_ROLES } from "@/queries/queries";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Loading } from "@/components/ui/loading";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserRole } from "@EXULU_SHARED/models/user-role";

export function RoleSelector({ navigate, onSelect, params, ...props }: any) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<UserRole | null>(null);
  const router = useRouter();

  // todo: run stripHTMl function on results
  const { loading, error, data, refetch } = useQuery(GET_USER_ROLES, {
    variables: {
      page: 1,
      limit: 10,
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label="Select a role..."
          aria-expanded={open}
          className="flex-1 justify-between md:max-w-[200px] lg:max-w-[300px]"
        >
          {selected ? selected.role : "Select a role"}
          <CaretSortIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandList className="h-[var(--cmdk-list-height)] max-h-[400px]">
            {loading ? (
              <CommandItem key={"loading"}>
                <Loading />
              </CommandItem>
            ) : (
              <CommandGroup>
                {data?.userRolePagination?.items.map((role: UserRole) => (
                  <CommandItem
                    key={role.id}
                    onSelect={() => {
                      if (onSelect) {
                        onSelect(role);
                      }
                      setSelected(role);
                      setOpen(false);
                    }}
                  >
                    {role.role ? role.role : role.id}
                  </CommandItem>
                ))}
                <CommandEmpty>No roles found.</CommandEmpty>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
