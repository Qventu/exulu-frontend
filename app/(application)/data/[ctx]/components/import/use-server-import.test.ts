// @vitest-environment jsdom
/**
 * `useServerImport` — the upload → start → cancel lifecycle of a server-side
 * import, driven through a fake Apollo client (`mutate` only; the hook never
 * queries) and a fake uploader. No component renders here: `renderHook` is
 * used purely because the hook reads `ConfigContext` for the availability
 * guard, which is the thing Review Focus 3 is about.
 *
 * jsdom (not node) because @testing-library/react needs a DOM to mount the
 * hook's host component; the wrapper is built with `React.createElement` so
 * this file can stay the `.ts` the plan names.
 */
import type { ApolloClient } from "@apollo/client";
import { MockedProvider } from "@apollo/client/testing";
import { renderHook, act } from "@testing-library/react";
import { print, type DocumentNode } from "graphql";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ConfigContext,
  type ConfigContextType,
} from "@/components/shell/config-context";
import type { BatchAccess } from "@/lib/import/types";
import enMessages from "@/messages/en.json";

const sonner = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: sonner }));

/**
 * NextIntlClientProvider types `children` as required, which
 * `React.createElement(Type, props, child)` cannot express — and passing it
 * as a prop instead trips react/no-children-prop. One cast settles both and
 * keeps this file the `.ts` the plan names (no JSX).
 */
const IntlProvider = NextIntlClientProvider as unknown as React.ComponentType<{
  locale: string;
  messages: typeof enMessages;
  children?: React.ReactNode;
}>;

import { useServerImport } from "./use-server-import";

const CONTEXT = "ctx_1";

const ACCESS: BatchAccess = {
  rights_mode: "roles",
  users: [],
  roles: [{ id: "role-1", rights: "read" }],
  teams: [],
};

const MAPPING = [
  { header: "name", fieldName: "name" },
  { header: "notes", fieldName: null },
];

/** A deployment with the queues entitlement and workers provisioned. */
const AVAILABLE = {
  entitlements: { queues: true },
  workers: { enabled: true, redisHost: "redis" },
} as unknown as ConfigContextType;

/** Same deployment without the licence — server imports can't run. */
const UNLICENSED = {
  entitlements: { queues: false },
  workers: { enabled: true, redisHost: "redis" },
} as unknown as ConfigContextType;

/**
 * The hook reads `ConfigContext` for the availability guard and calls
 * `useApolloClient()` for its default client — which throws outside an
 * Apollo provider, so the (unused) MockedProvider below stands in for the
 * real one. Every test injects its own fake client. The intl provider is
 * there for the one piece of copy the hook owns: the cancel-failure toast.
 */
function wrapperFor(config: ConfigContextType) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      IntlProvider,
      { locale: "en", messages: enMessages },
      React.createElement(
        ConfigContext.Provider,
        { value: config },
        React.createElement(MockedProvider, { mocks: [] }, children),
      ),
    );
  };
}

interface MutateArgs {
  mutation: DocumentNode;
  variables: Record<string, unknown>;
}

function fakeClient(startResult: unknown = { jobResultId: "job-1" }) {
  return {
    mutate: vi.fn(async ({ mutation }: MutateArgs) => {
      const doc = print(mutation);
      if (doc.includes("CancelImport")) {
        return { data: { [`${CONTEXT}_itemsCancelImport`]: { ok: true } } };
      }
      return { data: { [`${CONTEXT}_itemsStartImport`]: startResult } };
    }),
  };
}

function setup(
  config: ConfigContextType = AVAILABLE,
  client = fakeClient(),
  upload = vi.fn(async () => "bucket/imports/big.csv"),
) {
  const rendered = renderHook(
    () =>
      useServerImport(CONTEXT, {
        client: client as unknown as ApolloClient<object>,
        upload,
      }),
    { wrapper: wrapperFor(config) },
  );
  return { ...rendered, client, upload };
}

const FILE = () => new File(["name\nA\n"], "big.csv", { type: "text/csv" });

beforeEach(() => {
  sonner.error.mockClear();
});

