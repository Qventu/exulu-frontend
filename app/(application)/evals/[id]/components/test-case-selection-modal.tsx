"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@apollo/client";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GET_TEST_CASES } from "@/queries/queries";
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface TestCaseSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (testCaseIds: string[]) => void;
  excludeIds?: string[];
}

export function TestCaseSelectionModal({
  open,
  onClose,
  onSelect,
  excludeIds = [],
}: TestCaseSelectionModalProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { loading, data } = useQuery(GET_TEST_CASES, {
    variables: {
      page: 1,
      limit: 100,
      filters: search ? [{ AND: [{ name: { contains: search } }, { eval_set_id: { eq: null } }] }] : [{ eval_set_id: { eq: null } }],
    },
    skip: !open,
  });

  useEffect(() => {
    if (!open) {
      setSelectedIds([]);
      setSearch("");
    }
  }, [open]);

  const testCases = data?.test_casesPagination?.items || [];
  const availableTestCases = testCases.filter((tc: any) => !excludeIds.includes(tc.id));

  const handleToggle = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === availableTestCases.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(availableTestCases.map((tc: any) => tc.id));
    }
  };

  const handleSubmit = () => {
    onSelect(selectedIds);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Test Cases</DialogTitle>
          <DialogDescription>
            Select test cases to add to this eval set. Already added test cases are hidden.
          </DialogDescription>
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>
              <strong>Note:</strong> You can only add test cases that are not already in an eval set. Remove them from another eval set first if you want to add them to a new eval set.
            </AlertDescription>
          </Alert>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search test cases by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Select All */}
          {availableTestCases.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <Checkbox
                id="select-all-test-cases"
                checked={selectedIds.length === availableTestCases.length && availableTestCases.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all-test-cases" className="text-sm text-muted-foreground">
                Select all ({selectedIds.length} selected)
              </Label>
            </div>
          )}

          {/* Test Cases List */}
          <ScrollArea className="flex-1 border rounded-lg">
            <div>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))
              ) : availableTestCases.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground mx-5">
                  {search ? "No test cases found matching your search." : "No test cases available to add."}
                </div>
              ) : (
                availableTestCases.map((testCase: any) => (
                  <div
                    key={testCase.id}
                    onClick={() => {
                      handleToggle(testCase.id)
                    }}
                    className="flex items-start gap-3 p-3 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedIds.includes(testCase.id)}
                      id={`select-test-case-${testCase.id}`}
                      onCheckedChange={() => handleToggle(testCase.id)}
                    />
                    <Label htmlFor={`select-test-case-${testCase.id}`} className="text-sm text-muted-foreground flex flex-col">
                      <span>{testCase.name}</span>
                      <small>{testCase.description}</small>
                    </Label>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedIds.length === 0}
          >
            Add {selectedIds.length} Test Case{selectedIds.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
