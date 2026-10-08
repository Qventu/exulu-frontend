import { beforeEach, describe, expect, test, vi } from "vitest";

const getServerSession = vi.fn();
vi.mock("next-auth", () => ({ getServerSession: () => getServerSession() }));
vi.mock("@/app/api/auth/[...nextauth]/options", () => ({
  getAuthOptions: async () => ({}),
}));

import { GET } from "./route";

const params = Promise.resolve({ artifact_name: "my-artifact" });
const req = {} as any;

/** meta + access responses, in the order the handler fetches them. */
function stubFetch(
  meta: { status: number; body?: unknown },
  access?: { status: number },
) {
  const fetchMock = vi.fn(async (url: string, _init?: unknown) => {
    if (String(url).endsWith("/meta")) {
      return {
        ok: meta.status >= 200 && meta.status < 300,
        status: meta.status,
        json: async () => meta.body,
      } as any;
    }
    return {
      ok: (access?.status ?? 204) < 300,
      status: access?.status ?? 204,
    } as any;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const grantingMeta = {
  status: 200,
  body: { auth_mode: "regular", grant_viewer_identity: true },
};

describe("/artifacts/[name]/identity", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("BACKEND", "http://backend.test");
    getServerSession.mockReset();
    getServerSession.mockResolvedValue({
      user: { jwt: "jwt-abc", email: "a@b.test", name: "A B" },
    });
  });

  test("grants the token, the backend origin and the user", async () => {
    const fetchMock = stubFetch(grantingMeta);
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      token: "jwt-abc",
      backendOrigin: "http://backend.test",
      user: { email: "a@b.test", name: "A B" },
    });
    // The access check must actually carry the viewer's credential, not just
    // be invoked.
    const accessCall = fetchMock.mock.calls.find(([u]) =>
      String(u).endsWith("/access"),
    );
    expect((accessCall?.[1] as any)?.headers).toEqual({
      Authorization: "Bearer jwt-abc",
    });
  });

  test("never caches the credential", async () => {
    stubFetch(grantingMeta);
    const res = await GET(req, { params });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  test("404s when the artifact lacks the capability", async () => {
    stubFetch({
      status: 200,
      body: { auth_mode: "regular", grant_viewer_identity: false },
    });
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
  });

  // Review Focus 2: the worst failure in the design — a public share must
  // never hand a credential to an anonymous visitor.
  test.each(["public", "password"])(
    "404s a %s share even when the flag is true",
    async (auth_mode) => {
      stubFetch({
        status: 200,
        body: { auth_mode, grant_viewer_identity: true },
      });
      const res = await GET(req, { params });
      expect(res.status).toBe(404);
    },
  );

  // Review Focus 1: meta answers 410 for an expired share.
  test("404s an expired artifact", async () => {
    stubFetch({ status: 410 });
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
  });

  test("401s without a session token", async () => {
    stubFetch(grantingMeta);
    getServerSession.mockResolvedValue({ user: { email: "a@b.test" } });
    const res = await GET(req, { params });
    expect(res.status).toBe(401);
  });

  test("forwards a 403 from the access check", async () => {
    stubFetch(grantingMeta, { status: 403 });
    const res = await GET(req, { params });
    expect(res.status).toBe(403);
  });

  // The access check's contract is exactly 204/401/403. Anything else (here,
  // an upstream 500) must never be forwarded or mistaken for "granted" — it
  // becomes a 502, and above all must never leak a token in the body.
  test("502s when the access check answers outside its contract", async () => {
    stubFetch(grantingMeta, { status: 500 });
    const res = await GET(req, { params });
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).not.toContain("jwt-abc");
  });

  test("500s when BACKEND is unset", async () => {
    vi.stubEnv("BACKEND", undefined);
    stubFetch(grantingMeta);
    const res = await GET(req, { params });
    expect(res.status).toBe(500);
  });

  test("does not call the access check before the capability gate", async () => {
    const fetchMock = stubFetch({
      status: 200,
      body: { auth_mode: "regular", grant_viewer_identity: false },
    });
    await GET(req, { params });
    expect(
      fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/access")),
    ).toHaveLength(0);
  });

  // F1: port-first names this failure state explicitly — "the channel
  // arrived but no grant followed". A throw (network failure, or the abort
  // from the 10s timeout — the catch block does not distinguish) must 502,
  // not escape as an unhandled exception into Next's generic 500.
  test("502s when /meta throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).endsWith("/meta")) throw new Error("network down");
        return { ok: true, status: 204 } as any;
      }),
    );
    const res = await GET(req, { params });
    expect(res.status).toBe(502);
  });

  test("502s when /access throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).endsWith("/meta")) {
          return { ok: true, status: 200, json: async () => grantingMeta.body } as any;
        }
        throw new Error("network down");
      }),
    );
    const res = await GET(req, { params });
    expect(res.status).toBe(502);
  });

  test("passes a timeout signal on both backend fetches", async () => {
    const fetchMock = stubFetch(grantingMeta);
    await GET(req, { params });
    for (const call of fetchMock.mock.calls) {
      expect((call[1] as any)?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  // F3: a share deleted or expired between /meta and /access is the truth,
  // not a gateway error.
  test.each([404, 410])(
    "maps a %s from the access check to 404, not 502",
    async (status) => {
      stubFetch(grantingMeta, { status });
      const res = await GET(req, { params });
      expect(res.status).toBe(404);
    },
  );

  // F2: Cache-Control must be set on every response path, not just the 200,
  // so an intermediary cannot cache a refusal and keep a newly granted
  // artifact perpetually refused.
  test.each([
    ["404 (capability off)", () => stubFetch({ status: 200, body: { auth_mode: "regular", grant_viewer_identity: false } })],
    ["401 (no session token)", () => { stubFetch(grantingMeta); getServerSession.mockResolvedValue({ user: { email: "a@b.test" } }); }],
    ["403 (access denied)", () => stubFetch(grantingMeta, { status: 403 })],
    ["502 (outside contract)", () => stubFetch(grantingMeta, { status: 500 })],
    ["500 (misconfigured)", () => { vi.stubEnv("BACKEND", undefined); stubFetch(grantingMeta); }],
  ])("sets Cache-Control: private, no-store on the %s path", async (_label, setup) => {
    setup();
    const res = await GET(req, { params });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
