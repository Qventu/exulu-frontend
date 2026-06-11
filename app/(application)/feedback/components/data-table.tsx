"use client";

import { useMutation, useQuery } from "@apollo/client";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from "@radix-ui/react-icons";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { Trash2, ThumbsUp, ThumbsDown } from "lucide-react";
import { useState } from "react";
import * as React from "react";
import {
  GET_FEEDBACK,
  DELETE_FEEDBACK,
  GET_AGENTS,
  GET_USERS,
} from "@/queries/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/primitives/loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { FilterOperator } from "@/types/models/filter";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FeedbackDetailSheet } from "./feedback-detail-sheet";
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

export type FeedbackFilters = {
  agent?: FilterOperator;
  user?: FilterOperator;
  score?: FilterOperator;
  description?: FilterOperator;
};

type Feedback = {
  id: string;
  description: string;
  session: string;
  score: number;
  user: number;
  agent: string;
  createdAt: string;
};

export function DataTable() {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [filters, setFilters] = useState<FeedbackFilters[]>([]);
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch feedback
  const { loading, data, refetch, previousData } = useQuery(GET_FEEDBACK, {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: {
      page: page,
      limit: 20,
      sort: {
        field: "createdAt",
        direction: "DESC",
      },
      filters: filters,
    },
    pollInterval: 30000,
  });

  // Fetch agents for filter
  const { data: agentsData } = useQuery(GET_AGENTS, {
    variables: {
      page: 1,
      limit: 1000,
    },
  });

  // Fetch users for filter
  const { data: usersData } = useQuery(GET_USERS, {
    variables: {
      page: 1,
      limit: 1000,
    },
  });

  const [deleteFeedback, deleteFeedbackResult] = useMutation(DELETE_FEEDBACK, {
    refetchQueries: [GET_FEEDBACK, "GetFeedback"],
  });

  const defaultData = React.useMemo(() => [], []);

  let items: Feedback[] = [];
  let pageCount: number = 1;
  if (loading && previousData?.feedbackPagination?.items) {
    items = previousData?.feedbackPagination?.items;
    pageCount = previousData?.feedbackPagination?.pageInfo?.pageCount;
  } else if (data?.feedbackPagination?.items) {
    items = data?.feedbackPagination?.items;
    pageCount = data?.feedbackPagination?.pageInfo?.pageCount;
  } else if (previousData?.feedbackPagination?.items) {
    items = previousData?.feedbackPagination?.items;
    pageCount = previousData?.feedbackPagination?.pageInfo?.pageCount;
  }

  // Define columns
  const columns: ColumnDef<Feedback>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
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
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt"));
        return (
          <div className="text-sm">
            {date.toLocaleDateString()} {date.toLocaleTimeString()}
          </div>
        );
      },
    },
    {
      accessorKey: "score",
      header: "Type",
      cell: ({ row }) => {
        const score = row.getValue("score") as number;
        return score === 1 ? (
          <Badge variant="default" className="flex items-center gap-1 w-fit">
            <ThumbsUp className="h-3 w-3" />
            Positive
          </Badge>
        ) : (
          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
            <ThumbsDown className="h-3 w-3" />
            Negative
          </Badge>
        );
      },
    },
    {
      accessorKey: "agent",
      header: "Agent",
      cell: ({ row }) => {
        const agentId = row.getValue("agent") as string;
        const agent = agentsData?.agentsPagination?.items?.find(
          (a: any) => a.id === agentId,
        );
        return (
          <div className="text-sm">
            {agent?.name || `Agent ${agentId}`}
          </div>
        );
      },
    },
    {
      accessorKey: "description",
      header: "Feedback",
      cell: ({ row }) => {
        const description = row.getValue("description") as string;
        const preview =
          description?.length > 120
            ? description.substring(0, 120) + "..."
            : description;
        return <div className="max-w-[500px] text-sm">{preview}</div>;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedFeedback(row.original)}
            >
              View Details
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: items ?? defaultData,
    pageCount: pageCount ?? -1,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true,
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const hasSelection = selectedRows.length > 0;

  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        selectedRows.map((row) =>
          deleteFeedback({
            variables: {
              id: row.original.id,
            },
          }),
        ),
      );

      toast.success("Success", { description: `Deleted ${selectedRows.length} feedback item(s)` });

      setRowSelection({});
      setDeleteDialogOpen(false);
      refetch();
    } catch (error) {
      toast.error("Error", { description: "Failed to delete feedback" });
    }
  };

  const search = (value: string) => {
    const copy = [...filters];
    const exists = copy.find((filter) => filter.description);
    if (exists?.description) {
      exists.description.contains = value;
    } else {
      copy.push({
        description: {
          contains: value,
        },
      });
    }
    setFilters(copy);
    setPage(1);
  };

  const filterByScore = (value: string) => {
    const copy = filters.filter((f) => !f.score);
    if (value === "all") {
      setFilters(copy);
    } else {
      copy.push({
        score: {
          eq: value === "positive" ? 1 : 0,
        },
      });
      setFilters(copy);
    }
    setPage(1);
  };

  const filterByUser = (value: string) => {
    const copy = filters.filter((f) => !f.user);
    if (value === "all") {
      setFilters(copy);
    } else {
      copy.push({
        user: {
          eq: parseFloat(value) as any,
        },
      });
      setFilters(copy);
    }
    setPage(1);
  };

  const filterByAgent = (value: string) => {
    const copy = filters.filter((f) => !f.agent);
    if (value === "all") {
      setFilters(copy);
    } else {
      copy.push({
        agent: {
          eq: value,
        },
      });
      setFilters(copy);
    }
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder="Search feedback..."
            value={
              filters?.find((filter) => filter.description)?.description
                ?.contains ?? ""
            }
            onChange={(event) => {
              search(event.target.value);
            }}
            className="w-[250px]"
          />

          <Select
            value={
              (filters.find((f) => f.score)?.score?.eq as unknown as number) === 1
                ? "positive"
                : (filters.find((f) => f.score)?.score?.eq as unknown as number) === 0
                  ? "negative"
                  : "all"
            }
            onValueChange={filterByScore}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="positive">Positive</SelectItem>
              <SelectItem value="negative">Negative</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={
              filters.find((f) => f.user)?.user?.eq?.toString() ?? "all"
            }
            onValueChange={filterByUser}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by user" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {usersData?.usersPagination?.items?.map((user: any) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name || user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={
              filters.find((f) => f.agent)?.agent?.eq?.toString() ?? "all"
            }
            onValueChange={filterByAgent}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agentsData?.agentsPagination?.items?.map((agent: any) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(filters.length > 0 || filters.some((f) => f.description)) && (
            <Button
              variant="ghost"
              onClick={() => {
                setFilters([]);
                setPage(1);
              }}
              className="h-8 px-2 lg:px-3"
            >
              Reset
            </Button>
          )}
        </div>

        {hasSelection && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={deleteFeedbackResult.loading}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete {selectedRows.length} item(s)
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading && !previousData ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <Loading />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No feedback found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="flex-1 text-sm text-muted-foreground">
          {hasSelection && (
            <span>
              {selectedRows.length} of {table.getFilteredRowModel().rows.length}{" "}
              row(s) selected.
            </span>
          )}
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">
              Page {page} of {pageCount || 1}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden size-8 p-0 lg:flex"
              onClick={() => setPage(1)}
              disabled={page === 1}
            >
              <span className="sr-only">Go to first page</span>
              <DoubleArrowLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8 p-0"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8 p-0"
              onClick={() => setPage(page + 1)}
              disabled={page >= pageCount}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRightIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 p-0 lg:flex"
              onClick={() => setPage(pageCount)}
              disabled={page >= pageCount}
            >
              <span className="sr-only">Go to last page</span>
              <DoubleArrowRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Detail Sheet */}
      <FeedbackDetailSheet
        feedback={selectedFeedback}
        open={!!selectedFeedback}
        onOpenChange={(open) => {
          if (!open) setSelectedFeedback(null);
        }}
        onDelete={(id) => {
          deleteFeedback({
            variables: { id },
          }).then(() => {
            toast.success("Success", { description: "Feedback deleted successfully" });
            setSelectedFeedback(null);
            refetch();
          });
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedRows.length} feedback item(s).
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
