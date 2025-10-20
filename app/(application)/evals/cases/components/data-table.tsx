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
import { Plus } from "lucide-react";
import { useState } from "react";
import * as React from "react";
import {
  GET_TEST_CASES,
  DELETE_TEST_CASE,
} from "@/queries/queries";
import { DataTableViewOptions } from "./data-table-view-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { FilterOperator } from "@/components/custom/recent-jobs";
import { TestCaseModal } from "./test-case-modal";
import { TestCase } from "@/types/models/test-case";

export type TestCaseFilters = {
  name?: FilterOperator;
  createdAt?: FilterOperator;
  updatedAt?: FilterOperator;
};

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  testCase?: TestCase;
}

export function DataTable<TData, TValue>({
  columns,
  testCase,
}: DataTableProps<TData, TValue>) {
  const { toast } = useToast();
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );

  const [filters, setFilters] = useState<TestCaseFilters[]>([]);
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(testCase || null);

  React.useEffect(() => {
    if (testCase) {
      setEditingTestCase(testCase);
      setShowModal(true);
    } else {
      setShowModal(false);
      setEditingTestCase(null);
    }
  }, [testCase]);

  const { loading, error, data, refetch } = useQuery(GET_TEST_CASES, {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: {
      page: page,
      limit: 10,
      filters: filters,
    },
    pollInterval: 30000,
  });

  const [deleteTestCase] = useMutation(DELETE_TEST_CASE, {
    onCompleted: () => {
      toast({
        title: "Test case deleted",
        description: "The test case has been successfully deleted.",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Failed to delete test case",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const pageInfo = data?.test_casesPagination?.pageInfo;
  const testCases = data?.test_casesPagination?.items || [];

  const table = useReactTable({
    data: testCases as TData[],
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
  });

  React.useEffect(() => {
    const nameFilter = table.getColumn("name")?.getFilterValue() as string;
    if (nameFilter) {
      setFilters([{ name: { contains: nameFilter } }]);
    } else {
      setFilters([]);
    }
  }, [table.getColumn("name")?.getFilterValue()]);

  const handleEdit = (testCase: TestCase) => {
    if (testCase) {
      setEditingTestCase(testCase);
      setShowModal(true);
    } else {
      setShowModal(false);
      setEditingTestCase(null);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTestCase(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder="Filter by name..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("name")?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>
        <div className="flex items-center space-x-2">
          <DataTableViewOptions table={table} />
          <Button
            variant="default"
            size="sm"
            className="ml-auto h-8"
            onClick={() => setShowModal(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Test Case
          </Button>
        </div>
      </div>

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
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                  onClick={() => {
                    const testCase = row.original as TestCase;
                    handleEdit(testCase);
                  }}
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
                  No test cases found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="flex-1 text-sm text-muted-foreground">
          {pageInfo && (
            <>
              Page {pageInfo.currentPage} of {pageInfo.pageCount} ({pageInfo.itemCount} total)
            </>
          )}
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => setPage(1)}
              disabled={!pageInfo?.hasPreviousPage}
            >
              <span className="sr-only">Go to first page</span>
              <DoubleArrowLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setPage(page - 1)}
              disabled={!pageInfo?.hasPreviousPage}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setPage(page + 1)}
              disabled={!pageInfo?.hasNextPage}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => setPage(pageInfo?.pageCount || 1)}
              disabled={!pageInfo?.hasNextPage}
            >
              <span className="sr-only">Go to last page</span>
              <DoubleArrowRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <TestCaseModal
        open={showModal}
        onClose={handleCloseModal}
        onSuccess={() => {
          refetch();
          handleCloseModal();
        }}
        testCase={editingTestCase}
      />
    </div>
  );
}
