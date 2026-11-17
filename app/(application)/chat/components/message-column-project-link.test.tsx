// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/lottie", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/chat/a1/s1",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useMutation: vi.fn(() => [vi.fn(), { loading: false }]),
    useQuery: vi.fn(() => ({ data: undefined, loading: false, refetch: vi.fn() })),
  };
});

import de from "@/messages/de.json";
import { UserContext } from "@/app/(application)/authenticated";
import { MessageColumn } from "./message-column";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

afterEach(cleanup);

const ID = "123e4567-e89b-12d3-a456-426614174000";
const AGENT = { id: "a1", name: "Agent" } as never;

const messages = [
  { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] },
  {
    id: "m1", role: "assistant", metadata: {},
    parts: [{ type: "tool-bash", toolCallId: "t0", state: "output-available", input: { command: "ls" }, output: { result: "datei.txt" } }],
  },
  { id: "u2", role: "user", parts: [{ type: "text", text: "mach ein Projekt" }] },
  {
    id: "m2", role: "assistant", metadata: {},
    parts: [{ type: "tool-create_project", toolCallId: "t1", state: "output-available", input: { name: "A", files: [] }, output: { result: `Projekt angelegt: /projects/${ID}` } }],
  },
] as never[];

// Stable callbacks, as the real controller's are: a new function identity
// would rebuild the tool-card factories for a reason unrelated to the project.
const STABLE = {
  addToolApprovalResponse: vi.fn(),
  approveToolForChat: vi.fn(),
  regenerate: vi.fn(),
  setMessages: vi.fn(),
  addFileItem: vi.fn(),
  sendQuestionAnswer: vi.fn(),
  resumeAfterCredential: vi.fn(),
  claimChecks: {},
};
const controller = (project: string) =>
  ({
    ...STABLE,
    agent: AGENT,
    messages,
    status: "ready",
    catchingUp: false,
    session: { id: "s1", project },
    writeAccess: true,
  }) as never;

const USER = { user: { id: 1, super_admin: true } };
const tree = (project: string) => (
  <NextIntlClientProvider locale="de" messages={de}>
    <UserContext.Provider value={USER as never}>
      <MessageColumn controller={controller(project)} />
    </UserContext.Provider>
  </NextIntlClientProvider>
);

describe("MessageColumn: project link", () => {
  it("shows the link once the session has the created project, without remounting older tool cards", () => {
    const { rerender } = render(tree(""));
    const header = screen.getAllByText("Bash")[0]!;
    fireEvent.click(header);
    const card = header.closest("[data-state]") as HTMLElement;
    expect(card.getAttribute("data-state")).toBe("open");
    expect(screen.queryByRole("link", { name: "Projekt öffnen" })).toBeNull();

    rerender(tree(ID));

    expect(screen.getByRole("link", { name: "Projekt öffnen" }).getAttribute("href")).toBe(`/projects/${ID}`);
    expect(screen.getAllByText("Bash")[0]).toBe(header); // same DOM node: not remounted
    expect(header.closest("[data-state]")!.getAttribute("data-state")).toBe("open");
  });
});