describe("useServerImport", () => {
  it("uploads the file, then starts the import with the exact StartImportInput", async () => {
    const { result, client, upload } = setup();

    await act(async () => {
      await result.current.start({
        file: FILE(),
        mapping: MAPPING,
        access: ACCESS,
        totalRows: 1000,
        options: { delimiter: ";" },
      });
    });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(client.mutate).toHaveBeenCalledTimes(1);

    const call = client.mutate.mock.calls[0][0];
    // The mutation field name is the plural `_items` one (SDL authority).
    expect(print(call.mutation)).toContain(`${CONTEXT}_itemsStartImport`);
    expect(call.variables).toEqual({
      input: {
        s3Key: "bucket/imports/big.csv",
        fileName: "big.csv",
        mapping: [
          { header: "name", fieldName: "name" },
          { header: "notes", fieldName: null },
        ],
        access: {
          rights_mode: "roles",
          users: [],
          roles: [{ id: "role-1", rights: "read" }],
          teams: [],
        },
        options: { delimiter: ";" },
        totalRows: 1000,
      },
    });

    expect(result.current.phase).toBe("running");
    expect(result.current.jobResultId).toBe("job-1");
    expect(result.current.error).toBeNull();
  });

  it("refuses to start and uploads nothing when server imports are unavailable", async () => {
    // Review Focus 3: no licence, no upload, no mutation — just the refusal.
    const { result, client, upload } = setup(UNLICENSED);

    await act(async () => {
      await result.current.start({
        file: FILE(),
        mapping: MAPPING,
        access: ACCESS,
        totalRows: 1000,
      });
    });

    expect(upload).not.toHaveBeenCalled();
    expect(client.mutate).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("error");
    expect(result.current.errorCode).toBe("SERVER_IMPORT_UNAVAILABLE");
    expect(result.current.jobResultId).toBeNull();
  });

  it("startFromKey reuses a stored key (the retry path) without uploading", async () => {
    const { result, client, upload } = setup();

    await act(async () => {
      await result.current.startFromKey({
        s3Key: "bucket/imports/ctx-1/job-1-errors.csv",
        fileName: "big-errors.csv",
        mapping: [...MAPPING, { header: "import_error", fieldName: null }],
        access: ACCESS,
        options: { delimiter: "," },
      });
    });

    expect(upload).not.toHaveBeenCalled();
    const { input } = client.mutate.mock.calls[0][0].variables as {
      input: Record<string, unknown>;
    };
    expect(input.s3Key).toBe("bucket/imports/ctx-1/job-1-errors.csv");
    expect(input.fileName).toBe("big-errors.csv");
    expect(input.mapping).toEqual([
      { header: "name", fieldName: "name" },
      { header: "notes", fieldName: null },
      { header: "import_error", fieldName: null },
    ]);
    // No row count is known for a retry — the key must be absent, not 0.
    expect("totalRows" in input).toBe(false);
    expect(result.current.phase).toBe("running");
  });

  it("omits the mapping when none is known, so the worker auto-maps", async () => {
    // Reopened wizard: there is no map step behind the job, and an empty
    // mapping array would map every column to ignore (NO_MAPPABLE_COLUMNS).
    const { result, client } = setup();

    await act(async () => {
      await result.current.startFromKey({
        s3Key: "bucket/imports/ctx-1/job-1-errors.csv",
        fileName: "big-errors.csv",
        access: ACCESS,
      });
    });

    const { input } = client.mutate.mock.calls[0][0].variables as {
      input: Record<string, unknown>;
    };
    expect("mapping" in input).toBe(false);
  });

  it("cancel calls the cancel mutation for the running job", async () => {
    const { result, client } = setup();

    await act(async () => {
      await result.current.start({
        file: FILE(),
        mapping: MAPPING,
        access: ACCESS,
        totalRows: 1000,
      });
    });
    await act(async () => {
      await result.current.cancel();
    });

    expect(client.mutate).toHaveBeenCalledTimes(2);
    const call = client.mutate.mock.calls[1][0];
    expect(print(call.mutation)).toContain(`${CONTEXT}_itemsCancelImport`);
    expect(call.variables).toEqual({ jobResultId: "job-1" });
  });

  it("keeps the job running and toasts the reason when a cancel is refused", async () => {
    // A refused cancel is not a failed import: the job is still going, so
    // the phase must stay "running" (phase "error" would replace the live
    // progress with the start-failure panel).
    const client = {
      mutate: vi.fn(async ({ mutation }: MutateArgs) => {
        if (print(mutation).includes("CancelImport")) {
          throw { graphQLErrors: [{ message: "NOT_AUTHORIZED" }] };
        }
        return {
          data: { [`${CONTEXT}_itemsStartImport`]: { jobResultId: "job-1" } },
        };
      }),
    };
    const { result } = setup(AVAILABLE, client);

    await act(async () => {
      await result.current.start({
        file: FILE(),
        mapping: MAPPING,
        access: ACCESS,
        totalRows: 1000,
      });
    });
    await act(async () => {
      await result.current.cancel();
    });

    expect(result.current.phase).toBe("running");
    expect(result.current.jobResultId).toBe("job-1");
    expect(result.current.cancelling).toBe(false);
    expect(result.current.errorCode).toBeNull();
    expect(sonner.error).toHaveBeenCalledTimes(1);
    expect(sonner.error).toHaveBeenCalledWith(
      "Only the person who started the import, or an admin, can cancel it.",
    );
  });

  it("toasts the cancel-specific copy when the failure is not a known code", async () => {
    const client = {
      mutate: vi.fn(async ({ mutation }: MutateArgs) => {
        if (print(mutation).includes("CancelImport")) {
          throw new Error("socket hang up");
        }
        return {
          data: { [`${CONTEXT}_itemsStartImport`]: { jobResultId: "job-1" } },
        };
      }),
    };
    const { result } = setup(AVAILABLE, client);

    act(() => result.current.adopt("job-1"));
    await act(async () => {
      await result.current.cancel();
    });

    expect(result.current.phase).toBe("running");
    expect(sonner.error).toHaveBeenCalledWith(
      "The import couldn't be cancelled: socket hang up",
    );
  });

  it("does not cancel the job when the hook unmounts", async () => {
    // Review Focus 4: closing the wizard leaves the background job alone.
    const { result, client, unmount } = setup();

    await act(async () => {
      await result.current.start({
        file: FILE(),
        mapping: MAPPING,
        access: ACCESS,
        totalRows: 1000,
      });
    });
    expect(client.mutate).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(client.mutate).toHaveBeenCalledTimes(1);
    expect(
      client.mutate.mock.calls.some((c) =>
        print(c[0].mutation).includes("CancelImport"),
      ),
    ).toBe(false);
  });

  it("adopts a job that is already running (wizard reopened) and can cancel it", async () => {
    const { result, client } = setup();

    act(() => {
      result.current.adopt("job-9");
    });
    expect(result.current.phase).toBe("running");
    expect(result.current.jobResultId).toBe("job-9");

    await act(async () => {
      await result.current.cancel();
    });
    expect(client.mutate.mock.calls[0][0].variables).toEqual({
      jobResultId: "job-9",
    });
  });

  it("surfaces a backend error code from a rejected start", async () => {
    const client = {
      mutate: vi.fn(async (_args: MutateArgs) => {
        throw { graphQLErrors: [{ message: "IMPORT_ALREADY_RUNNING" }] };
      }),
    };
    const { result } = setup(AVAILABLE, client);

    await act(async () => {
      await result.current.start({
        file: FILE(),
        mapping: MAPPING,
        access: ACCESS,
        totalRows: 1000,
      });
    });

    expect(result.current.phase).toBe("error");
    expect(result.current.errorCode).toBe("IMPORT_ALREADY_RUNNING");
  });

  it("keeps the raw message when the error is not a known code", async () => {
    const client = {
      mutate: vi.fn(async (_args: MutateArgs) => {
        throw new Error("socket hang up");
      }),
    };
    const { result } = setup(AVAILABLE, client);

    await act(async () => {
      await result.current.start({
        file: FILE(),
        mapping: MAPPING,
        access: ACCESS,
        totalRows: 1000,
      });
    });

    expect(result.current.phase).toBe("error");
    expect(result.current.errorCode).toBeNull();
    expect(result.current.error).toBe("socket hang up");
  });

  it("reset clears the job and the error", async () => {
    const { result } = setup(UNLICENSED);

    await act(async () => {
      await result.current.start({
        file: FILE(),
        mapping: MAPPING,
        access: ACCESS,
        totalRows: 1,
      });
    });
    expect(result.current.phase).toBe("error");

    act(() => result.current.reset());
    expect(result.current.phase).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.errorCode).toBeNull();
    expect(result.current.jobResultId).toBeNull();
  });
});
