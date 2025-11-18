"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";

export const columns: ColumnDef<any>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px] max-w-[50px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  /*{
    accessorKey: "id",
    cell: ({ row }) => <div className="w-[200px]">{row.original.id}</div>,
    enableSorting: false,
    enableHiding: false,
  },*/
  {
    accessorKey: "Description",
    cell: ({ row }) => {
      /*const label = labels.find((label) => label.value === row.original.label)*/

      console.log("original", row.original);
      return (
        <div className="flex flex-column grid grid-cols-1">
          {/*{label && <Badge variant="outline">{label.label}</Badge>}*/}
          <span className="max-w-[500px] truncate font-medium w-full">
            {row.original.name
              ? row.original.name
              : row.original.text?.slice(0, 200) || "Untitled"}
          </span>
          <small className="mt-1">
            {format(new Date(row.original.createdAt), "PP")}
          </small>
        </div>
      );
    },
  },
];
