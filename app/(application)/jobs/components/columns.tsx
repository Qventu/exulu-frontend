"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import Link from "next/link";
import * as React from "react";
import { NumericFormat } from "react-number-format";
import { Checkbox } from "@/components/ui/checkbox";
import { Loading } from "@/components/ui/loading";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";
import { statuses } from "../data/data";
import { Job } from "../data/schema";

export const columns: ColumnDef<Job>[] = [
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
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      return (
        <div className="flex space-x-2">
          <span className="max-w-[300px] truncate font-medium">
             <Link href={`/jobs/${row.original.id}`}>
                {row.original.name}
              </Link>
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = statuses.find(
        (status) => status.value === row.original.status,
      );

      if (!status) {
        return null;
      }

      if (status.value === "pending") {
        return (
          <div className="flex w-[100px] items-center">
            {status.icon && (
              <status.icon className="mr-2 size-4 text-muted-foreground" />
            )}
            <span>{status.label}</span>
          </div>
        );
      }
      if (status.value === "running") {
        return (
          <div className="flex w-[100px] items-center">
            {status.icon && (
              <status.icon className="mr-2 size-4 text-indigo-700" />
            )}
            <span className="text-indigo-700">{status.label}</span>
          </div>
        );
      }
      if (status.value === "waiting") {
        return (
          <div className="flex w-[100px] items-center">
            {status.icon && (
              <status.icon className="mr-2 size-4 text-muted-foreground" />
            )}
            <span>{status.label}</span>
          </div>
        );
      }
      if (status.value === "completed") {
        return (
          <div className="flex w-[100px] items-center">
            {status.icon && (
              <status.icon className="mr-2 size-4 text-green-500" />
            )}
            <span className="text-green-500">{status.label}</span>
          </div>
        );
      }
      if (status.value === "error") {
        return (
          <div className="flex w-[100px] items-center">
            {status.icon && (
              <status.icon className="mr-2 size-4 text-rose-800" />
            )}
            <span className="text-rose-800">{status.label}</span>
          </div>
        );
      }
      if (status.value === "cancelled") {
        return (
          <div className="flex w-[100px] items-center">
            {status.icon && (
              <status.icon className="mr-2 size-4 text-rose-800" />
            )}
            <span className="text-rose-800">{status.label}</span>
          </div>
        );
      }

      return (
        <div className="flex w-[100px] items-center">
          {status.icon && (
            <status.icon className="mr-2 size-4 text-muted-foreground" />
          )}
          <span>{status.label}</span>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created at" />
    ),
    cell: ({ row }) => {
      if (!row.original.createdAt) {
        return <p>-</p>;
      }

      return (
        <div className="flex items-center">
          {format(new Date(row.original.createdAt), "PP hh:mm")}
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "date_started",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Started at" />
    ),
    cell: ({ row }) => {
      if (!row.original.date_started) {
        return <p>-</p>;
      }

      return (
        <div className="flex items-center">
          {format(new Date(row.original.date_started), "PP hh:mm")}
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "duration",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Duration" />
    ),
    cell: ({ row }) => {
      if (!row.original.date_started) {
        return <p>-</p>;
      }
      if (!row.original.createdAt) {
        return <p>-</p>;
      }
      const startedAt = new Date(row.original.date_started);
      const completedAt = row.original.date_done
        ? new Date(row.original.date_done)
        : new Date();
      const hours = (completedAt?.getTime() - startedAt?.getTime()) / 3600000;
      const minutes = Math.round(
        (completedAt?.getTime() - startedAt?.getTime()) / 60000,
      );
      const seconds = Math.round(
        (completedAt?.getTime() - startedAt?.getTime()) / 1000,
      );

      let unit = minutes;
      if (hours > 2) {
        unit = hours;
      }
      if (minutes < 1) {
        unit = seconds;
      }

      return (
        <div className="flex items-center">
          <NumericFormat
            displayType="text"
            value={unit}
            decimalScale={hours > 2 ? 2 : 0}
            decimalSeparator=","
            thousandSeparator="."
          />{" "}
          {hours > 2 ? "h" : minutes < 1 ? "s" : "m"}{" "}
          {!row.original.date_done && (
            <span className="ml-2">
              <Loading />
            </span>
          )}
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];
