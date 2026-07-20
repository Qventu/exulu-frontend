# Public / Guest Agent Access — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add guest-access fields, public REST endpoints, chat-endpoint gating, and rate limiting to the Exulu backend so agents can be published at `/public/agents` with public / password / login access.

**Architecture:** Guest config lives as four new columns on the `agents` table (mirroring `shared_artifacts`). Three unauthenticated REST endpoints expose whitelisted metadata. The existing agent run route gains a guest gate that grants **run-only** access; internal RBAC (`rights_mode`) is untouched. A per-IP in-process rate limiter protects anonymous traffic.

**Tech Stack:** Node/TypeScript, Express 5, Knex (schema sync via `init-exulu-db.ts`), bcryptjs, Jest (`npm test`).

**Repo:** `/Users/daniel.claessen/Desktop/Projects/exulu/backend` — all paths below are relative to this root. Work on a feature branch: `git checkout -b feat/public-agents`.

**Spec:** `exulu/frontend/docs/superpowers/specs/2026-07-16-public-agents-design.md`

## Global Constraints

- `guest_password_hash` must NEVER appear in any GraphQL or REST payload. Only the computed boolean `guest_has_password` is exposed.
- Public REST endpoints return ONLY: `id`, `name`, `description`, `image`, `welcomemessage`, `slug`, `guest_auth_mode`, `guest_has_cover`. Nothing else.
- Guest access grants run-only access — never GraphQL read/write on the agent.
- Password hashing uses the existing `hashSharePassword` / `verifySharePassword` (bcrypt, 10 rounds) from `src/exulu/shared-artifacts.ts`.
- Rate-limit env vars with defaults: `EXULU_GUEST_RATE_PER_MINUTE=10`, `EXULU_GUEST_RATE_PER_HOUR=60`, `EXULU_GUEST_MAX_MESSAGE_CHARS=8000`.
- Every endpoint re-checks `guest_access` per request (unpublishing is immediate).
- Commit messages: `feat(public-agents): <what>` + the Claude co-author trailer.

---

### Task 1: Schema — guest columns on agents + external role seed

**Files:**
- Modify: `src/postgres/core-schema.ts` (the `agentsSchema` fields array)
- Modify: `src/postgres/init-exulu-db.ts` (after the default-role seed block)

**Interfaces:**
- Consumes: existing `ExuluTableDefinition` field syntax; `addMissingFields` auto-adds columns via ALTER TABLE on boot — no migration file needed.
- Produces: DB columns `agents.guest_access` (boolean, default false), `agents.guest_auth_mode` (text, default `'regular'`), `agents.guest_password_hash` (text, nullable), `agents.guest_cover_image` (text, nullable); a seeded `roles` row named `external` with all permission areas null. Later tasks and the frontend plan rely on these exact names.

- [ ] **Step 1: Add the four guest fields to `agentsSchema`**

In `src/postgres/core-schema.ts`, append to the `agentsSchema.fields` array (after the `max_tool_steps` entry):

```ts
    {
      name: "guest_access",
      type: "boolean",
      default: false,
    },
    {
      name: "guest_auth_mode",
      type: "text",
      default: "regular", // 'public' | 'password' | 'regular' (= login)
    },
    {
      // bcrypt hash (hashSharePassword); NEVER exposed via GraphQL/REST —
      // see sanitizeRequestedFields + createExuluContextsTypeDefs filtering.
      name: "guest_password_hash",
      type: "text",
      required: false,
    },
    {
      // S3 key of the custom login-page image shown on the public auth page.
      name: "guest_cover_image",
      type: "text",
      required: false,
    },
```

- [ ] **Step 2: Seed the `external` role**

In `src/postgres/init-exulu-db.ts`, locate the default-role seed block (`if (!existingDefaultRole) { ... }`) and add directly after it, mirroring its query style:

```ts
  const existingExternalRole = await db
    .from("roles")
    .where({ name: "external" })
    .first();
  if (!existingExternalRole) {
    console.log("[EXULU] Creating external role.");
    // All permission areas null: external (self-registered) users can chat
    // with guest-enabled agents but hold no platform rights.
    await db.from("roles").insert({ name: "external" }).returning("id");
  }
```

