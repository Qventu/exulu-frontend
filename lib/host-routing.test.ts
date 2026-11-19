import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PUBLIC_ASSET_ROOTS,
  decideHostRouting,
  knownHosts,
  localeFromSearch,
  normalizeHost,
  readHostRoutingConfig,
  type HostRoutingConfig,
} from "./host-routing";

const config: HostRoutingConfig = {
  publicHost: "newton.example.com",
  internalHost: "newton-intern.example.com",
  redirectHosts: ["old-123.run.app"],
};

const on = (host: string, pathname: string) => decideHostRouting(host, pathname, config);

describe("host routing — public host", () => {
  it("serves the published agents at the root, as a rewrite", () => {
    expect(on("newton.example.com", "/")).toEqual({
      kind: "rewrite",
      pathname: "/public/agents",
    });
  });

  it.each([
    "/public/agents",
    "/public/agents/",
    "/public/agents/abc",
    "/public/agents/abc/auth",
    "/public/agents/abc/chat",
  ])("keeps %s reachable, so links already sent out do not break", (pathname) => {
    expect(on("newton.example.com", pathname)).toEqual({ kind: "next" });
  });

  it.each([
    "/login",
    "/chat",
    "/agents",
    "/agents/edit/abc",
    "/intern/agents",
    "/users",
    "/configuration",
    "/artifacts/open/report.pdf",
    "/some/new/route/nobody/listed",
  ])("closes the internal route %s", (pathname) => {
    expect(on("newton.example.com", pathname)).toEqual({ kind: "notFound" });
  });

  it("does not mistake a path that merely starts with the letters for the public surface", () => {
    expect(on("newton.example.com", "/publications")).toEqual({ kind: "notFound" });
    expect(on("newton.example.com", "/public-internal")).toEqual({ kind: "notFound" });
  });

  it.each(["/exulu_logo.svg", "/fonts/inter.woff2", "/agent-idle.json", "/favicon.ico"])(
    "lets the asset %s through",
    (pathname) => {
      expect(on("newton.example.com", pathname)).toEqual({ kind: "next" });
    },
  );

  it("matches the host regardless of case and port", () => {
    expect(on("NEWTON.example.com:443", "/chat")).toEqual({ kind: "notFound" });
  });
});

describe("host routing — internal host", () => {
  it.each(["/", "/login", "/chat", "/agents/edit/abc"])("serves %s as before", (pathname) => {
    expect(on("newton-intern.example.com", pathname)).toEqual({ kind: "next" });
  });

  it("sends the public surface to its own host", () => {
    // Also what an external account hits here: the (application) layout
    // redirects it to /public/agents, and that leaves the internal host.
    expect(on("newton-intern.example.com", "/public/agents")).toEqual({
      kind: "redirect",
      host: "newton.example.com",
    });
  });
});

describe("host routing — former hostnames", () => {
  it("sends public links to the public host", () => {
    expect(on("old-123.run.app", "/public/agents/abc")).toEqual({
      kind: "redirect",
      host: "newton.example.com",
    });
  });

  it("sends everything else to the internal host", () => {
    for (const pathname of ["/", "/login", "/chat/abc"]) {
      expect(on("old-123.run.app", pathname)).toEqual({
        kind: "redirect",
        host: "newton-intern.example.com",
      });
    }
  });

  it("leaves non-public paths alone when there is no internal host to send them to", () => {
    expect(
      decideHostRouting("old-123.run.app", "/chat", { ...config, internalHost: null }),
    ).toEqual({ kind: "next" });
  });
});

describe("host routing — everything else", () => {
  it("is off entirely without a public host", () => {
    const off: HostRoutingConfig = { publicHost: null, internalHost: null, redirectHosts: [] };
    for (const pathname of ["/", "/chat", "/public/agents"]) {
      expect(decideHostRouting("anything.example.com", pathname, off)).toEqual({ kind: "next" });
    }
  });

  it("leaves unknown hosts alone, so local development keeps working", () => {
    expect(on("localhost:3000", "/")).toEqual({ kind: "next" });
    expect(on("localhost:3000", "/chat")).toEqual({ kind: "next" });
    expect(on("10.0.0.5", "/")).toEqual({ kind: "next" });
  });

  it("does nothing without a Host header rather than guessing", () => {
    expect(decideHostRouting(null, "/chat", config)).toEqual({ kind: "next" });
  });
});

describe("configuration", () => {
  it("reads and normalizes the three variables", () => {
    expect(
      readHostRoutingConfig({
        EXULU_PUBLIC_HOST: " Newton.Example.com ",
        EXULU_INTERNAL_HOST: "newton-intern.example.com:443",
        EXULU_REDIRECT_HOSTS: "old-123.run.app, , other.run.app",
      }),
    ).toEqual({
      publicHost: "newton.example.com",
      internalHost: "newton-intern.example.com",
      redirectHosts: ["old-123.run.app", "other.run.app"],
    });
  });

  it("treats empty values as unset", () => {
    expect(readHostRoutingConfig({ EXULU_PUBLIC_HOST: "" })).toEqual({
      publicHost: null,
      internalHost: null,
      redirectHosts: [],
    });
  });

  it("takes the first entry of a forwarded host list", () => {
    expect(normalizeHost("newton.example.com, proxy.internal")).toBe("newton.example.com");
  });

  it("lists the hosts the auth route may answer for", () => {
    expect(knownHosts(config, { NEXTAUTH_URL: "https://newton-intern.example.com" })).toEqual([
      "newton.example.com",
      "newton-intern.example.com",
      "newton-intern.example.com",
      "old-123.run.app",
    ]);
    expect(knownHosts({ publicHost: null, internalHost: null, redirectHosts: [] }, {})).toBeNull();
  });
});

describe("asset allowlist", () => {
  it("covers every top-level entry of public/, except the demo fixtures", () => {
    // A logo or font added to public/ and forgotten here would 404 on the
    // public host only — the one place nobody on the team looks at daily.
    const entries = readdirSync(join(__dirname, "..", "public")).filter(
      (name) => !name.startsWith(".") && name !== "demo",
    );
    for (const name of entries) {
      expect(PUBLIC_ASSET_ROOTS as readonly string[]).toContain(`/${name}`);
    }
  });
});

describe("localeFromSearch", () => {
  it("accepts supported languages, tolerating case and whitespace", () => {
    expect(localeFromSearch("en")).toBe("en");
    expect(localeFromSearch(" DE ")).toBe("de");
  });

  it("ignores everything else", () => {
    for (const value of ["fr", "", null, undefined, "english"]) {
      expect(localeFromSearch(value)).toBeNull();
    }
  });
});
