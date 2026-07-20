# Public / Guest Agent Access — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/public/agents` (listing, per-agent gates, external login/registration, slim guest chat) plus the "Guest access" section in the agent editor.

**Architecture:** A new `app/public/agents` route group with its own minimal layout (theme + i18n + config, no app shell). Server components gate per agent (public / password / login) mirroring the artifact-share pattern. Chat streams through a same-origin SSE proxy that attaches credentials server-side. External users are real users (`type='external'`) fenced out of the internal app. The agent editor gains a staged-state "Guest access" section.

**Tech Stack:** Next.js 16 App Router, next-auth v4, Apollo Client, AI SDK (`useChat` + `DefaultChatTransport`), Tailwind + shadcn/ui, next-intl (en+de), Vitest (`npm test`).

**Repo:** `/Users/daniel.claessen/Desktop/Projects/exulu/frontend`. Branch `feat/public-agents` already exists (spec + plans live on it) — work on it. **Depends on the backend plan** (`2026-07-20-public-agents-backend.md`) being deployed to the dev backend for end-to-end steps; unit-test steps run standalone.

**Spec:** `docs/superpowers/specs/2026-07-16-public-agents-design.md`

## Global Constraints

- All new user-facing copy goes through next-intl with keys in BOTH `messages/en.json` and `messages/de.json` (run `npm run check-messages` before committing i18n changes).
- Known-failing baseline on main (do NOT try to fix, only avoid NEW failures): nav-config test, 31 `variables.*` de keys, one tsc svg error, entity-types lint.
- External users: `users.type === 'external'`, role named `external` (seeded by the backend). They must never reach the `(application)` shell.
- Anonymous transcripts live in the browser only (localStorage), never server-side.
- The `guest_pw_{id}` cookie is httpOnly; client JS never reads it — the SSE proxy translates it server-side.
- Public pages must not import from `app/(application)/authenticated.tsx` (no app shell); importing chat components and types from `app/(application)/chat/*` is expected.
- Registration requires SMTP (`EMAIL_SERVER_HOST`); no unverified signup fallback.
- Commit messages: `feat(public-agents): <what>` + the Claude co-author trailer.

---

### Task 1: Domain-allowlist helper + external exemption in signIn (TDD)

**Files:**
- Create: `lib/auth/domain-allowlist.ts`
- Test: `lib/auth/domain-allowlist.test.ts`
- Modify: `app/api/auth/[...nextauth]/options.ts` (signIn callback, ~lines 168–301)

**Interfaces:**
- Produces: `isEmailDomainAllowed(email: string, allowedEmailDomainsEnv: string | undefined, existingUserType: string | null | undefined): boolean` — used by options.ts.

- [ ] **Step 1: Write the failing test**

Create `lib/auth/domain-allowlist.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isEmailDomainAllowed } from "@/lib/auth/domain-allowlist";

describe("isEmailDomainAllowed", () => {
  it("allows everything when the env is unset", () => {
    expect(isEmailDomainAllowed("a@evil.com", undefined, undefined)).toBe(true);
  });

  it("enforces the allowlist for internal/unknown users", () => {
    expect(isEmailDomainAllowed("a@acme.com", "acme.com", "user")).toBe(true);
    expect(isEmailDomainAllowed("a@evil.com", "acme.com", "user")).toBe(false);
    expect(isEmailDomainAllowed("a@evil.com", "acme.com", undefined)).toBe(false);
  });

  it("always includes the built-in exulu.com and qventu.com domains", () => {
    expect(isEmailDomainAllowed("a@exulu.com", "acme.com", "user")).toBe(true);
    expect(isEmailDomainAllowed("a@qventu.com", "acme.com", "user")).toBe(true);
  });

  it("exempts existing external users (spec §4.3)", () => {
    expect(isEmailDomainAllowed("a@evil.com", "acme.com", "external")).toBe(true);
  });

  it("handles multi-domain lists with whitespace", () => {
    expect(isEmailDomainAllowed("a@b.co", "acme.com, b.co", "user")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/auth/domain-allowlist.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/auth/domain-allowlist.ts`:

```ts
/**
 * The workforce email-domain allowlist (ALLOWED_EMAIL_DOMAINS). Self-registered
 * external users are exempt — the allowlist governs internal accounts only
 * (public-agents spec §4.3). Called from the next-auth signIn callback AFTER
 * the existing-user lookup so the caller can pass the user's type.
 */
export function isEmailDomainAllowed(
  email: string,
  allowedEmailDomainsEnv: string | undefined,
  existingUserType: string | null | undefined,
): boolean {
  if (!allowedEmailDomainsEnv) return true;
  if (existingUserType === "external") return true;
  const allowed = allowedEmailDomainsEnv
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  allowed.push("exulu.com", "qventu.com");
  return allowed.some((domain) => email.endsWith(`@${domain}`));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/auth/domain-allowlist.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewire the signIn callback**

In `app/api/auth/[...nextauth]/options.ts`, the signIn callback currently checks the allowlist BEFORE the user lookup:

```ts
          if (process.env.ALLOWED_EMAIL_DOMAINS) {
            let allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS.split(",");
            allowedDomains.push("exulu.com")
            allowedDomains.push("qventu.com")
            if (!allowedDomains.some(domain => email.endsWith(`@${domain}`))) {
              return false;
            }
          }
```

Delete that block. Then, immediately AFTER the existing-user lookup:

```ts
          const existingUserQueryResult = await client.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email])
          let existingUser = existingUserQueryResult?.rows[0];
```

insert:

```ts
          if (
            !isEmailDomainAllowed(
              email,
              process.env.ALLOWED_EMAIL_DOMAINS,
              existingUser?.type,
            )
          ) {
            return false;
          }
```

Add the import at the top: `import { isEmailDomainAllowed } from "@/lib/auth/domain-allowlist";`

(Behavior is identical for internal users and for Google auto-creation — a not-yet-existing user has `existingUser === undefined`, so the allowlist still applies. Only existing `type='external'` rows are exempt.)

- [ ] **Step 6: Typecheck + full unit tests**

Run: `npx tsc --noEmit; npm test`
Expected: no NEW failures vs. baseline.

- [ ] **Step 7: Commit**

```bash
git add lib/auth/domain-allowlist.ts lib/auth/domain-allowlist.test.ts "app/api/auth/[...nextauth]/options.ts"
git commit -m "feat(public-agents): domain allowlist exemption for external users"
```

---

### Task 2: ensure-user registration route (TDD on core logic)

**Files:**
- Create: `lib/public-auth/ensure-user-core.ts`
- Create: `lib/public-auth/rate-limit.ts`
- Test: `lib/public-auth/ensure-user-core.test.ts`
- Test: `lib/public-auth/rate-limit.test.ts`
- Create: `app/api/public-auth/ensure-user/route.ts`

**Interfaces:**
- Consumes: `pool` exported from `app/api/auth/[...nextauth]/options.ts`; bcrypt (use the SAME import statement options.ts uses — grep `bcrypt` there and match it).
- Produces:
  - `validateEnsureUserInput(body: unknown): { ok: true; email: string; password: string | null } | { ok: false; status: number; error: string }`
  - `ensureUserRateLimited(ip: string, now?: number): boolean` / `resetEnsureUserRateLimit(): void`
  - `POST /api/public-auth/ensure-user` — body `{ email, password? }`; always responds `{ ok: true }` on success (no account-enumeration signal), `400/429/503` on failure. Used by Task 8's auth page.

- [ ] **Step 1: Write the failing tests**

Create `lib/public-auth/ensure-user-core.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateEnsureUserInput } from "@/lib/public-auth/ensure-user-core";

