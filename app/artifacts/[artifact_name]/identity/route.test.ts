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
});
