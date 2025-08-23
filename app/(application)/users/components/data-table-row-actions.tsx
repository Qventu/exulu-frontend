"use client";

import { useMutation } from "@apollo/client";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { Row } from "@tanstack/react-table";
import {
  GET_USERS,
  REMOVE_USER_BY_ID,
  UPDATE_USER_BY_ID,
} from "@/queries/queries";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { userSchema } from "../data/schema";
import { UserContext } from "@/app/(application)/authenticated";
import { useContext } from "react";
interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const { user: currentUser } = useContext(UserContext);
  const user = userSchema.parse(row.original);

  const { toast } = useToast();

  const [updateUser, updateUserResult] = useMutation(UPDATE_USER_BY_ID, {
    refetchQueries: [
      GET_USERS, // DocumentNode object parsed with gql
      "GetUsers", // Query name
    ],
  });

  const [removeUser, removeUserResult] = useMutation(REMOVE_USER_BY_ID, {
    refetchQueries: [
      GET_USERS, // DocumentNode object parsed with gql
      "GetUsers", // Query name
    ],
  });

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
            if (currentUser.id === user.id) {
              toast({
                title: "Cannot delete your own user",
                description: "You cannot delete your own user, that would be a bad idea.",
              });
              return;
            }

            const confirm = window.confirm("Are you sure you want to delete this user?");
            
            if (!confirm) {
              return;
            }

            removeUser({
              variables: {
                id: user.id,
              },
            });
            toast({
              title: "Deleting user",
              description: "We deleted the user.",
            });
          }}
        >
          Delete user
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
