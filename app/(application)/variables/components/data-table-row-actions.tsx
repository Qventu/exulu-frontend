"use client";

import { useMutation } from "@apollo/client";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { Row } from "@tanstack/react-table";
import Link from "next/link";
import {
  GET_VARIABLES,
  REMOVE_VARIABLE_BY_ID,
} from "@/queries/queries";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Variable } from "./columns";

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const variable = row.original as Variable;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { toast } = useToast();

  const [removeVariable, removeVariableResult] = useMutation(REMOVE_VARIABLE_BY_ID, {
    refetchQueries: [
      GET_VARIABLES,
      "GetVariables",
    ],
  });

  const handleDelete = async () => {
    try {
      await removeVariable({
        variables: {
          id: variable.id,
        },
      });
      toast({
        title: "Variable deleted",
        description: "The variable has been successfully deleted.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete the variable. Please try again.",
        variant: "destructive",
      });
    }
    setShowDeleteDialog(false);
  };

  const usedByCount = variable.used_by?.length || 0;

  return (
    <>
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
          <DropdownMenuItem asChild>
            <Link href={`/variables/edit/${variable.id}`}>
              Edit variable
            </Link>
          </DropdownMenuItem>
          {usedByCount > 0 && (
            <DropdownMenuItem asChild>
              <Link href={`/variables/usage/${variable.id}`}>
                View usage ({usedByCount})
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-red-600"
          >
            Delete variable
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Variable</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the variable "{variable.name}"?
              {usedByCount > 0 && (
                <>
                  <br />
                  <br />
                  <strong>Warning:</strong> This variable is currently used by {usedByCount} resource{usedByCount !== 1 ? 's' : ''}. 
                  Deleting it may impact those resources.
                </>
              )}
              <br />
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}