(If the default-role block reads the existing role differently — e.g. a prior `select` — mirror that exact style instead.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (or only pre-existing errors — compare against `main` before judging).

- [ ] **Step 4: Boot verification (if a local dev DB is configured)**

Start the backend once (`npm run dev` or the project's usual dev command) and look for log lines `[EXULU] Adding missing field 'guest_access' to agents table.` (×4) and `[EXULU] Creating external role.` Stop it afterwards. If no local DB is available, note that and rely on the log check at integration time.

- [ ] **Step 5: Commit**

```bash
git add src/postgres/core-schema.ts src/postgres/init-exulu-db.ts
git commit -m "feat(public-agents): guest access columns on agents + external role seed"
```

---

### Task 2: Guest access decision module (pure, TDD)

**Files:**
- Create: `src/exulu/public-agents.ts`
- Test: `src/exulu/public-agents.test.ts`

**Interfaces:**
- Consumes: `hashSharePassword`, `verifySharePassword` from `src/exulu/shared-artifacts.ts`.
- Produces (used by Tasks 5–6):
  - `publicAgentView(row, slug): PublicAgentView` — the whitelisted projection
  - `evaluateGuestChatAccess(agent, userId, guestPassword): Promise<GuestGate>` — the single chat-gate decision
  - `type GuestGate = { allowed: true; via: "rbac-public" | "guest" } | { allowed: false; status: number; message: string }`

- [ ] **Step 1: Write the failing tests**

Create `src/exulu/public-agents.test.ts`:

```ts
import { hashSharePassword } from "./shared-artifacts";
import { evaluateGuestChatAccess, publicAgentView } from "./public-agents";

describe("publicAgentView", () => {
  test("projects ONLY the whitelisted fields", () => {
    const row = {
      id: "a1",
      name: "Support Bot",
      description: "Helps",
      image: "s3/avatar.png",
      welcomemessage: "Hi!",
      instructions: "SECRET SYSTEM PROMPT",
      model: "gpt-x",
      guest_access: true,
      guest_auth_mode: "password",
      guest_password_hash: "$2a$10$secret",
      guest_cover_image: "s3/cover.jpg",
    } as any;
    const view = publicAgentView(row, "/agents/litellm/run");
    expect(view).toEqual({
      id: "a1",
      name: "Support Bot",
      description: "Helps",
      image: "s3/avatar.png",
      welcomemessage: "Hi!",
      slug: "/agents/litellm/run",
      guest_auth_mode: "password",
      guest_has_cover: true,
    });
    expect(JSON.stringify(view)).not.toContain("SECRET");
    expect(JSON.stringify(view)).not.toContain("$2a$");
  });

  test("null-safe defaults", () => {
    const view = publicAgentView({ id: "a2" } as any, "");
    expect(view).toEqual({
      id: "a2",
      name: "",
      description: "",
      image: null,
      welcomemessage: "",
      slug: "",
      guest_auth_mode: "regular",
      guest_has_cover: false,
    });
  });
});

describe("evaluateGuestChatAccess — anonymous (no userId)", () => {
  test("rights_mode=public stays allowed (legacy behavior)", async () => {
    const gate = await evaluateGuestChatAccess(
      { rights_mode: "public" } as any,
      undefined,
      undefined,
    );
    expect(gate).toEqual({ allowed: true, via: "rbac-public" });
  });

  test("guest_access off → 401", async () => {
    const gate = await evaluateGuestChatAccess(
      { rights_mode: "private", guest_access: false } as any,
      undefined,
      undefined,
    );
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.status).toBe(401);
  });

  test("guest public mode → allowed", async () => {
    const gate = await evaluateGuestChatAccess(
      { rights_mode: "private", guest_access: true, guest_auth_mode: "public" } as any,
      undefined,
      undefined,
    );
    expect(gate).toEqual({ allowed: true, via: "guest" });
  });

  test("guest password mode: correct password allowed, wrong/missing rejected", async () => {
    const hash = await hashSharePassword("hunter2");
    const agent = {
      rights_mode: "private",
      guest_access: true,
      guest_auth_mode: "password",
      guest_password_hash: hash,
    } as any;
    expect(await evaluateGuestChatAccess(agent, undefined, "hunter2")).toEqual({
      allowed: true,
      via: "guest",
    });
    const wrong = await evaluateGuestChatAccess(agent, undefined, "nope");
    expect(wrong.allowed).toBe(false);
    const missing = await evaluateGuestChatAccess(agent, undefined, undefined);
    expect(missing.allowed).toBe(false);
  });

  test("guest regular (login) mode rejects anonymous", async () => {
    const gate = await evaluateGuestChatAccess(
      { rights_mode: "private", guest_access: true, guest_auth_mode: "regular" } as any,
      undefined,
      undefined,
    );
    expect(gate.allowed).toBe(false);
  });
});

describe("evaluateGuestChatAccess — authenticated (userId present)", () => {
  test("any authenticated user allowed when guest_access on (any mode)", async () => {
    for (const mode of ["public", "password", "regular"]) {
      const gate = await evaluateGuestChatAccess(
        { rights_mode: "private", guest_access: true, guest_auth_mode: mode } as any,
        "user-1",
        undefined,
      );
      expect(gate).toEqual({ allowed: true, via: "guest" });
    }
  });

  test("authenticated + guest_access off → not allowed via guest (falls back to RBAC)", async () => {
    const gate = await evaluateGuestChatAccess(
      { rights_mode: "private", guest_access: false } as any,
      "user-1",
      undefined,
    );
    expect(gate.allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/exulu/public-agents.test.ts`
Expected: FAIL — `Cannot find module './public-agents'`.

- [ ] **Step 3: Implement the module**

Create `src/exulu/public-agents.ts`:

```ts
import { verifySharePassword } from "./shared-artifacts";

export type GuestAuthMode = "public" | "password" | "regular";

export interface PublicAgentView {
  id: string;
  name: string;
  description: string;
  image: string | null;
  welcomemessage: string;
  slug: string;
  guest_auth_mode: GuestAuthMode;
  guest_has_cover: boolean;
}

/**
 * The ONLY projection public endpoints may return. Never widen without
 * updating the spec's security section (no instructions/tools/model leak).
 */
export const publicAgentView = (
  row: {
    id: string;
    name?: string | null;
    description?: string | null;
    image?: string | null;
    welcomemessage?: string | null;
    guest_auth_mode?: string | null;
    guest_cover_image?: string | null;
  },
  slug: string,
): PublicAgentView => ({
  id: row.id,
  name: row.name ?? "",
  description: row.description ?? "",
  image: row.image ?? null,
  welcomemessage: row.welcomemessage ?? "",
  slug,
  guest_auth_mode: (row.guest_auth_mode as GuestAuthMode) || "regular",
  guest_has_cover: !!row.guest_cover_image,
});

export type GuestGate =
  | { allowed: true; via: "rbac-public" | "guest" }
  | { allowed: false; status: number; message: string };

/**
 * Single decision for the agent run route (spec §3.4). Run-only: a `true`
 * here must never be used to authorize GraphQL reads/writes.
 * - anonymous: rights_mode=public (legacy) OR guest public OR guest password
 *   with a verifying `x-guest-password`.
 * - authenticated: any user may run a guest-enabled agent regardless of the
 *   agent's internal RBAC. When it returns allowed:false for an authenticated
 *   user the caller falls back to the normal checkRecordAccess path.
 */
export const evaluateGuestChatAccess = async (
  agent: {
    rights_mode?: string | null;
    guest_access?: boolean | null;
    guest_auth_mode?: string | null;
    guest_password_hash?: string | null;
  },
  userId: string | number | undefined,
  guestPassword: string | undefined,
): Promise<GuestGate> => {
  if (!userId && agent.rights_mode === "public") {
    return { allowed: true, via: "rbac-public" };
  }
  if (agent.guest_access) {
    if (userId) return { allowed: true, via: "guest" };
    const mode = (agent.guest_auth_mode as GuestAuthMode) || "regular";
    if (mode === "public") return { allowed: true, via: "guest" };
    if (mode === "password") {
      if (agent.guest_password_hash && guestPassword) {
        const ok = await verifySharePassword(guestPassword, agent.guest_password_hash);
        if (ok) return { allowed: true, via: "guest" };
        return { allowed: false, status: 401, message: "Incorrect password." };
      }
      return { allowed: false, status: 401, message: "Password required." };
    }
    return { allowed: false, status: 401, message: "Authentication required." };
  }
  return { allowed: false, status: 401, message: "Authentication required." };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/exulu/public-agents.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/exulu/public-agents.ts src/exulu/public-agents.test.ts
git commit -m "feat(public-agents): guest chat gate decision + public projection"
```

---

### Task 3: Per-IP guest rate limiter (pure, TDD)

**Files:**
- Create: `src/exulu/guest-rate-limit.ts`
- Test: `src/exulu/guest-rate-limit.test.ts`

**Interfaces:**
- Consumes: nothing (self-contained; modeled on the fixed-window limiter in `src/exulu/email-inbound/webhook.ts`).
- Produces (used by Task 6):
  - `guestRateLimitExceeded(ip: string, now?: number): boolean` — true when over either window
  - `guestMessageTooLong(body: unknown): boolean` — true when any message text part exceeds the char cap
  - `resetGuestRateLimit(): void` — test helper
  - `extractClientIp(req: { headers: Record<string, unknown>; ip?: string; socket?: { remoteAddress?: string } }): string`

- [ ] **Step 1: Write the failing tests**

Create `src/exulu/guest-rate-limit.test.ts`:

```ts
import {
  extractClientIp,
  guestMessageTooLong,
  guestRateLimitExceeded,
  resetGuestRateLimit,
} from "./guest-rate-limit";

describe("guestRateLimitExceeded", () => {
  beforeEach(() => resetGuestRateLimit());

  test("allows up to the per-minute limit, then rejects", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) {
      expect(guestRateLimitExceeded("1.2.3.4", t0 + i)).toBe(false);
    }
    expect(guestRateLimitExceeded("1.2.3.4", t0 + 11)).toBe(true);
  });

  test("windows are per-IP", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) guestRateLimitExceeded("1.1.1.1", t0);
    expect(guestRateLimitExceeded("2.2.2.2", t0)).toBe(false);
  });

  test("minute window resets after 60s", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) guestRateLimitExceeded("1.2.3.4", t0);
    expect(guestRateLimitExceeded("1.2.3.4", t0 + 61_000)).toBe(false);
  });

  test("hourly limit still applies after minute resets", () => {
    let t = 1_000_000;
    // 60 allowed calls spread over 6 minute-windows (10 each).
    for (let w = 0; w < 6; w++) {
      for (let i = 0; i < 10; i++) {
        expect(guestRateLimitExceeded("1.2.3.4", t)).toBe(false);
      }
      t += 61_000;
    }
    // 61st within the hour → hourly limit exceeded.
    expect(guestRateLimitExceeded("1.2.3.4", t)).toBe(true);
  });
});

describe("guestMessageTooLong", () => {
  const part = (text: string) => ({ type: "text", text });

  test("accepts a normal message", () => {
    expect(
      guestMessageTooLong({ message: { parts: [part("hello")] } }),
    ).toBe(false);
  });

  test("rejects an over-cap text part in message", () => {
    expect(
      guestMessageTooLong({ message: { parts: [part("x".repeat(8001))] } }),
    ).toBe(true);
  });

  test("rejects an over-cap part anywhere in messages[]", () => {
    expect(
      guestMessageTooLong({
        messages: [
          { parts: [part("fine")] },
          { parts: [part("y".repeat(9000))] },
        ],
      }),
    ).toBe(true);
  });

  test("null/malformed bodies are not 'too long'", () => {
    expect(guestMessageTooLong(null)).toBe(false);
    expect(guestMessageTooLong({})).toBe(false);
  });
});

describe("extractClientIp", () => {
  test("prefers first x-forwarded-for entry", () => {
    expect(
      extractClientIp({ headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" } }),
    ).toBe("9.9.9.9");
  });
  test("falls back to req.ip then socket", () => {
    expect(extractClientIp({ headers: {}, ip: "5.5.5.5" })).toBe("5.5.5.5");
    expect(
      extractClientIp({ headers: {}, socket: { remoteAddress: "6.6.6.6" } }),
    ).toBe("6.6.6.6");
    expect(extractClientIp({ headers: {} })).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/exulu/guest-rate-limit.test.ts`
Expected: FAIL — `Cannot find module './guest-rate-limit'`.

- [ ] **Step 3: Implement**

Create `src/exulu/guest-rate-limit.ts`:

```ts
/**
 * In-process fixed-window per-IP limiter for anonymous guest chat
 * (spec §3.5). Modeled on the email-webhook limiter; two windows so a
 * burst-then-trickle can't exhaust the hourly budget in one minute.
 * Not distributed — acceptable for the single-process backend; revisit
 * if the backend is ever horizontally scaled.
 */
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

const perMinuteLimit = () =>
  parseInt(process.env.EXULU_GUEST_RATE_PER_MINUTE || "10", 10);
const perHourLimit = () =>
  parseInt(process.env.EXULU_GUEST_RATE_PER_HOUR || "60", 10);
const maxMessageChars = () =>
  parseInt(process.env.EXULU_GUEST_MAX_MESSAGE_CHARS || "8000", 10);

interface WindowState {
  minuteStart: number;
  minuteCount: number;
  hourStart: number;
  hourCount: number;
}

let windows = new Map<string, WindowState>();

export const resetGuestRateLimit = (): void => {
  windows = new Map();
};

export const guestRateLimitExceeded = (
  ip: string,
  now: number = Date.now(),
): boolean => {
  const state = windows.get(ip) ?? {
    minuteStart: now,
    minuteCount: 0,
    hourStart: now,
    hourCount: 0,
  };
  if (now - state.minuteStart >= MINUTE_MS) {
    state.minuteStart = now;
    state.minuteCount = 0;
  }
  if (now - state.hourStart >= HOUR_MS) {
    state.hourStart = now;
    state.hourCount = 0;
  }
  state.minuteCount += 1;
  state.hourCount += 1;
  windows.set(ip, state);
  // Bound memory: drop stale IPs opportunistically once the map grows.
  if (windows.size > 10_000) {
    for (const [key, value] of windows) {
      if (now - value.hourStart >= HOUR_MS) windows.delete(key);
    }
  }
  return state.minuteCount > perMinuteLimit() || state.hourCount > perHourLimit();
};

const partsTooLong = (parts: unknown): boolean =>
  Array.isArray(parts) &&
  parts.some(
    (p: any) =>
      typeof p?.text === "string" && p.text.length > maxMessageChars(),
  );

/** True when any text part in body.message or body.messages exceeds the cap. */
export const guestMessageTooLong = (body: unknown): boolean => {
  const b = body as any;
  if (!b) return false;
  if (b.message && partsTooLong(b.message.parts)) return true;
  if (Array.isArray(b.messages)) {
    return b.messages.some((m: any) => partsTooLong(m?.parts));
  }
  return false;
};

export const extractClientIp = (req: {
  headers: Record<string, unknown>;
  ip?: string;
  socket?: { remoteAddress?: string };
}): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]!.trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/exulu/guest-rate-limit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/exulu/guest-rate-limit.ts src/exulu/guest-rate-limit.test.ts
git commit -m "feat(public-agents): per-IP guest rate limiter and message caps"
```

---

### Task 4: GraphQL — guest fields in agent type/input, password hashing, hash exclusion

**Files:**
- Create: `src/graphql/utilities/agent-guest-fields.ts`
- Test: `src/graphql/utilities/agent-guest-fields.test.ts`
- Modify: `src/graphql/schemas/index.ts` (`createExuluContextsTypeDefs`)
- Modify: `src/graphql/mutations/index.ts` (`UpdateOneById`, and the plain `UpdateOne` if it exists for agents — same conditional block)
- Modify: `src/graphql/resolvers/index.ts` (`sanitizeRequestedFields`)
- Modify: `src/graphql/utilities/sanitize-and-hydrate-fields.ts` (`finalizeRequestedFields`, agent branch)

**Interfaces:**
- Consumes: `hashSharePassword` from `src/exulu/shared-artifacts.ts`; Task 1's columns.
- Produces: GraphQL agent type gains `guest_access: Boolean`, `guest_auth_mode: String`, `guest_cover_image: String`, `guest_has_password: Boolean` (computed); agent input gains `guest_access`, `guest_auth_mode`, `guest_cover_image`, `guest_password: String` (plaintext in, hashed server-side); `guest_password_hash` is absent from both. Exported helper: `applyAgentGuestFieldTransforms(input: Record<string, any>): Promise<Record<string, any>>`.

- [ ] **Step 1: Write the failing tests for the mutation transform**

Create `src/graphql/utilities/agent-guest-fields.test.ts`:

```ts
import { verifySharePassword } from "../../exulu/shared-artifacts";
import { applyAgentGuestFieldTransforms } from "./agent-guest-fields";

describe("applyAgentGuestFieldTransforms", () => {
  test("hashes guest_password into guest_password_hash and strips the plaintext", async () => {
    const out = await applyAgentGuestFieldTransforms({
      name: "x",
      guest_password: "hunter2",
      guest_auth_mode: "password",
    });
    expect(out.guest_password).toBeUndefined();
    expect(typeof out.guest_password_hash).toBe("string");
    expect(await verifySharePassword("hunter2", out.guest_password_hash)).toBe(true);
  });

  test("empty guest_password is stripped without touching the stored hash", async () => {
    const out = await applyAgentGuestFieldTransforms({ guest_password: "" });
    expect(out.guest_password).toBeUndefined();
    expect(out.guest_password_hash).toBeUndefined();
  });

  test("switching guest_auth_mode away from password clears the hash", async () => {
    const out = await applyAgentGuestFieldTransforms({ guest_auth_mode: "public" });
    expect(out.guest_password_hash).toBeNull();
    const out2 = await applyAgentGuestFieldTransforms({ guest_auth_mode: "regular" });
    expect(out2.guest_password_hash).toBeNull();
  });

  test("a client-supplied guest_password_hash is always discarded", async () => {
    const out = await applyAgentGuestFieldTransforms({
      guest_password_hash: "$2a$10$attacker",
      guest_auth_mode: "password",
      guest_password: "real",
    });
    expect(await verifySharePassword("real", out.guest_password_hash)).toBe(true);
  });

  test("unrelated input passes through untouched", async () => {
    const out = await applyAgentGuestFieldTransforms({ name: "y", active: true });
    expect(out).toEqual({ name: "y", active: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/graphql/utilities/agent-guest-fields.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the transform helper**

Create `src/graphql/utilities/agent-guest-fields.ts`:

```ts
import { hashSharePassword } from "../../exulu/shared-artifacts";

/**
 * Normalizes guest fields on an agent mutation input (spec §3.2):
 * - `guest_password` (plaintext, input-only) → bcrypt `guest_password_hash`
 * - client-supplied `guest_password_hash` is discarded (defense in depth;
 *   the field is not in the GraphQL input type, but the generic mutation
 *   spreads input into the UPDATE, so strip it here too)
 * - setting `guest_auth_mode` to anything but "password" clears the hash
 * Mutates and returns the same object, matching the generic mutation style.
 */
export const applyAgentGuestFieldTransforms = async (
  input: Record<string, any>,
): Promise<Record<string, any>> => {
  delete input.guest_password_hash;
  if (typeof input.guest_password === "string" && input.guest_password.length > 0) {
    input.guest_password_hash = await hashSharePassword(input.guest_password);
  }
  delete input.guest_password;
  if (
    input.guest_auth_mode !== undefined &&
    input.guest_auth_mode !== "password"
  ) {
    input.guest_password_hash = null;
  }
  return input;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/graphql/utilities/agent-guest-fields.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire into the generic mutations**

In `src/graphql/mutations/index.ts`, in the `${tableNamePlural}UpdateOneById` resolver, directly after the existing user-password special case:

```ts
      if (table.name.singular === "user" && input.password) {
        // ...existing code...
      }
```

add:

```ts
      if (table.name.singular === "agent") {
        input = await applyAgentGuestFieldTransforms(input);
      }
```

Add the import at the top of the file: `import { applyAgentGuestFieldTransforms } from "../utilities/agent-guest-fields";`

Search the same file for other agent-writable mutations (`UpdateOne` without ById, `CreateOne`) — grep for `input.password` occurrences (lines ~482, ~575, ~690 per current layout) and add the same two-line block after each user-password special case, so guest fields are transformed on every path that can write agents.

- [ ] **Step 6: Hide the hash from the GraphQL schema and add computed/input fields**

In `src/graphql/schemas/index.ts`, `createExuluContextsTypeDefs`:

(a) Filter the hash out of the generated **type** fields. Change:

```ts
  let fields = table.fields.map((field) => {
```

to:

```ts
  // guest_password_hash is a DB column but never a GraphQL field (spec §7).
  const graphqlFields = table.fields.filter(
    (field) => field.name !== "guest_password_hash",
  );
  let fields = graphqlFields.map((field) => {
```

(b) In the existing `if (table.name.singular === "agent")` block (the one pushing `providerName`, `slug`, etc.), add:

```ts
    fields.push("  guest_has_password: Boolean");
```

(c) For the **input** definition, apply the same filter and add the plaintext input field. Change:

```ts
  const inputDef = `
  input ${table.name.singular}Input {
  ${table.fields.map((f) => `  ${f.name}: ${mapExuluFieldTypesToGraphqlTypes(f)}`).join("\n")}
  ${rbacInputField}
  }
  `;
```

to:

```ts
  const inputExtra =
    table.name.singular === "agent" ? "  guest_password: String" : "";
  const inputDef = `
  input ${table.name.singular}Input {
  ${graphqlFields.map((f) => `  ${f.name}: ${mapExuluFieldTypesToGraphqlTypes(f)}`).join("\n")}
  ${inputExtra}
  ${rbacInputField}
  }
  `;
```

- [ ] **Step 7: Compute `guest_has_password` in queries**

In `src/graphql/resolvers/index.ts`, `sanitizeRequestedFields`, inside the existing `if (table.name.singular === "agent")` branch (the one calling `removeProviderFields`), add:

```ts
    // guest_has_password is computed from the hash column: swap the computed
    // name for the real column in the SQL selection.
    if (requestedFields.includes("guest_has_password")) {
      requestedFields = requestedFields.filter(
        (field) => field !== "guest_has_password",
      );
      requestedFields.push("guest_password_hash");
    }
```

In `src/graphql/utilities/sanitize-and-hydrate-fields.ts`, `finalizeRequestedFields`, inside the `if (table.name.singular === "agent")` branch (next to the `addProviderFields` call), add:

```ts
      if (requestedFields.includes("guest_has_password")) {
        result.guest_has_password = !!result.guest_password_hash;
      }
      // Never let the hash column reach a payload, requested or not.
      delete result.guest_password_hash;
```

- [ ] **Step 8: Typecheck and run the full graphql-adjacent tests**

Run: `npx tsc --noEmit && npx jest src/graphql`
Expected: typecheck clean (vs. main baseline); tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/graphql/utilities/agent-guest-fields.ts src/graphql/utilities/agent-guest-fields.test.ts src/graphql/schemas/index.ts src/graphql/mutations/index.ts src/graphql/resolvers/index.ts src/graphql/utilities/sanitize-and-hydrate-fields.ts
git commit -m "feat(public-agents): guest fields in agent GraphQL, hashed password, hash never exposed"
```

---

### Task 5: Public REST endpoints — list, meta, cover, verify-password

**Files:**
- Modify: `src/exulu/routes.ts` (add a `registerPublicAgentRoutes` block next to the shared-artifacts endpoints, ~line 5015)

**Interfaces:**
- Consumes: `publicAgentView` (Task 2), `verifySharePassword`, `getS3ObjectBytes` from `src/uppy/index.ts`, `isLiteLLMEnabled` from `@SRC/exulu/litellm/supervisor`, the `providers` array and `config` already in scope inside `createExpressRoutes`, `postgresClient`.
- Produces (consumed by the frontend plan):
  - `GET /public-agents` → `PublicAgentView[]` (guest-enabled + active only)
  - `GET /public-agents/:id/meta` → `PublicAgentView` | 404
  - `GET /public-agents/:id/cover` → image bytes | 404
  - `POST /public-agents/:id/verify-password` `{ password }` → 204 | 401 | 404

- [ ] **Step 1: Add a slug resolver + the four endpoints**

In `src/exulu/routes.ts`, inside `createExpressRoutes`, next to the shared-artifacts endpoints (before `app.use(express.static("public"))`), add. Imports to add at the top of the file: `import { publicAgentView } from "./public-agents";` (plus `verifySharePassword` if not already imported there, and `getS3ObjectBytes` — check existing imports first; shared-artifacts content route already imports both).

```ts
  // ---- Public agents (spec 2026-07-16-public-agents §3.3) ----------------
  // Unauthenticated by design: only whitelisted fields ever leave here, and
  // every handler re-checks guest_access so unpublishing is immediate.

  const resolvePublicAgentSlug = async (
    agentModel: string | null | undefined,
  ): Promise<string> => {
    // Mirrors the computed agent.slug in
    // graphql/utilities/sanitize-and-hydrate-fields.ts (~line 125).
    if (isLiteLLMEnabled()) return "/agents/litellm/run";
    if (!agentModel) return "";
    const { db } = await postgresClient();
    const modelRow = await db.from("models").where({ id: agentModel }).first();
    const provider = modelRow?.provider
      ? providers.find((a) => a.id === modelRow.provider)
      : undefined;
    return (provider?.slug as string) || "";
  };

  const getGuestAgentById = async (id: string) => {
    const { db } = await postgresClient();
    return db
      .from("agents")
      .where({ id, guest_access: true, active: true })
      .first();
  };

  app.get("/public-agents", async (_req: Request, res: Response) => {
    const { db } = await postgresClient();
    const rows = await db
      .from("agents")
      .where({ guest_access: true, active: true })
      .select(
        "id",
        "name",
        "description",
        "image",
        "welcomemessage",
        "model",
        "guest_auth_mode",
        "guest_cover_image",
      );
    const views = await Promise.all(
      rows.map(async (row) =>
        publicAgentView(row, await resolvePublicAgentSlug(row.model)),
      ),
    );
    res.json(views);
  });

  app.get("/public-agents/:id/meta", async (req: Request, res: Response) => {
    const row = await getGuestAgentById(req.params.id ?? "");
    if (!row) {
      res.status(404).json({ detail: "Not found." });
      return;
    }
    res.json(publicAgentView(row, await resolvePublicAgentSlug(row.model)));
  });

  app.get("/public-agents/:id/cover", async (req: Request, res: Response) => {
    const row = await getGuestAgentById(req.params.id ?? "");
    if (!row?.guest_cover_image) {
      res.status(404).json({ detail: "Not found." });
      return;
    }
    let bytes: Buffer;
    try {
      bytes = await getS3ObjectBytes(row.guest_cover_image, config);
    } catch (e: any) {
      if (
        e?.name === "NoSuchKey" ||
        e?.name === "NotFound" ||
        e?.$metadata?.httpStatusCode === 404
      ) {
        res.status(404).json({ detail: "Cover not found." });
        return;
      }
      console.error("[EXULU] public-agent cover read failed", e);
      res.status(500).json({ detail: "Failed to read cover." });
      return;
    }
    const ext = row.guest_cover_image.split(".").pop()?.toLowerCase();
    const contentType =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(bytes);
  });

  app.post(
    "/public-agents/:id/verify-password",
    async (req: Request, res: Response) => {
      const row = await getGuestAgentById(req.params.id ?? "");
      if (!row || row.guest_auth_mode !== "password") {
        res.status(404).json({ detail: "Not found." });
        return;
      }
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (
        !row.guest_password_hash ||
        !(await verifySharePassword(password, row.guest_password_hash))
      ) {
        res.status(401).json({ detail: "Incorrect password." });
        return;
      }
      res.status(204).end();
    },
  );
```

If `isLiteLLMEnabled` is not already imported in `routes.ts`, add `import { isLiteLLMEnabled } from "./litellm/supervisor";` (it is used elsewhere in the file — check first, it likely already exists).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean vs. baseline.

- [ ] **Step 3: Manual verification with a local backend**

With the backend running and at least one agent flagged in the DB
(`UPDATE agents SET guest_access = true, guest_auth_mode = 'public' WHERE id = '<some-id>';`):

```bash
curl -s localhost:9001/public-agents | jq .
# Expected: [ { "id": ..., "name": ..., "slug": "/agents/litellm/run", "guest_auth_mode": "public", "guest_has_cover": false, ... } ]
# and NO instructions/tools/guest_password_hash keys.
curl -s localhost:9001/public-agents/<some-id>/meta | jq .guest_auth_mode
# Expected: "public"
curl -s -o /dev/null -w "%{http_code}" localhost:9001/public-agents/nonexistent/meta
# Expected: 404
```

Then flip the flag off (`UPDATE agents SET guest_access = false ...`) and confirm the meta endpoint returns 404 immediately.

- [ ] **Step 4: Commit**

```bash
git add src/exulu/routes.ts
git commit -m "feat(public-agents): public REST endpoints (list, meta, cover, verify-password)"
```

---

### Task 6: Chat run-route guest gating + rate limiting

**Files:**
- Modify: `src/exulu/routes.ts` — inside `registerAgentRunRoute` (~lines 874–898)

**Interfaces:**
- Consumes: `evaluateGuestChatAccess` (Task 2), `guestRateLimitExceeded`, `guestMessageTooLong`, `extractClientIp` (Task 3).
- Produces: `POST {slug}/:instance` honors guest modes: anonymous allowed for guest public / verified `x-guest-password`; any authenticated user allowed when `guest_access=true`; 429/413 for over-limit anonymous traffic. Existing behavior for non-guest agents unchanged.

- [ ] **Step 1: Replace the auth + agent-access block**

In `registerAgentRunRoute` (currently ~line 874), the existing code is:

```ts
      console.log("[EXULU] agent.rights_mode", agent.rights_mode);
      const authenticationResult = await requestValidators.authenticate(req);
      if (!authenticationResult.user?.id && agent.rights_mode !== "public") {
        res
          .status(authenticationResult.code || 500)
          .json({ detail: `${authenticationResult.message}` });
        return;
      }

      const user = authenticationResult.user;

      // API key scope check — early reject for agents-scoped keys with a clear message.
      const scopeCheck = checkApiKeyScope(user, instance);
      if (!scopeCheck.allowed) {
        res.status(scopeCheck.code).json({ detail: scopeCheck.reason });
        return;
      }

      const hasAccessToAgent = await checkRecordAccess(agent, "read", user);

      if (!hasAccessToAgent) {
        res.status(401).json({
          message: "You don't have access to this agent.",
        });
        return;
      }
```

Replace it with:

```ts
      console.log("[EXULU] agent.rights_mode", agent.rights_mode);
      const authenticationResult = await requestValidators.authenticate(req);
      const user = authenticationResult.user;

      // Guest access (spec §3.4): run-only gate. Covers legacy
      // rights_mode=public for anonymous callers and all guest_access modes.
      const guestGate = await evaluateGuestChatAccess(
        agent,
        user?.id,
        req.headers["x-guest-password"] as string | undefined,
      );

      if (!user?.id && !guestGate.allowed) {
        res
          .status(guestGate.status)
          .json({ detail: guestGate.message });
        return;
      }

      if (!user?.id) {
        // Anonymous guest traffic: per-IP rate limits + message caps (§3.5).
        const ip = extractClientIp(req as any);
        if (guestRateLimitExceeded(ip)) {
          res.status(429).json({ detail: "Too many requests. Try again later." });
          return;
        }
        if (guestMessageTooLong(req.body)) {
          res.status(413).json({ detail: "Message too long." });
          return;
        }
      }

      // API key scope check — early reject for agents-scoped keys with a clear message.
      const scopeCheck = checkApiKeyScope(user, instance);
      if (!scopeCheck.allowed) {
        res.status(scopeCheck.code).json({ detail: scopeCheck.reason });
        return;
      }

      const hasAccessToAgent =
        guestGate.allowed || (await checkRecordAccess(agent, "read", user));

      if (!hasAccessToAgent) {
        res.status(401).json({
          message: "You don't have access to this agent.",
        });
        return;
      }
```

Add imports at the top of `routes.ts`:

```ts
import { evaluateGuestChatAccess } from "./public-agents";
import {
  extractClientIp,
  guestMessageTooLong,
  guestRateLimitExceeded,
} from "./guest-rate-limit";
```

Notes for the implementer:
- Do NOT touch the session block below (`if (headers.session) { ... }`) — anonymous guests send no session header, and `saveChat` is already gated on `headers.session && user?.id`, so anonymous transcripts are never persisted (spec §3.4).
- `checkApiKeyScope(user, ...)` already tolerates `undefined` user (anonymous public agents work today) — leave it.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean vs. baseline.

- [ ] **Step 3: Manual gating matrix verification (local backend + one guest agent)**

```bash
AG=<agent-id>; SLUG=/agents/litellm/run   # slug from /public-agents/:id/meta
BODY='{"messages":[{"id":"m1","role":"user","parts":[{"type":"text","text":"hi"}]}]}'

# guest public mode → 200 (stream)
curl -s -o /dev/null -w "%{http_code}\n" -X POST "localhost:9001$SLUG/$AG" \
  -H 'Content-Type: application/json' -H 'Stream: true' -d "$BODY"     # 200

# switch to password mode in DB, then:
curl -s -o /dev/null -w "%{http_code}\n" -X POST "localhost:9001$SLUG/$AG" \
  -H 'Content-Type: application/json' -H 'Stream: true' -d "$BODY"     # 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST "localhost:9001$SLUG/$AG" \
  -H 'Content-Type: application/json' -H 'Stream: true' \
  -H 'x-guest-password: <the password>' -d "$BODY"                     # 200

# switch to regular mode: anonymous 401; with a valid Bearer JWT 200.
# guest_access=false + private agent: anonymous 401 (unchanged behavior).
# 11 rapid anonymous requests → the 11th returns 429.
```

- [ ] **Step 4: Run the full backend test suite**

Run: `npm test`
Expected: PASS (compare failures, if any, against a `main` baseline run first — only NEW failures block).

- [ ] **Step 5: Commit**

```bash
git add src/exulu/routes.ts
git commit -m "feat(public-agents): guest gating + rate limits on the agent run route"
```

---

### Task 7: Final backend verification

**Files:** none new.

- [ ] **Step 1: Full test suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: no NEW failures vs. main baseline.

- [ ] **Step 2: Grep for hash leaks**

Run: `grep -rn "guest_password_hash" src/ --include="*.ts" | grep -v test`
Expected: hits only in `core-schema.ts` (column), `agent-guest-fields.ts` (hashing), `schemas/index.ts` (filter), `resolvers/index.ts` (swap), `sanitize-and-hydrate-fields.ts` (delete), `public-agents.ts` (gate input type), `routes.ts` (verify-password). No hit that serializes it into a response.

- [ ] **Step 3: Commit any stragglers and push the branch**

```bash
git push -u origin feat/public-agents
```
