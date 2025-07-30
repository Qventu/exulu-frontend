"use client";

import { useMutation } from "@apollo/client";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { Row } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import {
  GET_USER_ROLES,
  REMOVE_USER_ROLE_BY_ID,
  UPDATE_USER_ROLE_BY_ID,
} from "@/queries/queries";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { z } from "zod";

export const userRoleSchema = z.object({
    id: z.string(),
    agents: z
        .array(
            z.string(),
        )
        .nullable()
        .optional(),
    chains: z
        .array(
            z.object({
                id: z.string(),
                name: z.string().nullable().optional(),
            }),
        )
        .nullable()
        .optional(),
    name: z.string(),
});


interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const role = userRoleSchema.parse(row.original);
  const router = useRouter();
  const { toast } = useToast();

  const [updateUserRole, updateUserRoleResult] = useMutation(
    UPDATE_USER_ROLE_BY_ID,
    {
      refetchQueries: [
        GET_USER_ROLES, // DocumentNode object parsed with gql
        "GetUserRoles", // Query name
      ],
    },
  );

  const [removeUserRole, removeUserRoleResult] = useMutation(
    REMOVE_USER_ROLE_BY_ID,
    {
      refetchQueries: [
        GET_USER_ROLES, // DocumentNode object parsed with gql
        "GetUserRoles", // Query name
      ],
    },
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex size-8 p-0 data-[state=open]:bg-muted"
        >
          <DotsHorizontalIcon className="size-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuItem
          onClick={() => {
            if (role.name === "admin" || role.name === "developer") {
              toast({ title: "Can't remove 'admin' or 'developer' role." });
            }
            removeUserRole({
              variables: {
                id: role.id,
              },
            });
            toast({
              title: "Deleting user role",
              description: "We deleted the user role.",
            });
          }}
        >
          Delete user role
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            router.push(`/roles/${role.id}`);
          }}
        >
          Edit
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
