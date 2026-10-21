// @vitest-environment jsdom
import { ApolloLink } from "@apollo/client";
import {
  MockedProvider,
  MockLink,
  type MockedResponse,
} from "@apollo/client/testing";
import { act, cleanup, renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `useContextFolders` against a mocked transport: the schema gate (no request
 * at all while the backend has no `context_folders` table) and the create
 * input the backend requires. The pure sequencing helper behind `moveContext`
 * is unit-tested in ./folders-hook.test.ts; the rendering is covered by the
 * component tests.
 *
 * The flag is a module constant, so it is mocked through a getter — the
 * shipped default is `false` and both states need exercising.
 */
const flag = vi.hoisted(() => ({ supported: false }));

vi.mock("./queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./queries")>();
  return {
    ...actual,
    get KNOWLEDGE_CONTEXT_FOLDERS_SUPPORTED() {
      return flag.supported;
    },
  };
});

// Imported after the mock (vi.mock is hoisted) so the hook picks it up.
import { useContextFolders } from "./hooks";
import { CREATE_CONTEXT_FOLDER, GET_CONTEXT_FOLDERS } from "./queries";

/**
 * Every operation that reached the link, with its variables. A spy on a
 * mock's result proves nothing: MockLink swallows an unmatched request as a
 * network error, so it would stay silent even when the query was issued.
 */
const asked: Array<{
  name: string | undefined;
  variables: Record<string, unknown>;
}> = [];

afterEach(() => {
  cleanup();
  asked.length = 0;
  flag.supported = false;
});

function wrapperWith(mocks: MockedResponse[]) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    const recorder = new ApolloLink((operation, forward) => {
      asked.push({
        name: operation.operationName,
        variables: operation.variables,
      });
      return forward(operation);
    });
    return (
      <MockedProvider link={ApolloLink.from([recorder, new MockLink(mocks)])}>
        {children}
      </MockedProvider>
    );
  };
}

const EMPTY_PAGE: MockedResponse = {
  request: { query: GET_CONTEXT_FOLDERS },
  result: { data: { context_foldersPagination: { items: [] } } },
};

describe("useContextFolders", () => {
  it("fires no request and reports itself unsupported while the backend has no folders table", async () => {
    flag.supported = false;

    const { result } = renderHook(() => useContextFolders(), {
      wrapper: wrapperWith([EMPTY_PAGE]),
    });
    // Let any effect-scheduled fetch run before concluding none happened.
    await act(async () => {});

    expect(result.current.supported).toBe(false);
    expect(result.current.folders).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(asked).toEqual([]);
  });

  it("creates a folder with an empty membership array (context_ids is required)", async () => {
    flag.supported = true;

    const input = {
      name: "Tenders",
      description: "Everything we bid on",
      icon: "books",
      sort_order: 2,
    };
    const created = {
      id: "f1",
      ...input,
      context_ids: [],
    };

    const { result } = renderHook(() => useContextFolders(), {
      wrapper: wrapperWith([
        EMPTY_PAGE,
        {
          request: {
            query: CREATE_CONTEXT_FOLDER,
            variables: { input: { ...input, context_ids: [] } },
          },
          result: { data: { context_foldersCreateOne: { item: created } } },
        },
        // The hook refetches once the write lands.
        {
          request: { query: GET_CONTEXT_FOLDERS },
          result: {
            data: { context_foldersPagination: { items: [created] } },
          },
        },
      ]),
    });

    expect(result.current.supported).toBe(true);

    await act(async () => {
      await result.current.createFolder(input);
    });

    const create = asked.find((op) => op.name === "CreateContextFolder");
    expect(create?.variables.input).toEqual({ ...input, context_ids: [] });
    expect(asked.filter((op) => op.name === "GetContextFolders")).toHaveLength(
      2,
    );
  });
});
