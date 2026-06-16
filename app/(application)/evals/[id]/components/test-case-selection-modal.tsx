"use client";

/**
 * TestCaseSelectionModal — pick from unassigned test cases to add to an
 * eval set. The "case ∈ one set" constraint used to be communicated as a
 * destructive Alert which over-indexed the cost; per spec it is now a muted
 * one-liner — the constraint is informational, not an error.
 */

import { useQuery } from "@apollo/client";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { GET_TEST_CASES } from "@/queries/queries";

interface TestCase {
  id: string;
  name: string;
  description?: string | null;
}

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
  const t = useTranslations("evals.detail.selectExisting");
  const tCommon = useTranslations("evals.common");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { loading, data } = useQuery(GET_TEST_CASES, {
    variables: {
      page: 1,
      limit: 100,
      filters: search
        ? [
            {
              AND: [
                { name: { contains: search } },
                { eval_set_id: { eq: null } },
              ],
            },
          ]
        : [{ eval_set_id: { eq: null } }],
    },
    skip: !open,
  });

  useEffect(() => {
    if (!open) {
      setSelectedIds([]);
      setSearch("");
    }
  }, [open]);

  const testCases: TestCase[] = data?.test_casesPagination?.items ?? [];
  const availableTestCases = testCases.filter(
    (tc) => !excludeIds.includes(tc.id),
  );

  const handleToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === availableTestCases.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(availableTestCases.map((tc) => tc.id));
    }
  };

  const handleSubmit = () => {
    onSelect(selectedIds);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[80dvh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          {/* Muted info text replaces the prior destructive Alert — the
              "one set per case" rule is a constraint, not an error. */}
          <DialogDescription className="text-sm text-muted-foreground">
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col space-y-4 overflow-hidden">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {availableTestCases.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <Checkbox
                id="select-all-test-cases"
                checked={
                  selectedIds.length === availableTestCases.length &&
                  availableTestCases.length > 0
                }
                onCheckedChange={handleSelectAll}
              />
              <Label
                htmlFor="select-all-test-cases"
                className="text-sm text-muted-foreground"
              >
                {t("selectAll")} ·{" "}
                {t("selectedCount", { count: selectedIds.length })}
              </Label>
            </div>
          )}

          <ScrollArea className="flex-1 rounded-md border">
            <div>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))
              ) : availableTestCases.length === 0 ? (
                <div className="mx-5 py-12 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </div>
              ) : (
                availableTestCases.map((testCase) => (
                  <div
                    key={testCase.id}
                    onClick={() => handleToggle(testCase.id)}
                    className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedIds.includes(testCase.id)}
                      id={`select-test-case-${testCase.id}`}
                      onCheckedChange={() => handleToggle(testCase.id)}
                    />
                    <Label
                      htmlFor={`select-test-case-${testCase.id}`}
                      className="flex flex-col text-sm"
                    >
                      <span className="font-medium">{testCase.name}</span>
                      {testCase.description ? (
                        <small className="text-muted-foreground">
                          {testCase.description}
                        </small>
                      ) : null}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={selectedIds.length === 0}>
            {t("submit", { count: selectedIds.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
