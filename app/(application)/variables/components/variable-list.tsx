"use client";

/**
 * VariableList — the body of /variables (toolbar + list + detail panel),
 * extracted so the role-gated read-only variant can compose it without
 * duplicating page chrome.
 *
 * The PageShell + PageHeader live in the route's page.tsx; this component
 * owns the columns wiring, the DataTable, and the detail composition.
 */

import * as React from "react";

import { createColumns } from "./columns";
import { VariablesDataTable } from "./data-table";

export interface VariableListProps {
  readOnly?: boolean;
}

export function VariableList({ readOnly = false }: VariableListProps) {
  // Backend BE-1 not shipped yet — keep the columns rendering "Usage
  // unavailable" until then. Flip when the resolver lands.
  const usageAvailable = false;

  const columns = React.useMemo(
    () => createColumns({ readOnly, usageAvailable }),
    [readOnly, usageAvailable],
  );

  return <VariablesDataTable columns={columns} readOnly={readOnly} />;
}