describe("validateEnsureUserInput", () => {
  it("accepts a plain email (OTP flow), normalizing it", () => {
    expect(validateEnsureUserInput({ email: "  A@B.Co " })).toEqual({
      ok: true,
      email: "a@b.co",
      password: null,
    });
  });

  it("accepts email + password (register flow), min 8 chars", () => {
    expect(validateEnsureUserInput({ email: "a@b.co", password: "12345678" })).toEqual({
      ok: true,
      email: "a@b.co",
      password: "12345678",
    });
  });

  it("rejects short passwords", () => {
    const r = validateEnsureUserInput({ email: "a@b.co", password: "1234567" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("rejects missing or malformed emails", () => {
    for (const email of [undefined, "", "nope", "a@", "@b.co", 42]) {
      const r = validateEnsureUserInput({ email });
      expect(r.ok).toBe(false);
    }
  });

  it("rejects non-string passwords", () => {
    expect(validateEnsureUserInput({ email: "a@b.co", password: 123 }).ok).toBe(false);
  });
});
```

Create `lib/public-auth/rate-limit.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  ensureUserRateLimited,
  resetEnsureUserRateLimit,
} from "@/lib/public-auth/rate-limit";

describe("ensureUserRateLimited", () => {
  beforeEach(() => resetEnsureUserRateLimit());

  it("allows 5 per minute per IP, then limits", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(ensureUserRateLimited("1.2.3.4", t0)).toBe(false);
    expect(ensureUserRateLimited("1.2.3.4", t0)).toBe(true);
    expect(ensureUserRateLimited("5.6.7.8", t0)).toBe(false);
  });

  it("resets after the window", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 6; i++) ensureUserRateLimited("1.2.3.4", t0);
    expect(ensureUserRateLimited("1.2.3.4", t0 + 61_000)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/public-auth`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the pure modules**

Create `lib/public-auth/ensure-user-core.ts`:

```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EnsureUserValidation =
  | { ok: true; email: string; password: string | null }
  | { ok: false; status: number; error: string };

/** Validates/normalizes the ensure-user body (spec §4.2). Pure. */
export function validateEnsureUserInput(body: unknown): EnsureUserValidation {
  const b = body as { email?: unknown; password?: unknown } | null;
  const rawEmail = typeof b?.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!rawEmail || !EMAIL_RE.test(rawEmail)) {
    return { ok: false, status: 400, error: "A valid email is required." };
  }
  if (b?.password !== undefined && b?.password !== null) {
    if (typeof b.password !== "string" || b.password.length < 8) {
      return { ok: false, status: 400, error: "Password must be at least 8 characters." };
    }
    return { ok: true, email: rawEmail, password: b.password };
  }
  return { ok: true, email: rawEmail, password: null };
}
```

Create `lib/public-auth/rate-limit.ts`:

```ts
/** Fixed-window per-IP limiter for the public registration route (spec §7). */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

let windows = new Map<string, { start: number; count: number }>();

export const resetEnsureUserRateLimit = (): void => {
  windows = new Map();
};

export const ensureUserRateLimited = (
  ip: string,
  now: number = Date.now(),
): boolean => {
  const state = windows.get(ip) ?? { start: now, count: 0 };
  if (now - state.start >= WINDOW_MS) {
    state.start = now;
    state.count = 0;
  }
  state.count += 1;
  windows.set(ip, state);
  return state.count > MAX_PER_WINDOW;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/public-auth`
Expected: PASS.

- [ ] **Step 5: Implement the route handler**

Create `app/api/public-auth/ensure-user/route.ts` (match the bcrypt import used by options.ts):

```ts
import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";

import { pool } from "@/app/api/auth/[...nextauth]/options";
import { validateEnsureUserInput } from "@/lib/public-auth/ensure-user-core";
import { ensureUserRateLimited } from "@/lib/public-auth/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Creates a `type='external'` user row if the email is unknown (spec §4.2).
 * - Registration requires SMTP: without EMAIL_SERVER_HOST there is no OTP
 *   verification path, so respond 503 (the UI hides signup then anyway).
 * - Existing users (any type) are NEVER modified.
 * - The response is identical whether the user existed or was created —
 *   no account-enumeration signal.
 */
export async function POST(req: NextRequest) {
  if (!process.env.EMAIL_SERVER_HOST) {
    return NextResponse.json(
      { detail: "Registration is unavailable." },
      { status: 503 },
    );
  }
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (ensureUserRateLimited(ip)) {
    return NextResponse.json({ detail: "Too many requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const parsed = validateEnsureUserInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ detail: parsed.error }, { status: parsed.status });
  }

  const client = await pool.connect();
  try {
    const existing = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [parsed.email],
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ ok: true });
    }
    const roleResult = await client.query(
      "SELECT id FROM roles WHERE name = $1",
      ["external"],
    );
    const externalRole = roleResult.rows[0];
    if (!externalRole) {
      console.error("[EXULU] external role missing — backend seed not run?");
      return NextResponse.json(
        { detail: "Registration is unavailable." },
        { status: 503 },
      );
    }
    const passwordHash = parsed.password
      ? await bcrypt.hash(parsed.password, 12)
      : null;
    await client.query(
      `INSERT INTO users ("email", "name", "password", "createdAt", "updatedAt", "type", "super_admin", "role")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [parsed.email, "", passwordHash, new Date(), new Date(), "external", false, externalRole.id],
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[EXULU] ensure-user failed", error);
    return NextResponse.json({ detail: "Something went wrong." }, { status: 500 });
  } finally {
    client.release();
  }
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no NEW errors.

- [ ] **Step 7: Commit**

```bash
git add lib/public-auth app/api/public-auth
git commit -m "feat(public-agents): external self-registration ensure-user route"
```

---

### Task 3: Fence external users out of the internal app

**Files:**
- Modify: `app/(application)/layout.tsx` (~line 41)

**Interfaces:**
- Consumes: `serverSideAuthCheck()` returns the full users row (including `type`).
- Produces: any `type='external'` user hitting ANY `(application)` route is redirected to `/public/agents`.

- [ ] **Step 1: Add the redirect**

In `app/(application)/layout.tsx`, directly after:

```ts
    const user = await serverSideAuthCheck();
    if (!user) return redirect(`/login${pathname ? `?destination=${pathname}` : ''}`);
```

add:

```ts
    // External (self-registered) users never enter the internal shell —
    // public-agents spec §4.4. Everything they may use lives under /public.
    if ((user as any).type === "external") return redirect("/public/agents");
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no NEW errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(application)/layout.tsx"
git commit -m "feat(public-agents): redirect external users out of the internal app"
```

---

### Task 4: Public-agents API client + gate decision (TDD)

**Files:**
- Create: `lib/api/public-agents.ts`
- Create: `lib/public-agents/gate.ts`
- Test: `lib/public-agents/gate.test.ts`

**Interfaces:**
- Consumes: backend endpoints from the backend plan Task 5.
- Produces (used by Tasks 6–11):
  - `type PublicAgentMeta = { id: string; name: string; description: string; image: string | null; welcomemessage: string; slug: string; guest_auth_mode: "public" | "password" | "regular"; guest_has_cover: boolean }`
  - `fetchPublicAgents(): Promise<PublicAgentMeta[] | null>` (server-side; null = backend error)
  - `fetchPublicAgentMeta(id: string): Promise<PublicAgentMeta | "notfound" | null>`
  - `verifyGuestPassword(id: string, password: string): Promise<boolean>`
  - `decideGate(mode, hasPasswordCookie, isAuthenticated): "chat-anonymous" | "password-gate" | "auth-redirect" | "chat-authenticated"`

- [ ] **Step 1: Write the failing gate test**

Create `lib/public-agents/gate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decideGate } from "@/lib/public-agents/gate";

describe("decideGate", () => {
  it("public mode always chats anonymously (even when logged in — spec §5)", () => {
    expect(decideGate("public", false, false)).toBe("chat-anonymous");
    expect(decideGate("public", false, true)).toBe("chat-anonymous");
  });

  it("password mode gates on the cookie", () => {
    expect(decideGate("password", false, false)).toBe("password-gate");
    expect(decideGate("password", true, false)).toBe("chat-anonymous");
    expect(decideGate("password", false, true)).toBe("password-gate");
  });

  it("regular mode gates on authentication", () => {
    expect(decideGate("regular", false, false)).toBe("auth-redirect");
    expect(decideGate("regular", false, true)).toBe("chat-authenticated");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/public-agents/gate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement both modules**

Create `lib/public-agents/gate.ts`:

```ts
export type PublicAgentAuthMode = "public" | "password" | "regular";

export type GateDecision =
  | "chat-anonymous"
  | "password-gate"
  | "auth-redirect"
  | "chat-authenticated";

/**
 * Server-side gate for /public/agents/[id] (spec §5.1). Persistent sessions
 * exist ONLY in regular (login) mode; public/password chat is ephemeral for
 * everyone, signed-in or not.
 */
export function decideGate(
  mode: PublicAgentAuthMode,
  hasPasswordCookie: boolean,
  isAuthenticated: boolean,
): GateDecision {
  if (mode === "password") {
    return hasPasswordCookie ? "chat-anonymous" : "password-gate";
  }
  if (mode === "regular") {
    return isAuthenticated ? "chat-authenticated" : "auth-redirect";
  }
  return "chat-anonymous";
}
```

Create `lib/api/public-agents.ts`:

```ts
import "server-only";

import type { PublicAgentAuthMode } from "@/lib/public-agents/gate";

export interface PublicAgentMeta {
  id: string;
  name: string;
  description: string;
  image: string | null;
  welcomemessage: string;
  slug: string;
  guest_auth_mode: PublicAgentAuthMode;
  guest_has_cover: boolean;
}

const backend = () => process.env.BACKEND || "";

/** Server-side list of guest-enabled agents. null = backend unreachable. */
export async function fetchPublicAgents(): Promise<PublicAgentMeta[] | null> {
  if (!backend()) return null;
  try {
    const res = await fetch(`${backend()}/public-agents`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as PublicAgentMeta[];
  } catch {
    return null;
  }
}

export async function fetchPublicAgentMeta(
  id: string,
): Promise<PublicAgentMeta | "notfound" | null> {
  if (!backend()) return null;
  try {
    const res = await fetch(
      `${backend()}/public-agents/${encodeURIComponent(id)}/meta`,
      { cache: "no-store" },
    );
    if (res.status === 404) return "notfound";
    if (!res.ok) return null;
    return (await res.json()) as PublicAgentMeta;
  } catch {
    return null;
  }
}

export async function verifyGuestPassword(
  id: string,
  password: string,
): Promise<boolean> {
  const res = await fetch(
    `${backend()}/public-agents/${encodeURIComponent(id)}/verify-password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      cache: "no-store",
    },
  );
  return res.status === 204;
}
```

(If the repo does not have the `server-only` package, drop that import line — check `package.json` first.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/public-agents/gate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/api/public-agents.ts lib/public-agents/gate.ts lib/public-agents/gate.test.ts
git commit -m "feat(public-agents): public-agents API client and gate decision"
```

---

### Task 5: Public route-group layout + i18n namespace

**Files:**
- Create: `app/public/agents/layout.tsx`
- Modify: `components/shell/config-context.tsx` (add optional `public_auth` key)
- Modify: `messages/en.json`, `messages/de.json` (new `publicAgents` namespace)
- Modify: `app/(application)/layout.tsx` and `app/(authentication)/layout.tsx` config objects (add `public_auth`)

**Interfaces:**
- Consumes: the `(authentication)` layout as the template (theme CSS injection, LanguageProvider, ConfigContextProvider, favicons).
- Produces: a layout wrapping all `/public/agents/*` routes; `ConfigContextType.public_auth?: { otp_available: boolean }`; the `publicAgents.*` i18n namespace.

- [ ] **Step 1: Extend ConfigContextType**

In `components/shell/config-context.tsx`, add to `ConfigContextType`:

```ts
    public_auth?: {
        otp_available: boolean;
    };
```

- [ ] **Step 2: Create the layout**

Create `app/public/agents/layout.tsx` — copy `app/(authentication)/layout.tsx` and adapt: same `<html>`/`<head>` (favicons + theme CSS via `configApi.theme()`), same `ConfigContextProvider` + `LanguageProvider` + `ThemeProvider` + `Toaster`, but WITHOUT the `AuthShell` wrapper (pages decide their own frame). The config object:

```ts
  const config = {
    backend: process.env.BACKEND || "",
    google_client_id: "",
    auth_mode: process.env.AUTH_MODE || "",
    public_auth: {
      otp_available: !!process.env.EMAIL_SERVER_HOST,
    },
  };
```

Body element:

```tsx
      <body
        className={cn(
          "flex min-h-dvh flex-col bg-background font-sans antialiased",
          fontVariables,
        )}
      >
        <ConfigContextProvider config={config}>
          <LanguageProvider initialLocale={locale} initialMessages={messages}>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              {children}
              <Toaster />
            </ThemeProvider>
          </LanguageProvider>
        </ConfigContextProvider>
      </body>
```

- [ ] **Step 3: Add `public_auth` to the other two layout configs**

In `app/(application)/layout.tsx` and `app/(authentication)/layout.tsx`, add the same `public_auth: { otp_available: !!process.env.EMAIL_SERVER_HOST }` entry to their `config` objects (the agent editor's SMTP hint reads it).

- [ ] **Step 4: Add the i18n namespace**

Add to `messages/en.json` (top level, alphabetical position after `prompts`):

```json
  "publicAgents": {
    "listTitle": "Choose an agent",
    "listDescription": "Select an agent to start chatting.",
    "openAgent": "Open",
    "empty": {
      "title": "No agents available",
      "description": "There are currently no published agents."
    },
    "notFound": {
      "title": "Agent not found",
      "description": "This agent does not exist or is no longer available."
    },
    "unavailable": {
      "title": "This agent is no longer available",
      "description": "It may have been unpublished."
    },
    "misconfigured": {
      "title": "Something went wrong",
      "description": "The server is not reachable. Try again later."
    },
    "passwordGate": {
      "title": "This agent is password protected",
      "placeholder": "Password",
      "submit": "Continue",
      "checking": "Checking…",
      "error": "Incorrect password. Try again."
    },
    "auth": {
      "title": "Sign in to chat with {agent}",
      "registerTitle": "Create an account",
      "email": "Email",
      "password": "Password",
      "passwordMin": "At least 8 characters",
      "continue": "Continue",
      "signIn": "Sign in",
      "register": "Register",
      "switchToRegister": "New here? Create an account",
      "switchToSignIn": "Already have an account? Sign in",
      "registrationUnavailable": "Registration is currently unavailable.",
      "genericError": "Something went wrong. Try again."
    },
    "chat": {
      "newChat": "New chat",
      "clear": "Clear conversation",
      "signOut": "Sign out",
      "history": "History",
      "noSessions": "No previous conversations",
      "rateLimited": "You're sending messages too quickly. Please wait a moment.",
      "messageTooLong": "Your message is too long.",
      "sendFailed": "Sending failed. Try again."
    }
  },
```

Add the German equivalents at the same position in `messages/de.json`:

```json
  "publicAgents": {
    "listTitle": "Agent auswählen",
    "listDescription": "Wähle einen Agenten, um zu chatten.",
    "openAgent": "Öffnen",
    "empty": {
      "title": "Keine Agenten verfügbar",
      "description": "Derzeit sind keine Agenten veröffentlicht."
    },
    "notFound": {
      "title": "Agent nicht gefunden",
      "description": "Dieser Agent existiert nicht oder ist nicht mehr verfügbar."
    },
    "unavailable": {
      "title": "Dieser Agent ist nicht mehr verfügbar",
      "description": "Er wurde möglicherweise zurückgezogen."
    },
    "misconfigured": {
      "title": "Etwas ist schiefgelaufen",
      "description": "Der Server ist nicht erreichbar. Versuche es später erneut."
    },
    "passwordGate": {
      "title": "Dieser Agent ist passwortgeschützt",
      "placeholder": "Passwort",
      "submit": "Weiter",
      "checking": "Wird geprüft…",
      "error": "Falsches Passwort. Versuche es erneut."
    },
    "auth": {
      "title": "Melde dich an, um mit {agent} zu chatten",
      "registerTitle": "Konto erstellen",
      "email": "E-Mail",
      "password": "Passwort",
      "passwordMin": "Mindestens 8 Zeichen",
      "continue": "Weiter",
      "signIn": "Anmelden",
      "register": "Registrieren",
      "switchToRegister": "Neu hier? Konto erstellen",
      "switchToSignIn": "Bereits ein Konto? Anmelden",
      "registrationUnavailable": "Die Registrierung ist derzeit nicht verfügbar.",
      "genericError": "Etwas ist schiefgelaufen. Versuche es erneut."
    },
    "chat": {
      "newChat": "Neuer Chat",
      "clear": "Unterhaltung löschen",
      "signOut": "Abmelden",
      "history": "Verlauf",
      "noSessions": "Keine früheren Unterhaltungen",
      "rateLimited": "Du sendest Nachrichten zu schnell. Bitte warte einen Moment.",
      "messageTooLong": "Deine Nachricht ist zu lang.",
      "sendFailed": "Senden fehlgeschlagen. Versuche es erneut."
    }
  },
```

- [ ] **Step 5: Verify messages parity + typecheck**

Run: `npm run check-messages && npx tsc --noEmit`
Expected: no NEW missing keys (the 31 known de `variables.*` gaps remain) and no NEW ts errors.

- [ ] **Step 6: Commit**

```bash
git add app/public components/shell/config-context.tsx messages/en.json messages/de.json "app/(application)/layout.tsx" "app/(authentication)/layout.tsx"
git commit -m "feat(public-agents): public route-group layout, config flag, i18n namespace"
```

---

### Task 6: Listing page `/public/agents`

**Files:**
- Create: `app/public/agents/page.tsx`
- Create: `app/public/agents/components/centered-note.tsx`

**Interfaces:**
- Consumes: `fetchPublicAgents` (Task 4), `publicAgents.*` i18n keys (Task 5).
- Produces: the selection grid; `CenteredNote` (`{ title, description }`) reused by later tasks.

- [ ] **Step 1: Create the shared empty/error note**

Create `app/public/agents/components/centered-note.tsx`:

```tsx
export function CenteredNote({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-8">
      <div className="max-w-sm space-y-2 text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the listing page**

Create `app/public/agents/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { fetchPublicAgents } from "@/lib/api/public-agents";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CenteredNote } from "./components/centered-note";

export const dynamic = "force-dynamic";

export default async function PublicAgentsPage() {
  const t = await getTranslations("publicAgents");
  const agents = await fetchPublicAgents();

  if (agents === null) {
    return (
      <CenteredNote
        title={t("misconfigured.title")}
        description={t("misconfigured.description")}
      />
    );
  }
  if (agents.length === 0) {
    return (
      <CenteredNote title={t("empty.title")} description={t("empty.description")} />
    );
  }
  if (agents.length === 1) {
    redirect(`/public/agents/${encodeURIComponent(agents[0].id)}`);
  }

  return (
    <main className="mx-auto w-full max-w-4xl grow px-4 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("listTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("listDescription")}</p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            href={`/public/agents/${encodeURIComponent(agent.id)}`}
            className="group focus-visible:outline-none"
          >
            <Card className="h-full transition-colors group-hover:border-primary/50 group-focus-visible:ring-2 group-focus-visible:ring-ring">
              <CardContent className="flex items-start gap-4 p-4">
                {agent.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={agent.image}
                    alt=""
                    className="size-12 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-medium">
                    {agent.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium">{agent.name}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {agent.description}
                  </p>
                  {agent.guest_auth_mode !== "public" ? (
                    <Badge variant="outline">
                      {agent.guest_auth_mode === "password" ? "🔒" : "👤"}
                    </Badge>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
```

Note: `agent.image` may be an S3 key rather than a URL — check how the internal agent grid (`app/(application)/chat/page.tsx` or its agent-card component) renders `agent.image` and mirror that resolution exactly; if it needs an authenticated URL, fall back to the initial-letter avatar on public pages.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, visit `http://localhost:3000/public/agents` with 0 / 1 / ≥2 guest-enabled agents in the backend.
Expected: empty note / redirect to the single agent / grid.

- [ ] **Step 4: Commit**

```bash
git add app/public/agents/page.tsx app/public/agents/components/centered-note.tsx
git commit -m "feat(public-agents): public agent selection page"
```

---

### Task 7: Gate page `/public/agents/[id]` + password gate

**Files:**
- Create: `app/public/agents/[id]/page.tsx`
- Create: `app/public/agents/[id]/guest-password-gate.tsx`
- Create: `app/public/agents/[id]/actions.ts`

**Interfaces:**
- Consumes: `fetchPublicAgentMeta`, `verifyGuestPassword`, `decideGate` (Task 4); `getServerSession` + `getAuthOptions`; `serverSideAuthCheck` for the authenticated branch; Task 10's `PublicChatScreen` (until then, render a placeholder `<div data-testid="public-chat" />` and swap in Task 10).
- Produces: the fully gated page; cookie `guest_pw_{id}` (httpOnly, path-scoped); `setGuestPassword(id, password)` server action.

- [ ] **Step 1: Server action**

Create `app/public/agents/[id]/actions.ts` (mirrors `app/artifacts/[artifact_name]/actions.ts`):

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function setGuestPassword(id: string, password: string) {
  (await cookies()).set(`guest_pw_${id}`, password, {
    httpOnly: true,
    sameSite: "lax",
    path: `/public/agents/${id}`,
  });
  redirect(`/public/agents/${encodeURIComponent(id)}`);
}
```

- [ ] **Step 2: Password gate component**

Create `app/public/agents/[id]/guest-password-gate.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setGuestPassword } from "./actions";

export function GuestPasswordGate({ id, error }: { id: string; error?: boolean }) {
  const t = useTranslations("publicAgents.passwordGate");
  const [pw, setPw] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex min-h-dvh items-center justify-center p-8">
      <form
        className="w-full max-w-sm space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => setGuestPassword(id, pw));
        }}
      >
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        {error && <p className="text-sm text-destructive">{t("error")}</p>}
        <Input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder={t("placeholder")}
          autoFocus
        />
        <Button type="submit" disabled={pending || !pw} className="w-full">
          {pending ? t("checking") : t("submit")}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: The gate page**

Create `app/public/agents/[id]/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";

import { getAuthOptions } from "@/app/api/auth/[...nextauth]/options";
import { fetchPublicAgentMeta, verifyGuestPassword } from "@/lib/api/public-agents";
import { decideGate } from "@/lib/public-agents/gate";
import { serverSideAuthCheck } from "@/lib/server-side-auth-check";
import { CenteredNote } from "../components/centered-note";
import { GuestPasswordGate } from "./guest-password-gate";

export const dynamic = "force-dynamic";

export default async function PublicAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("publicAgents");

  const meta = await fetchPublicAgentMeta(id);
  if (meta === "notfound") {
    return (
      <CenteredNote title={t("notFound.title")} description={t("notFound.description")} />
    );
  }
  if (meta === null) {
    return (
      <CenteredNote
        title={t("misconfigured.title")}
        description={t("misconfigured.description")}
      />
    );
  }

  const pw = (await cookies()).get(`guest_pw_${id}`)?.value;
  const session: any = await getServerSession(await getAuthOptions());
  const decision = decideGate(meta.guest_auth_mode, !!pw, !!session?.user);

  if (decision === "password-gate") {
    return <GuestPasswordGate id={id} />;
  }
  if (decision === "chat-anonymous" && meta.guest_auth_mode === "password") {
    // Re-verify the cookie every load: rotated/removed passwords or
    // unpublished agents send the visitor back to the gate (spec §5.5).
    const ok = await verifyGuestPassword(id, pw!);
    if (!ok) return <GuestPasswordGate id={id} error />;
  }
  if (decision === "auth-redirect") {
    redirect(`/public/agents/${encodeURIComponent(id)}/auth`);
  }

  if (decision === "chat-authenticated") {
    const user = await serverSideAuthCheck();
    if (!user) redirect(`/public/agents/${encodeURIComponent(id)}/auth`);
    // Placeholder until Task 10/11 — replaced by <PublicChatScreen ... />
    return <div data-testid="public-chat" data-mode="authenticated" />;
  }

  // Placeholder until Task 10 — replaced by <PublicChatScreen ... />
  return <div data-testid="public-chat" data-mode="anonymous" />;
}
```

- [ ] **Step 4: Manual verification**

With one agent per mode in the dev backend: `public` renders the placeholder; `password` shows the gate, accepts the correct password (cookie set, placeholder renders), rejects a wrong one with the error state; `regular` redirects to `/public/agents/[id]/auth` (404 until Task 8 — that's expected).

- [ ] **Step 5: Commit**

```bash
git add "app/public/agents/[id]"
git commit -m "feat(public-agents): per-agent gate page with password gate"
```

---

### Task 8: External auth page `/public/agents/[id]/auth`

**Files:**
- Create: `app/public/agents/[id]/auth/page.tsx`
- Create: `app/public/agents/[id]/auth/public-auth.tsx`

**Interfaces:**
- Consumes: `AuthShell` from `app/(authentication)/components/auth-shell`; `OtpStep` from `app/(authentication)/login/components/otp-step` (props: `{ email, destination, onChangeEmail }`); `POST /api/public-auth/ensure-user` (Task 2); `ConfigContext` (`auth_mode`, `public_auth.otp_available`); `signIn` from `next-auth/react`.
- Produces: login + registration for external users, with the agent's custom cover image.

- [ ] **Step 1: Server page**

Create `app/public/agents/[id]/auth/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { getAuthOptions } from "@/app/api/auth/[...nextauth]/options";
import { fetchPublicAgentMeta } from "@/lib/api/public-agents";
import { AuthShell } from "@/app/(authentication)/components/auth-shell";
import { PublicAuth } from "./public-auth";

export const dynamic = "force-dynamic";

export default async function PublicAgentAuthPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meta = await fetchPublicAgentMeta(id);
  const agentUrl = `/public/agents/${encodeURIComponent(id)}`;

  // Only login-mode agents have an auth page; everything else goes back.
  if (meta === "notfound" || meta === null || meta.guest_auth_mode !== "regular") {
    redirect(agentUrl);
  }

  const session: any = await getServerSession(await getAuthOptions());
  if (session?.user) redirect(agentUrl);

  const backend = process.env.BACKEND || "";
  const coverUrl = meta.guest_has_cover
    ? `${backend}/public-agents/${encodeURIComponent(id)}/cover`
    : backend
      ? `${backend}/cover.jpg`
      : undefined;

  return (
    <AuthShell coverUrl={coverUrl} termsHref={process.env.TERMS_URL || undefined}>
      <PublicAuth agentId={id} agentName={meta.name} destination={agentUrl} />
    </AuthShell>
  );
}
```

- [ ] **Step 2: Client auth component**

Create `app/public/agents/[id]/auth/public-auth.tsx`. Model the state machine on `app/(authentication)/login/login.tsx` (read it first); the complete component:

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfigContext } from "@/components/shell/config-context";
import { OtpStep } from "@/app/(authentication)/login/components/otp-step";

type Step = "identify" | "verify";
type Tab = "signIn" | "register";

export function PublicAuth({
  agentId,
  agentName,
  destination,
}: {
  agentId: string;
  agentName: string;
  destination: string;
}) {
  const t = useTranslations("publicAgents.auth");
  const router = useRouter();
  const configContext = React.useContext(ConfigContext);

  const isOtp = configContext?.auth_mode === "otp";
  const otpAvailable = !!configContext?.public_auth?.otp_available;

  const [step, setStep] = React.useState<Step>("identify");
  const [tab, setTab] = React.useState<Tab>("signIn");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function ensureUser(withPassword: boolean): Promise<boolean> {
    const res = await fetch("/api/public-auth/ensure-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        withPassword ? { email, password } : { email },
      ),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.detail ?? t("genericError"));
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);
    setError(null);
    setSubmitting(true);
    try {
      if (isOtp) {
        // OTP mode: registration and login are one flow (spec §4.2).
        if (!(await ensureUser(false))) return;
        const res = await signIn("email", { email: normalizedEmail, redirect: false });
        if (res?.error) {
          setError(t("genericError"));
          return;
        }
        setStep("verify");
        return;
      }
      if (tab === "register") {
        // Password mode registration: create, then verify by OTP code.
        if (!(await ensureUser(true))) return;
        const res = await signIn("email", { email: normalizedEmail, redirect: false });
        if (res?.error) {
          setError(t("genericError"));
          return;
        }
        setStep("verify");
        return;
      }
      // Password mode sign-in.
      const res = await signIn("credentials", {
        email: normalizedEmail,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.push(destination);
    } catch (err) {
      console.error(err);
      setError(t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "verify") {
    return (
      <OtpStep
        email={email}
        destination={destination}
        onChangeEmail={() => setStep("identify")}
      />
    );
  }

  const showRegisterTab = !isOtp && otpAvailable;

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {tab === "register" ? t("registerTitle") : t("title", { agent: agentName })}
        </h1>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        <Label htmlFor="public-auth-email">{t("email")}</Label>
        <Input
          id="public-auth-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {!isOtp && (
        <div className="space-y-2">
          <Label htmlFor="public-auth-password">{t("password")}</Label>
          <Input
            id="public-auth-password"
            type="password"
            autoComplete={tab === "register" ? "new-password" : "current-password"}
            required
            minLength={tab === "register" ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {tab === "register" && (
            <p className="text-xs text-muted-foreground">{t("passwordMin")}</p>
          )}
        </div>
      )}

      <Button type="submit" disabled={submitting} className="w-full">
        {isOtp ? t("continue") : tab === "register" ? t("register") : t("signIn")}
      </Button>

      {showRegisterTab && (
        <button
          type="button"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          onClick={() => {
            setError(null);
            setTab(tab === "register" ? "signIn" : "register");
          }}
        >
          {tab === "register" ? t("switchToSignIn") : t("switchToRegister")}
        </button>
      )}
      {!isOtp && !otpAvailable && (
        <p className="text-xs text-muted-foreground">{t("registrationUnavailable")}</p>
      )}
    </form>
  );
}
```

Check `OtpStep`'s internals once before wiring: it verifies via `/api/auth/callback/email?...&callbackUrl=` — confirm it accepts an arbitrary `destination` path (it does per its props contract; if it hardcodes anything login-specific, copy it to `app/public/agents/[id]/auth/otp-step.tsx` and adjust the destination handling only).

- [ ] **Step 3: End-to-end verification (dev backend + SMTP configured, e.g. Mailpit)**

- OTP mode (`AUTH_MODE=otp`): new email on the auth page → user row appears with `type='external'` + external role → code arrives → verify → lands on `/public/agents/[id]` chat placeholder.
- Password mode: register tab → account + code → verify → lands on agent. Then sign out (clear cookies), sign in with email+password → works.
- An internal user's email + existing password also signs in and reaches the agent.
- Visit `/` as the external user → redirected to `/public/agents` (Task 3).

- [ ] **Step 4: Commit**

```bash
git add "app/public/agents/[id]/auth"
git commit -m "feat(public-agents): external login/registration page with custom cover"
```

---

### Task 9: SSE chat proxy route

**Files:**
- Create: `app/public/agents/[id]/chat/route.ts`

**Interfaces:**
- Consumes: backend meta + run endpoints; `guest_pw_{id}` cookie; next-auth session JWT.
- Produces: `POST /public/agents/[id]/chat` — same-origin streaming endpoint used by Task 10's transport. Forwards `Session` header only for authenticated callers.

- [ ] **Step 1: Implement**

Create `app/public/agents/[id]/chat/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";

import { getAuthOptions } from "@/app/api/auth/[...nextauth]/options";

export const dynamic = "force-dynamic";

/**
 * Same-origin SSE proxy (spec §5.3): attaches credentials server-side
 * (httpOnly password cookie → x-guest-password; session JWT → Authorization)
 * and pipes the backend stream through. The backend independently enforces
 * gating, rate limits, and caps — this is a credential translator, not a gate.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const backend = process.env.BACKEND;
  if (!backend) {
    return NextResponse.json({ detail: "Server misconfigured." }, { status: 500 });
  }

  const metaRes = await fetch(
    `${backend}/public-agents/${encodeURIComponent(id)}/meta`,
    { cache: "no-store" },
  );
  if (!metaRes.ok) return new NextResponse(null, { status: metaRes.status });
  const meta = (await metaRes.json()) as {
    slug: string;
    guest_auth_mode: "public" | "password" | "regular";
  };
  if (!meta.slug) {
    return NextResponse.json({ detail: "Agent has no chat route." }, { status: 500 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Stream: "true",
  };
  if (meta.guest_auth_mode === "regular") {
    const session: any = await getServerSession(await getAuthOptions());
    if (!session?.user?.jwt) return new NextResponse(null, { status: 401 });
    headers["Authorization"] = `Bearer ${session.user.jwt}`;
    const sessionHeader = req.headers.get("session");
    if (sessionHeader) headers["Session"] = sessionHeader;
  } else if (meta.guest_auth_mode === "password") {
    const pw = (await cookies()).get(`guest_pw_${id}`)?.value;
    if (!pw) return new NextResponse(null, { status: 401 });
    headers["x-guest-password"] = pw;
  }

  const body = await req.text();
  const upstream = await fetch(`${backend}${meta.slug}/${encodeURIComponent(id)}`, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });

  const respHeaders = new Headers();
  respHeaders.set(
    "Content-Type",
    upstream.headers.get("content-type") ?? "text/event-stream",
  );
  respHeaders.set("Cache-Control", "no-store");
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
}
```

- [ ] **Step 2: Manual verification**

With a `public`-mode agent:

```bash
curl -N -s -X POST "localhost:3000/public/agents/<id>/chat" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"id":"m1","role":"user","parts":[{"type":"text","text":"hi"}]}]}'
```

Expected: an SSE/UI-message stream. A password-mode agent without the cookie → 401.

- [ ] **Step 3: Commit**

```bash
git add "app/public/agents/[id]/chat"
git commit -m "feat(public-agents): same-origin SSE chat proxy"
```

---

### Task 10: Anonymous public chat (transcript store TDD + controller + screen)

**Files:**
- Create: `lib/public-agents/transcript-store.ts`
- Test: `lib/public-agents/transcript-store.test.ts`
- Create: `app/public/agents/[id]/components/use-public-chat-session.ts`
- Create: `app/public/agents/[id]/components/public-chat-screen.tsx`
- Modify: `app/public/agents/[id]/page.tsx` (replace both placeholders)

**Interfaces:**
- Consumes: `ChatSessionController` type + `useChat`/`DefaultChatTransport` usage from `app/(application)/chat/hooks.ts` (READ ITS TOP + TRANSPORT BLOCK FIRST and mirror the exact imports/option names); `MessageColumn`, `Composer` from `app/(application)/chat/components/`; the proxy (Task 9).
- Produces:
  - `loadTranscript(agentId: string): UIMessage[]` / `saveTranscript(agentId: string, messages: UIMessage[]): void` / `clearTranscript(agentId: string): void`
  - `usePublicChatSession({ agent, mode, userId }): { controller: ChatSessionController; clearConversation: () => void }` — a complete implementation of the controller interface (TypeScript enforces it)
  - `PublicChatScreen({ agent, mode, userId })` — used by the gate page.

- [ ] **Step 1: Write the failing transcript-store tests**

Create `lib/public-agents/transcript-store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearTranscript,
  loadTranscript,
  saveTranscript,
} from "@/lib/public-agents/transcript-store";

// vitest node env: emulate localStorage.
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

const msg = (id: string) => ({
  id,
  role: "user",
  parts: [{ type: "text", text: `m${id}` }],
});

describe("transcript store", () => {
  it("round-trips messages per agent", () => {
    saveTranscript("a1", [msg("1")] as any);
    saveTranscript("a2", [msg("2")] as any);
    expect(loadTranscript("a1")).toHaveLength(1);
    expect(loadTranscript("a1")[0].id).toBe("1");
    expect(loadTranscript("a2")[0].id).toBe("2");
  });

  it("returns [] for unknown agents and corrupt data", () => {
    expect(loadTranscript("nope")).toEqual([]);
    (globalThis as any).localStorage.setItem("exulu_public_chat_bad", "{not json");
    expect(loadTranscript("bad")).toEqual([]);
  });

  it("caps stored messages at 50 (keeps the newest)", () => {
    const many = Array.from({ length: 60 }, (_, i) => msg(String(i)));
    saveTranscript("a1", many as any);
    const loaded = loadTranscript("a1");
    expect(loaded).toHaveLength(50);
    expect(loaded[0].id).toBe("10");
    expect(loaded[49].id).toBe("59");
  });

  it("clearTranscript removes the entry", () => {
    saveTranscript("a1", [msg("1")] as any);
    clearTranscript("a1");
    expect(loadTranscript("a1")).toEqual([]);
  });

  it("is a no-op without localStorage (SSR safety)", () => {
    delete (globalThis as any).localStorage;
    expect(() => saveTranscript("a1", [msg("1")] as any)).not.toThrow();
    expect(loadTranscript("a1")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/public-agents/transcript-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the store**

Create `lib/public-agents/transcript-store.ts`:

```ts
import type { UIMessage } from "ai";

const KEY_PREFIX = "exulu_public_chat_";
const MAX_MESSAGES = 50;

const storage = (): Storage | null =>
  typeof localStorage === "undefined" ? null : localStorage;

/** Best-effort browser persistence for anonymous transcripts (spec §5.4). */
export function loadTranscript(agentId: string): UIMessage[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(KEY_PREFIX + agentId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveTranscript(agentId: string, messages: UIMessage[]): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(
      KEY_PREFIX + agentId,
      JSON.stringify(messages.slice(-MAX_MESSAGES)),
    );
  } catch {
    // Quota exceeded etc. — transcripts are best-effort.
  }
}

export function clearTranscript(agentId: string): void {
  storage()?.removeItem(KEY_PREFIX + agentId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/public-agents/transcript-store.test.ts`
Expected: PASS.

- [ ] **Step 5: The public controller hook**

**Before writing:** open `app/(application)/chat/hooks.ts` and read (a) its imports for `useChat`/`DefaultChatTransport`, (b) the `useChat({...})` call, (c) the `ContextState` union and `TokenCounts` shape. Mirror those exactly.

Create `app/public/agents/[id]/components/use-public-chat-session.ts` — the essential structure (adapt member-by-member against the real `ChatSessionController` type; every member must be implemented, most as inert values):

```ts
"use client";

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useTranslations } from "next-intl";

import type {
  ChatSessionController,
} from "@/app/(application)/chat/hooks";
import type { Agent } from "@/types/models/agent";
import {
  clearTranscript,
  loadTranscript,
  saveTranscript,
} from "@/lib/public-agents/transcript-store";

export interface UsePublicChatSessionArgs {
  agent: Agent; // minimal cast from PublicAgentMeta — see PublicChatScreen
  mode: "anonymous" | "authenticated";
  userId?: string | number;
}

const GUEST_MAX_INPUT = 8000; // mirrors EXULU_GUEST_MAX_MESSAGE_CHARS default

export function usePublicChatSession({
  agent,
  mode,
  userId,
}: UsePublicChatSessionArgs): ChatSessionController {
  const t = useTranslations("publicAgents.chat");
  const tRoot = useTranslations("publicAgents");
  const [error, setError] = React.useState<string | null>(null);
  const initialMessages = React.useMemo(
    () => (mode === "anonymous" ? loadTranscript(agent.id) : []),
    [agent.id, mode],
  );

  const chat = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: `/public/agents/${agent.id}/chat`,
      prepareSendMessagesRequest: async ({ messages, body }) => ({
        // Anonymous: no server session — send the FULL history so the model
        // has context (backend uses body.messages when no session header).
        body: { ...body, messages },
        headers: { Stream: "true" },
      }),
    }),
    onError: (err) => {
      const msg = String(err?.message ?? "");
      if (msg.includes("429")) setError(t("rateLimited"));
      else if (msg.includes("413")) setError(t("messageTooLong"));
      else if (msg.includes("404") || msg.includes("403"))
        // Agent was unpublished mid-conversation (spec §5.5).
        setError(tRoot("unavailable.title"));
      else setError(t("sendFailed"));
    },
  });

  // Persist anonymous transcripts (best effort).
  React.useEffect(() => {
    if (mode === "anonymous") saveTranscript(agent.id, chat.messages);
  }, [agent.id, chat.messages, mode]);

  const sendUserMessage = React.useCallback(
    async (text: string) => {
      setError(null);
      await chat.sendMessage({ text });
    },
    [chat],
  );

  const clearConversation = React.useCallback(() => {
    chat.setMessages([]);
    clearTranscript(agent.id);
  }, [agent.id, chat]);

  const controller = {
    agent,
    session: null,
    writeAccess: true,
    creatorEmail: undefined,
    messages: chat.messages,
    status: chat.status,
    sendUserMessage,
    sendQuestionAnswer: (answerText: string) => void sendUserMessage(answerText),
    stop: chat.stop,
    regenerate: chat.regenerate,
    setMessages: chat.setMessages,
    // Guest chat has no tool-approval surface; agents published to guests
    // must not rely on approval-gated tools (spec §10 limitation).
    addToolApprovalResponse: (() => {}) as ChatSessionController["addToolApprovalResponse"],
    ensureSession: async () => null,
    error,
    errorRaw: error,
    clearError: () => setError(null),
    tokenCounts: { input: 0, output: 0, total: 0, cached: 0 } as ChatSessionController["tokenCounts"],
    maxInputLength: GUEST_MAX_INPUT,
    modelOverride: null,
    setModelOverride: () => {},
    disabledTools: [],
    toggleTool: () => {},
    enableAll: () => {},
    disableAll: () => {},
    preApprovedTools: [],
    approveToolForChat: () => {},
    revokePreApprovedTool: () => {},
    sessionItems: null,
    addSessionItems: async () => {},
    removeSessionItem: async () => {},
    replaceSessionItems: async () => {},
    fileItems: null,
    addFileItem: () => {},
    removeFileItem: () => {},
    suggestions: [],
    filesPanelOpen: false,
    setFilesPanelOpen: async () => {},
    sessionFilesCount: null,
    budgetExceeded: false,
    managedContextEnabled: false,
    contextWindow: null,
    contextOccupancy: 0,
    contextState: "ok" as ChatSessionController["contextState"],
    compacting: false,
    compactConversation: async () => false,
  } satisfies ChatSessionController;

  // clearConversation is not part of the controller interface — return it
  // alongside (see adjustment rule 3 below and PublicChatScreen).
  return { controller, clearConversation };
}
```

Adjustment rules while implementing: (1) every literal like `"ok"` and every zeroed struct MUST be checked against the real types in `hooks.ts` — use the type system, not this listing, as the source of truth; (2) if `useChat`'s option names differ in the repo's AI SDK version (e.g. `initialMessages` vs `messages`), mirror `hooks.ts`; (3) change the hook's return type to `{ controller: ChatSessionController; clearConversation: () => void }` — the screen's clear button calls `clearConversation`, never a bare `setMessages([])`; (4) `suggestions`: check where `hooks.ts` populates `controller.suggestions` — if it derives from stream data parts, mirror that so guest chat keeps follow-up suggestions (spec §5.2); if it requires an authenticated REST call, leave `[]` for anonymous mode and populate only in authenticated mode.

- [ ] **Step 6: The screen**

Create `app/public/agents/[id]/components/public-chat-screen.tsx`. Read `app/(application)/chat/components/session-screen.tsx` first and mirror its DOM arrangement around `MessageColumn`/`Composer` (scroll container classes matter). Structure:

```tsx
"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Eraser, LogOut, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MessageColumn } from "@/app/(application)/chat/components/message-column";
import { Composer } from "@/app/(application)/chat/components/composer";
import type { Agent } from "@/types/models/agent";
import type { PublicAgentMeta } from "@/lib/api/public-agents";
import { usePublicChatSession } from "./use-public-chat-session";

/** Minimal Agent cast: only fields the chat components actually read. */
function toAgent(meta: PublicAgentMeta): Agent {
  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    image: meta.image ?? undefined,
    welcomemessage: meta.welcomemessage,
    slug: meta.slug,
  } as unknown as Agent;
}

export function PublicChatScreen({
  meta,
  mode,
  userId,
}: {
  meta: PublicAgentMeta;
  mode: "anonymous" | "authenticated";
  userId?: string | number;
}) {
  const t = useTranslations("publicAgents.chat");
  const agent = React.useMemo(() => toAgent(meta), [meta]);
  const { controller, clearConversation } = usePublicChatSession({ agent, mode, userId });

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
        {agent.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agent.image} alt="" className="size-7 rounded-full object-cover" />
        ) : null}
        <p className="min-w-0 truncate text-sm font-medium">{agent.name}</p>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearConversation}
            aria-label={t("clear")}
          >
            <Eraser className="size-4" />
            <span className="hidden sm:inline">{t("clear")}</span>
          </Button>
          {mode === "authenticated" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: `/public/agents/${meta.id}` })}
              aria-label={t("signOut")}
            >
              <LogOut className="size-4" />
            </Button>
          )}
        </div>
      </header>
      <div className="flex min-h-0 grow flex-col">
        <MessageColumn controller={controller} />
        <Composer controller={controller} />
      </div>
    </div>
  );
}
```

(The `Plus` import is for the authenticated-mode "new chat" button added in Task 11 — remove it if lint complains before then.)

- [ ] **Step 7: Wire into the gate page**

In `app/public/agents/[id]/page.tsx`, replace both placeholders:

```tsx
  if (decision === "chat-authenticated") {
    const user = await serverSideAuthCheck();
    if (!user) redirect(`/public/agents/${encodeURIComponent(id)}/auth`);
    return <PublicChatScreen meta={meta} mode="authenticated" userId={(user as any).id} />;
  }

  return <PublicChatScreen meta={meta} mode="anonymous" />;
