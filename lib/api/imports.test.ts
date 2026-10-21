import { Kind, type OperationDefinitionNode } from "graphql";
import { describe, expect, it } from "vitest";

import {
  CANCEL_IMPORT,
  GET_IMPORT_JOBS,
  START_IMPORT,
  importErrorCode,
  importErrorMessage,
  importJobByIdFilters,
  importJobFilters,
} from "@/lib/api/imports";

/** The document's single top-level selection field names (operation root). */
function rootFieldNames(doc: { definitions: readonly unknown[] }): string[] {
  const operation = doc.definitions.find(
    (d): d is OperationDefinitionNode =>
      (d as { kind?: string }).kind === Kind.OPERATION_DEFINITION,
  );
  if (!operation) throw new Error("no operation definition found");
  return operation.selectionSet.selections.map((s) => {
    if (s.kind !== Kind.FIELD)
      throw new Error(`unexpected selection ${s.kind}`);
    return s.name.value;
  });
}

describe("START_IMPORT", () => {
  it("builds a mutation on the plural items field, matching _itemsCreateOne", () => {
    const doc = START_IMPORT("faq");
    expect(rootFieldNames(doc)).toEqual(["faq_itemsStartImport"]);
  });
});

describe("CANCEL_IMPORT", () => {
  it("builds a mutation on the plural items field, matching _itemsExecuteSource", () => {
    const doc = CANCEL_IMPORT("faq");
    expect(rootFieldNames(doc)).toEqual(["faq_itemsCancelImport"]);
  });
});

describe("GET_IMPORT_JOBS", () => {
  it("queries job_resultsPagination", () => {
    expect(rootFieldNames(GET_IMPORT_JOBS)).toEqual(["job_resultsPagination"]);
  });

  it("selects exactly the verified job_result fields", () => {
    const operation = GET_IMPORT_JOBS.definitions.find(
      (d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION,
    )!;
    const paginationField = operation.selectionSet.selections[0];
    if (paginationField.kind !== Kind.FIELD) throw new Error("expected field");
    const itemsField = paginationField.selectionSet?.selections.find(
      (s) => s.kind === Kind.FIELD && s.name.value === "items",
    );
    if (
      !itemsField ||
      itemsField.kind !== Kind.FIELD ||
      !itemsField.selectionSet
    ) {
      throw new Error("expected items selection");
    }
    const fieldNames = itemsField.selectionSet.selections.map((s) => {
      if (s.kind !== Kind.FIELD) throw new Error("unexpected selection");
      return s.name.value;
    });
    expect(fieldNames).toEqual([
      "id",
      "label",
      "state",
      "type",
      "context",
      "trigger",
      "trigger_metadata",
      "metadata",
      "result",
      "error",
      "createdAt",
      "updatedAt",
    ]);
  });

  it("uses an unquoted enum literal for the sort direction, not a string", () => {
    const operation = GET_IMPORT_JOBS.definitions.find(
      (d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION,
    )!;
    const paginationField = operation.selectionSet.selections[0];
    if (paginationField.kind !== Kind.FIELD) throw new Error("expected field");
    const sortArg = paginationField.arguments?.find(
      (a) => a.name.value === "sort",
    );
    if (!sortArg) throw new Error("expected a sort argument");
    if (sortArg.value.kind !== Kind.OBJECT)
      throw new Error("expected an object value");
    const directionField = sortArg.value.fields.find(
      (f) => f.name.value === "direction",
    );
    if (!directionField) throw new Error("expected a direction field");
    // Regression guard: SortBy.direction is SortDirection! (an enum). A
    // quoted "DESC" would parse as a StringValue and fail GraphQL
    // validation against the enum type — it must be an EnumValue node.
    expect(directionField.value.kind).toBe(Kind.ENUM);
    expect(directionField.value.kind).not.toBe(Kind.STRING);
    if (directionField.value.kind === Kind.ENUM) {
      expect(directionField.value.value).toBe("DESC");
    }

    const fieldField = sortArg.value.fields.find(
      (f) => f.name.value === "field",
    );
    if (!fieldField) throw new Error("expected a field field");
    // The sort key name IS a string (SortBy.field: String!) — only the
    // enum member must stay unquoted.
    expect(fieldField.value.kind).toBe(Kind.STRING);
    if (fieldField.value.kind === Kind.STRING) {
      expect(fieldField.value.value).toBe("createdAt");
    }
  });
});

describe("importJobFilters", () => {
  it("filters job_result rows to this context's import jobs", () => {
    expect(importJobFilters("ctx-1")).toEqual([
      { context: { eq: "ctx-1" } },
      { type: { eq: "import" } },
    ]);
  });
});

describe("importJobByIdFilters", () => {
  it("filters job_result rows down to a single id", () => {
    expect(importJobByIdFilters("job-1")).toEqual([{ id: { eq: "job-1" } }]);
  });
});

describe("importErrorCode", () => {
  it("extracts the code from a plain Error whose message is the code", () => {
    expect(importErrorCode(new Error("IMPORT_NOT_FOUND"))).toBe(
      "IMPORT_NOT_FOUND",
    );
  });

  it("extracts the code from an Apollo-shaped error via graphQLErrors[0].message", () => {
    expect(
      importErrorCode({
        graphQLErrors: [{ message: "NOT_AUTHORIZED" }],
        message: "GraphQL error: NOT_AUTHORIZED",
      }),
    ).toBe("NOT_AUTHORIZED");
  });

  it("recognises INVALID_DELIMITER", () => {
    expect(importErrorCode(new Error("INVALID_DELIMITER"))).toBe(
      "INVALID_DELIMITER",
    );
  });

  it("returns null for an unrecognised message", () => {
    expect(importErrorCode(new Error("Network request failed"))).toBeNull();
  });

  it("returns null for a value with no usable message", () => {
    expect(importErrorCode(null)).toBeNull();
    expect(importErrorCode(undefined)).toBeNull();
    expect(importErrorCode({})).toBeNull();
  });
});

describe("importErrorMessage", () => {
  it("returns an Error's message", () => {
    expect(importErrorMessage(new Error("socket hang up"))).toBe(
      "socket hang up",
    );
  });

  it("returns a plain string as-is", () => {
    expect(importErrorMessage("NOT_AUTHORIZED")).toBe("NOT_AUTHORIZED");
  });

  it("stringifies anything else", () => {
    expect(importErrorMessage({ foo: "bar" })).toBe("[object Object]");
    expect(importErrorMessage(42)).toBe("42");
  });
});