```

with the import `import { PublicChatScreen } from "./components/public-chat-screen";`

- [ ] **Step 8: End-to-end verification (public + password modes)**

`npm run dev` + dev backend: open a public-mode agent → welcome message renders, send a message → streamed reply; refresh → transcript restored from localStorage; clear → empty; 11 rapid messages → rate-limit notice. Password mode: gate → chat works identically.

- [ ] **Step 9: Run all unit tests + typecheck, then commit**

Run: `npm test; npx tsc --noEmit`
Expected: no NEW failures.

```bash
git add lib/public-agents "app/public/agents/[id]"
git commit -m "feat(public-agents): anonymous guest chat with browser transcripts"
```

---

### Task 11: Authenticated public chat — sessions + history

**Files:**
- Create: `app/public/agents/[id]/components/public-apollo-provider.tsx`
- Create: `app/public/agents/[id]/components/public-history.tsx`
- Modify: `app/public/agents/[id]/components/use-public-chat-session.ts`
- Modify: `app/public/agents/[id]/components/public-chat-screen.tsx`

**Interfaces:**
- Consumes: Apollo client factory pattern from `app/(application)/authenticated.tsx` (copy the `React.useMemo` client block verbatim, uri = `${config.backend}/graphql` — confirm the exact `uri` construction in authenticated.tsx and mirror it); `getToken` from `lib/api/client`; `CREATE_AGENT_SESSION`, `GET_AGENT_SESSIONS`, `GET_AGENT_MESSAGES` from `app/(application)/chat/queries.ts`; `SessionProvider` from `next-auth/react` (getToken → getSession needs it).
- Produces: authenticated mode gets lazy server-side sessions, a history dropdown, and resume.

- [ ] **Step 1: Public Apollo + session provider wrapper**

Create `app/public/agents/[id]/components/public-apollo-provider.tsx`:

```tsx
"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";
import {
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  HttpLink,
  InMemoryCache,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";

import { ConfigContext } from "@/components/shell/config-context";
import { getToken } from "@/lib/api/client";

/** Minimal Apollo setup for logged-in external users on public pages —
 *  mirrors app/(application)/authenticated.tsx without the app shell. */
export function PublicApolloProvider({ children }: { children: React.ReactNode }) {
  const config = React.useContext(ConfigContext);
  const uri = `${config?.backend}/graphql`; // confirm against authenticated.tsx

  const client = React.useMemo(() => {
    const basic = setContext(() => ({
      headers: { Accept: "charset=utf-8" },
    }));
    const authLink = setContext(async () => {
      const token = await getToken();
      return { headers: { Authorization: `Bearer ${token}` } };
    });
    const link = ApolloLink.from([basic, authLink, new HttpLink({ uri })]);
    return new ApolloClient({
      uri,
      cache: new InMemoryCache({ addTypename: false }),
      link,
      defaultOptions: {
        watchQuery: { fetchPolicy: "no-cache", errorPolicy: "all" },
        query: { fetchPolicy: "no-cache", errorPolicy: "all" },
      },
    });
  }, [uri]);

  return (
    <SessionProvider>
      <ApolloProvider client={client}>{children}</ApolloProvider>
    </SessionProvider>
  );
}
```

- [ ] **Step 2: Extend the hook for authenticated mode**

In `use-public-chat-session.ts`, for `mode === "authenticated"`:

- Import `useMutation` from `@apollo/client` and `CREATE_AGENT_SESSION` from `@/app/(application)/chat/queries`.
- Add `const [currentSession, setCurrentSession] = React.useState<{ id: string } | null>(null);` plus a `currentSessionRef` kept in sync (mirror the ref pattern in chat/hooks.ts — the transport may read before re-render).
- Implement `ensureSession`:

```ts
  const [createAgentSession] = useMutation(CREATE_AGENT_SESSION);

  const ensureSession = React.useCallback(async () => {
    if (mode !== "authenticated") return null;
    if (currentSessionRef.current) return currentSessionRef.current as any;
    const result = await createAgentSession({
      variables: {
        agent: agent.id,
        user: userId,
        title: t("newChat"),
        rights_mode: "private",
        RBAC: { users: [], roles: [] },
      },
    });
    const item = result.data?.agent_sessionsCreateOne?.item ?? null;
    if (item) {
      currentSessionRef.current = item;
      setCurrentSession(item);
    }
    return item;
  }, [agent.id, createAgentSession, mode, t, userId]);
```

- In `prepareSendMessagesRequest`, branch on mode: authenticated → `await ensureSession()` first, then `body: { ...body, message: messages[messages.length - 1], session: sessionId }` and `headers: { Stream: "true", Session: sessionId }` (the proxy adds Authorization). Anonymous → unchanged full-history body.
- Skip the localStorage effect in authenticated mode (server persistence).
- Expose `startNewSession()` (reset messages + null the session ref) and `resumeSession(session, messages)` for the history component.

- [ ] **Step 3: History dropdown**

Create `app/public/agents/[id]/components/public-history.tsx` — a small popover/dropdown listing the user's sessions for this agent. **Read `app/(application)/chat/components/history-rail.tsx` first and copy its `GET_AGENT_SESSIONS` variables shape verbatim** (filters format is defined there), changing only the agent id source. On select: `useQuery(GET_AGENT_MESSAGES, { variables: /* copy from the session page loader or history rail */ })`, map row `content` to `UIMessage` exactly the way the internal session page does (read `app/(application)/chat/[agent]/[session]/page.tsx` for the mapping), then call `resumeSession(session, messages)`. Render with shadcn `DropdownMenu`, label `t("history")`, empty state `t("noSessions")`.

- [ ] **Step 4: Wire into the screen**

In `public-chat-screen.tsx`, when `mode === "authenticated"`:
- wrap the content in `<PublicApolloProvider>` (in the gate page or the screen root — screen root is simpler: conditionally wrap),
- add the "new chat" button (`Plus` icon, calls `startNewSession`),
- add `<PublicHistory ... />` next to it.

- [ ] **Step 5: End-to-end verification (login-mode agent)**

As an external user: chat → a session row appears in `agent_sessions` (owned by the user); reload → history dropdown lists it; resume → messages load; new chat → separate session. As an internal user: same flow works.

- [ ] **Step 6: Typecheck + tests + commit**

Run: `npm test; npx tsc --noEmit`
Expected: no NEW failures.

```bash
git add "app/public/agents/[id]/components"
git commit -m "feat(public-agents): persistent sessions and history for logged-in guests"
```

---

### Task 12: Agent editor — "Guest access" section

**Files:**
- Modify: `app/(application)/agents/edit/[id]/queries.ts` (AGENT_EDITOR_FIELDS + UPDATE_AGENT_EDITOR)
- Modify: `app/(application)/agents/edit/[id]/hooks.ts` (staged state)
- Modify: `app/(application)/agents/edit/[id]/components/editor-view.tsx` (section registration)
- Create: `app/(application)/agents/edit/[id]/sections/guest-access.tsx`
- Modify: `messages/en.json`, `messages/de.json` (`agents.editor.*` additions)

**Interfaces:**
- Consumes: backend GraphQL guest fields (backend Task 4); `BudgetEditor` from `components/budget-editor.tsx` (props: `{ entityType: "agent", label, mode: "single", entityId, initial, onDone, onCancel, hideRemove?, hideCurrentStatus? }`); `BudgetBar` from `components/budget-bar.tsx`; `UppyDashboard`/`FileDataCard` from `components/primitives/file-picker.tsx`; `UserContext` (mirror the import used in `app/(application)/chat/hooks.ts`); `ConfigContext.public_auth`.
- Produces: `editor.guest: GuestAccessState` + `editor.setGuest` on the `useAgentEditor` return; the section UI; the save round-trip.

- [ ] **Step 1: GraphQL additions**

In `queries.ts`:

(a) Add to `AGENT_EDITOR_FIELDS` (after `active`):

```
  guest_access
  guest_auth_mode
  guest_has_password
  guest_cover_image
  budget
```

(b) In `UPDATE_AGENT_EDITOR`, add to the variable declarations:

```
    $guest_access: Boolean
    $guest_auth_mode: String
    $guest_password: String
    $guest_cover_image: String
```

to the `input:` block:

```
        guest_access: $guest_access
        guest_auth_mode: $guest_auth_mode
        guest_password: $guest_password
        guest_cover_image: $guest_cover_image
```

and to the returned `item { ... }` selection:

```
        guest_access
        guest_auth_mode
        guest_has_password
        guest_cover_image
```

- [ ] **Step 2: Staged state in `hooks.ts`**

(a) Type + default near the other defaults:

```ts
export interface GuestAccessState {
  enabled: boolean;
  authMode: "public" | "password" | "regular";
  password: string; // plaintext to set on next save; "" = keep existing
  hasPassword: boolean;
  coverImage: string; // S3 key or ""
}

const defaultGuest = (agent: Agent): GuestAccessState => ({
  enabled: !!(agent as any).guest_access,
  authMode: ((agent as any).guest_auth_mode as GuestAccessState["authMode"]) || "regular",
  password: "",
  hasPassword: !!(agent as any).guest_has_password,
  coverImage: (agent as any).guest_cover_image ?? "",
});
```

(b) State (with the other staged state): `const [guest, setGuest] = React.useState<GuestAccessState>(() => defaultGuest(agent));`

(c) Snapshot: add `guest: JSON.stringify(defaultGuest(agent)),` to `initialSnapshot.current`; add `JSON.stringify(guest) !== snapshot.guest ||` to `stagedDirty`.

(d) In `save()` variables:

```ts
      guest_access: guest.enabled,
      guest_auth_mode: guest.authMode,
      guest_password: guest.password.length > 0 ? guest.password : null,
      guest_cover_image: guest.coverImage || null,
```

(e) In the post-save re-snapshot, first update local state so the plaintext never lingers:

```ts
      const savedGuest: GuestAccessState = {
        ...guest,
        password: "",
        hasPassword:
          guest.authMode === "password"
            ? guest.password.length > 0 || guest.hasPassword
            : false,
      };
      setGuest(savedGuest);
```

and snapshot `guest: JSON.stringify(savedGuest),`. Add `guest` to the `save` callback's dependency array.

(f) In `discard()`: `setGuest(defaultGuest(agent));`

(g) Expose on the hook's return object: `guest, setGuest,`

- [ ] **Step 3: Register the section**

In `editor-view.tsx`: add `"guest-access"` to `ALL_SECTION_IDS` after `"access"`; render `<GuestAccessSection {...sectionProps} />` after `<AccessSection {...sectionProps} />`; import it.

- [ ] **Step 4: The section component**

Create `sections/guest-access.tsx` (uses the shared `EditorSectionProps`; mirror the Access section's structure):

```tsx
"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { BudgetEditor } from "@/components/budget-editor";
import { BudgetBar } from "@/components/budget-bar";
import { UppyDashboard, FileDataCard } from "@/components/primitives/file-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfigContext } from "@/components/shell/config-context";
// UserContext: mirror the exact import path used in app/(application)/chat/hooks.ts
import { UserContext } from "@/app/(application)/authenticated";

import type { EditorSectionProps } from "./types";

export function GuestAccessSection({ agent, editor }: EditorSectionProps) {
  const t = useTranslations("agents");
  const config = React.useContext(ConfigContext);
  const { user } = React.useContext(UserContext);
  const [copied, setCopied] = React.useState(false);
  const [budget, setBudget] = React.useState<any>((agent as any).budget ?? null);
  const [budgetEditing, setBudgetEditing] = React.useState(false);

  const guest = editor.guest;
  const canEditBudget =
    !!user && (user.super_admin || user.role?.budget_management === "write");
  const smtpMissing = !config?.public_auth?.otp_available;
  const publicLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/public/agents/${agent.id}`
      : `/public/agents/${agent.id}`;

  return (
    <section id="guest-access" className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{t("editor.sections.guestAccess")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("editor.guestAccess.description")}
        </p>
      </div>

      <div className="space-y-6 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="guest-access-toggle">
              {t("editor.guestAccess.enableLabel")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("editor.guestAccess.publicListingWarning")}
            </p>
          </div>
          <Switch
            id="guest-access-toggle"
            checked={guest.enabled}
            onCheckedChange={(enabled) => editor.setGuest({ ...guest, enabled })}
          />
        </div>

        {guest.enabled && (
          <>
            <div className="space-y-2">
              <Label>{t("editor.guestAccess.modeLabel")}</Label>
              <RadioGroup
                value={guest.authMode}
                onValueChange={(authMode) =>
                  editor.setGuest({
                    ...guest,
                    authMode: authMode as typeof guest.authMode,
                  })
                }
                className="gap-3"
              >
                {(
                  [
                    ["public", "modePublic", "modePublicHint"],
                    ["password", "modePassword", "modePasswordHint"],
                    ["regular", "modeLogin", "modeLoginHint"],
                  ] as const
                ).map(([value, labelKey, hintKey]) => (
                  <div key={value} className="flex items-start gap-2">
                    <RadioGroupItem value={value} id={`guest-mode-${value}`} />
                    <div>
                      <Label htmlFor={`guest-mode-${value}`}>
                        {t(`editor.guestAccess.${labelKey}`)}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t(`editor.guestAccess.${hintKey}`)}
                      </p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {guest.authMode === "password" && (
              <div className="space-y-2">
                <Label htmlFor="guest-password">
                  {t("editor.guestAccess.passwordLabel")}
                </Label>
                <Input
                  id="guest-password"
                  type="password"
                  value={guest.password}
                  placeholder={t("editor.guestAccess.passwordPlaceholder")}
                  onChange={(e) =>
                    editor.setGuest({ ...guest, password: e.target.value })
                  }
                />
                {guest.hasPassword && !guest.password && (
                  <p className="text-xs text-muted-foreground">
                    {t("editor.guestAccess.passwordSetHint")}
                  </p>
                )}
              </div>
            )}

            {guest.authMode === "regular" && smtpMissing && (
              <Alert>
                <AlertDescription>
                  {t("editor.guestAccess.smtpHint")}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>{t("editor.guestAccess.linkLabel")}</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={publicLink} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(publicLink);
                    setCopied(true);
                    toast.success(t("editor.guestAccess.copied"));
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {t("editor.guestAccess.copy")}
                </Button>
              </div>
            </div>

            {guest.authMode !== "public" ? null : null}
            <div className="space-y-2">
              <Label>{t("editor.guestAccess.coverLabel")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("editor.guestAccess.coverDescription")}
              </p>
              <FileDataCard s3key={guest.coverImage}>
                <UppyDashboard
                  id="agent-guest-cover"
                  global
                  allowedFileTypes={[".jpg", ".jpeg", ".png", ".webp"]}
                  selectionLimit={1}
                  buttonText=""
                  dependencies={[agent.id]}
                  onConfirm={(keys: string[]) => {
                    if (keys.length > 0)
                      editor.setGuest({ ...guest, coverImage: keys[0] });
                  }}
                />
                {guest.coverImage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => editor.setGuest({ ...guest, coverImage: "" })}
                  >
                    {t("editor.guestAccess.coverRemove")}
                  </Button>
                )}
              </FileDataCard>
            </div>

            <div className="space-y-2">
              <Label>{t("editor.guestAccess.budgetTitle")}</Label>
              {!budget?.max_budget && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {t("editor.guestAccess.budgetWarning")}
                  </AlertDescription>
                </Alert>
              )}
              <BudgetBar budget={budget} />
              {canEditBudget ? (
                budgetEditing ? (
                  <BudgetEditor
                    entityType="agent"
                    label={agent.name ?? ""}
                    mode="single"
                    entityId={agent.id}
                    initial={budget}
                    hideCurrentStatus
                    onDone={() => {
                      setBudgetEditing(false);
                      // BudgetEditor saved via REST; refetch the live value.
                      // Simple approach: read it back from the agents API.
                      // (See Step 5 for the refetch helper.)
                    }}
                    onCancel={() => setBudgetEditing(false)}
                  />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBudgetEditing(true)}
                  >
                    {t("editor.guestAccess.budgetEdit")}
                  </Button>
                )
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("editor.guestAccess.budgetNoRights")}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
```

Cleanups while implementing: remove the stray `{guest.authMode !== "public" ? null : null}` line (editing artifact of this listing); verify `Alert`, `RadioGroup`, `Switch` exist under `components/ui/` (add via shadcn if missing); check `BudgetEditor`'s i18n needs (it uses the `budgets` namespace — already present).

- [ ] **Step 5: Budget refetch helper**

In the section, implement `onDone` with a lightweight Apollo query against the editor client (the editor already runs inside ApolloProvider):

```ts
import { gql, useLazyQuery } from "@apollo/client";

const GET_AGENT_BUDGET = gql`
  query AgentBudget($id: ID!) {
    agentById(id: $id) {
      id
      budget
    }
  }
`;
```

`const [refetchBudget] = useLazyQuery(GET_AGENT_BUDGET, { onCompleted: (d) => setBudget(d?.agentById?.budget ?? null) });` and call `refetchBudget({ variables: { id: agent.id } })` in `onDone`.

(Confirm the singular query name — `AGENT_EDITOR_FIELDS` is fetched via `agentById` in `GET_AGENT_EDITOR`; use the same operation name.)

- [ ] **Step 6: i18n keys**

Add to `messages/en.json` under `agents.editor.sections`: `"guestAccess": "Guest access"`, and under `agents.editor`:

```json
    "guestAccess": {
      "description": "Publish this agent to external users at /public/agents.",
      "enableLabel": "Enable guest access",
      "publicListingWarning": "When enabled, this agent's name, description and avatar are publicly listed on the /public/agents page.",
      "modeLabel": "Access mode",
      "modePublic": "Public",
      "modePublicHint": "Anyone with the link can chat. No sign-in.",
      "modePassword": "Password",
      "modePasswordHint": "Visitors must enter a shared password.",
      "modeLogin": "Login",
      "modeLoginHint": "Visitors must sign in or register with their email.",
      "passwordLabel": "Password",
      "passwordPlaceholder": "Enter a password",
      "passwordSetHint": "A password is set. Leave blank to keep it.",
      "linkLabel": "Public link",
      "copy": "Copy",
      "copied": "Link copied",
      "coverLabel": "Login page image",
      "coverDescription": "Shown on the right side of the sign-in page for this agent.",
      "coverRemove": "Remove image",
      "budgetTitle": "Budget",
      "budgetEdit": "Set budget",
      "budgetWarning": "Strongly recommended: set an overall budget for this agent before exposing it publicly.",
      "budgetNoRights": "You don't have budget-management rights. Ask a budget admin to set a budget for this agent.",
      "smtpHint": "Email (SMTP) is not configured — external users won't be able to register. Login mode requires SMTP for sign-up codes."
    }
```

German in `messages/de.json` at the same position:

```json
    "guestAccess": {
      "description": "Diesen Agenten für externe Nutzer unter /public/agents veröffentlichen.",
      "enableLabel": "Gastzugriff aktivieren",
      "publicListingWarning": "Wenn aktiviert, sind Name, Beschreibung und Avatar dieses Agenten öffentlich auf der /public/agents-Seite gelistet.",
      "modeLabel": "Zugriffsmodus",
      "modePublic": "Öffentlich",
      "modePublicHint": "Jeder mit dem Link kann chatten. Keine Anmeldung.",
      "modePassword": "Passwort",
      "modePasswordHint": "Besucher müssen ein gemeinsames Passwort eingeben.",
      "modeLogin": "Login",
      "modeLoginHint": "Besucher müssen sich mit ihrer E-Mail anmelden oder registrieren.",
      "passwordLabel": "Passwort",
      "passwordPlaceholder": "Passwort eingeben",
      "passwordSetHint": "Ein Passwort ist gesetzt. Leer lassen, um es zu behalten.",
      "linkLabel": "Öffentlicher Link",
      "copy": "Kopieren",
      "copied": "Link kopiert",
      "coverLabel": "Bild der Anmeldeseite",
      "coverDescription": "Wird auf der rechten Seite der Anmeldeseite dieses Agenten angezeigt.",
      "coverRemove": "Bild entfernen",
      "budgetTitle": "Budget",
      "budgetEdit": "Budget festlegen",
      "budgetWarning": "Dringend empfohlen: Lege ein Gesamtbudget für diesen Agenten fest, bevor du ihn öffentlich machst.",
      "budgetNoRights": "Du hast keine Budget-Verwaltungsrechte. Bitte einen Budget-Admin, ein Budget für diesen Agenten festzulegen.",
      "smtpHint": "E-Mail (SMTP) ist nicht konfiguriert — externe Nutzer können sich nicht registrieren. Der Login-Modus benötigt SMTP für Registrierungscodes."
    }
```

Also add `"guestAccess": "Gastzugriff"` under the de `agents.editor.sections`.

- [ ] **Step 7: Verify the round-trip**

Run: `npm run check-messages; npx tsc --noEmit`
Then in the dev app: enable guest access on an agent, pick password mode, set a password, upload a cover, save → refetch shows `guest_has_password: true` and the password field empty; `/public/agents` lists the agent; toggle off + save → listing 404s.

- [ ] **Step 8: Commit**

```bash
git add "app/(application)/agents/edit/[id]" messages/en.json messages/de.json
git commit -m "feat(public-agents): guest access section in the agent editor"
```

---

### Task 13: Final verification + UAT checklist

- [ ] **Step 1: Full local gates**

Run: `npm test; npx tsc --noEmit; npm run lint; npm run check-messages`
Expected: no NEW failures vs. the known main baseline (nav-config test, 31 de `variables.*` keys, tsc svg, entity-types lint).

- [ ] **Step 2: Manual UAT checklist (dev backend with the backend plan deployed)**

- [ ] Public mode: anonymous chat, streamed reply, transcript survives refresh, clear works.
- [ ] Password mode: wrong password rejected; right password chats; password rotation in the editor invalidates the old cookie (next load → gate).
- [ ] Login mode: unauthenticated → auth page with the custom cover; registration in the configured `AUTH_MODE`; external user chats; session + history + resume; sign-out returns to the gate.
- [ ] Single guest agent → `/public/agents` redirects straight to it; multiple → grid; zero → empty state.
- [ ] External user visiting `/`, `/chat`, `/settings` → redirected to `/public/agents`.
- [ ] Internal user with `ALLOWED_EMAIL_DOMAINS` set still logs in on the main page; a non-allowlisted NEW email still can't log in there.
- [ ] Rate limit: burst of anonymous messages → friendly notice.
- [ ] Unpublish mid-chat → next message shows the unavailable state.
- [ ] Editor: budget warning shows when public without budget; budget set via section (with rights) reflects in the bar.
- [ ] Both themes (light/dark) and both locales (en/de) on the public pages.

- [ ] **Step 3: Push and hand off**

```bash
git push -u origin feat/public-agents
```

Then use superpowers:finishing-a-development-branch to decide merge/PR.
