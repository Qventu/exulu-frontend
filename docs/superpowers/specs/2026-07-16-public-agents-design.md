# Public / Guest Agent Access — Design

**Date:** 2026-07-16
**Status:** Approved (brainstorming complete, pending implementation plan)
**Repos affected:** `exulu/frontend` (majority), `exulu/backend`

## 1. Overview

Clients can expose agents they build on the platform to external users. An admin (or any
user with write access to an agent) enables **guest access** in the agent config. The agent
then appears on `<domain>/public/agents`:

- If exactly one agent is guest-enabled, that page goes straight to its chat screen
  (existing chat components, no main nav).
- If multiple agents are guest-enabled, the page shows a selection grid.

Per agent, the admin chooses the access mode — **public**, **password**, or **login** —
mirroring the shared-artifacts model. Login mode supports **self-registration** for
external users (email + password or OTP; no social login). The admin can upload a
**custom image** shown on the right side of that agent's login page.

## 2. Decisions (from design review)

| Topic | Decision |
| --- | --- |
| Architecture | Guest config lives on the `agents` table + public REST endpoints mirroring `shared_artifacts` (Approach A). Internal `rights_mode` is untouched. |
| Guest identity | Self-registered users are **real users** with `type='external'` and a seeded rights-less **external role**. |
| Anonymous sessions | Public/password modes chat **without server-side sessions**; transcript is browser-only (memory + localStorage). Logged-in users get normal persistent sessions. |
| Registration | Only on the public agents auth page; **OTP-verified**; main `/login` unchanged. Requires SMTP config — no unverified-signup fallback. |
| Access modes | All three: `public` / `password` / `regular` (login). |
| Chat scope | Slim chat: message column, composer, welcome message, suggestions, streaming/reasoning. No model override, budget chips, share, or session-files panel. Logged-in users get a compact session history. |
| Agent listing | `/public/agents` listing is public (name, description, avatar of guest-enabled agents). Gates apply per agent. |
| Abuse protection | Per-IP rate limiting + message-length cap on guest traffic; agent budget UI (existing `BudgetEditor`) embedded in agent config with a strong recommendation when public. |
| Auth method | Public auth page follows the platform `AUTH_MODE` (otp vs password), like the main login. |

## 3. Backend design (`exulu/backend`)

### 3.1 Schema changes

New columns on `agents` (in `src/postgres/core-schema.ts`), mirroring `shared_artifacts`:

| Column | Type | Default | Purpose |
| --- | --- | --- | --- |
| `guest_access` | boolean | `false` | Master toggle |
| `guest_auth_mode` | text | `'regular'` | `'public'` \| `'password'` \| `'regular'` |
| `guest_password_hash` | text (nullable) | — | bcrypt hash via existing `hashSharePassword` (`src/exulu/shared-artifacts.ts`) |
| `guest_cover_image` | text (nullable) | — | S3 key of the custom login-page image |

Migration also seeds:

- an **`external` role** (all permission areas null) in the roles table;
- `users.type` accepts `'external'` alongside `'user'` / `'api'`.

### 3.2 GraphQL changes

- `agentsUpdateOneById` accepts `guest_access`, `guest_auth_mode`, `guest_password`
  (plaintext in, hashed server-side into `guest_password_hash`), `guest_cover_image`.
  Setting mode away from `password` clears the hash. Existing `validateWriteAccess`
  governs who can change these.
- Agent queries expose `guest_access`, `guest_auth_mode`, `guest_cover_image`, and a
  computed `guest_has_password: Boolean`. **`guest_password_hash` is never exposed** in
  any GraphQL payload.

### 3.3 Public REST endpoints (unauthenticated)

Following the `/shared-artifacts/:name/meta` pattern in `src/exulu/routes.ts`:

| Endpoint | Behavior |
| --- | --- |
| `GET /public-agents` | Lists guest-enabled agents only. Whitelisted fields: `id`, `name`, `description`, `image` (avatar), `guest_auth_mode`, `guest_has_cover`. Nothing else (no instructions, tools, model, config). |
| `GET /public-agents/:id/meta` | Same whitelisted fields for one agent. `404` when the agent doesn't exist or `guest_access=false`. |
| `GET /public-agents/:id/cover` | Streams the custom login image bytes from S3 (mirrors the public `/cover.jpg` route). `404` when not guest-enabled or no image set. |

Every endpoint re-checks `guest_access` per request, so unpublishing takes effect
immediately.

### 3.4 Chat endpoint gating

Extend `POST /{agent.slug}/{agent.id}` (`src/exulu/routes.ts`, currently allows
anonymous access only when `rights_mode='public'`). Additional access rule when
`guest_access=true`, evaluated per request:

| `guest_auth_mode` | Who may chat |
| --- | --- |
| `public` | Anyone, including unauthenticated |
| `password` | Unauthenticated allowed **iff** `x-guest-password` header verifies against `guest_password_hash` (bcrypt compare, same as artifacts `verifySharePassword`) |
| `regular` | Any **authenticated** user (external or internal), independent of the agent's internal RBAC |

Guest access grants **run-only** access. Reading/editing agent config via GraphQL
remains governed by `rights_mode` / RBAC as today.

**Sessions:** anonymous guests send no session header. The backend skips session
ownership checks and **does not persist messages** for session-less guest requests.
Logged-in external users are ordinary users: lazy session creation and message
persistence work unchanged (`agent_sessions.user` stays NOT NULL).

**Usage tracking:** unchanged agent-tag attribution; the user tag is added only when a
user is authenticated. LiteLLM agent-tag budgets (already enforced) cap guest spend
once configured.

### 3.5 Rate limiting & abuse protection

Applied to guest traffic (anonymous requests under `public`/`password` modes) on the
chat endpoint:

- Per-IP limits: N messages/minute and M messages/hour (configurable via env,
  sensible defaults e.g. 10/min, 60/hour) → `429`.
- Message-length cap and total request payload cap → `413`.
- Applied before any LLM call.

## 4. Auth & registration (frontend next-auth layer)

### 4.1 External users

- Marker: `users.type = 'external'`, role = seeded external role (no platform rights).
- External users authenticate through the same next-auth endpoints and receive normal
  JWTs; backend GraphQL access is naturally limited by their rights-less role and
  creator-scoped access control (their own sessions only).

### 4.2 Registration flow

New Next.js server route **`POST /api/public-auth/ensure-user`** (per-IP rate-limited):

- Creates the user row if missing: `type='external'`, external role, `emailVerified=null`,
  bcrypt-hashed password when provided (password mode). Modeled on the existing Google
  auto-create block in `app/api/auth/[...nextauth]/options.ts`.
- Never modifies existing non-external users (returns success without changes so the
  page can fall through to normal login).

Flows on `/public/agents/[id]/auth` (follows platform `AUTH_MODE`):

- **OTP mode:** email → `ensure-user` → standard `signIn("email")` 6-digit code →
  verified login. Registration and login are one flow; email ownership proven by
  construction. `emailVerified` set on first successful login (existing behavior).
- **Password mode:** signup form (email + password) → `ensure-user` → OTP verification
  via the same EmailProvider → logged in. Subsequent logins: email + password.
- **SMTP required:** registration is only offered when the email server is configured
  (`EMAIL_SERVER_HOST` etc.). Without SMTP the public auth page is login-only and the
  agent config shows a hint. No unverified-signup fallback.
- Rows created but never verified are inert (cannot log in without completing OTP).
  Periodic purge of stale unverified externals: out of scope, noted as future work.

### 4.3 Targeted changes to existing auth behavior

- `signIn` callback: the `ALLOWED_EMAIL_DOMAINS` allowlist check is **skipped for
  `type='external'` users** — it remains a workforce control for internal accounts.
- Google OAuth is not offered on the public auth page.
- Main `/login` is unchanged (no registration there).

### 4.4 Fencing external users out of the internal app

`app/(application)/layout.tsx`: after the server-side auth check, users with
`type='external'` are redirected to `/public/agents`. This closes the routes a
rights-less user can currently reach (`/chat`, `/projects`, `/settings`, `/token`).
An external user logging in via the main `/login` is bounced the same way.

## 5. Frontend routes & public chat

### 5.1 Route group

New `app/public/agents/…` with its own layout: no app shell (like `/artifacts`), but
**with** `ThemeProvider`, `LanguageProvider` (next-intl, cookie locale), and a slim
`ConfigContext` (backend URL, auth mode) — the chat components need these.

| Route | Behavior |
| --- | --- |
| `/public/agents` | Server component. Fetches `GET /public-agents`. 0 agents → friendly empty state; 1 → redirect to `/public/agents/[id]`; >1 → selection grid (avatar, name, description, access-mode badge). |
| `/public/agents/[id]` | Server-gated like the artifact page: `public` → chat; `password` → check `guest_pw_{id}` httpOnly cookie else `PasswordGate` (server action sets the cookie, same pattern as artifacts); `regular` → any authenticated session proceeds, otherwise redirect to `…/auth`. |
| `/public/agents/[id]/auth` | Login/registration page (section 4.2), reusing the existing `AuthShell` two-column layout with the identify/verify state machine from `login.tsx`. Right pane: `GET /public-agents/:id/cover` when set, else the default cover. `callbackUrl` returns to the agent page. |
| `/public/agents/[id]/chat` (route handler) | Same-origin SSE proxy (section 5.3). |

### 5.2 Public chat screen (slim)

New `PublicChatScreen` composing the existing `MessageColumn` + `Composer` +
`useChatSession` controller from `app/(application)/chat/` (these are self-contained;
what they lose is app-shell chrome). Decoupling work:

- Provide minimal `ConfigContext` / user context in the public shell instead of
  `Authenticated`'s AppShell.
- Header: agent avatar + name, new-chat button; for logged-in users a compact session
  history list and sign-out. No `AppNavTrigger`.
- Excluded: model override, budget/usage chips, share, session-files panel,
  file attachments, command palette, feedback dialog.
- Kept: streaming/reasoning display, welcome message, suggestions.

### 5.3 Transport: same-origin SSE proxy

Messages post to the Next.js route handler `/public/agents/[id]/chat`, which:

- re-fetches agent meta and validates `guest_access`;
- attaches credentials server-side: password cookie → `x-guest-password` header,
  or next-auth session JWT → `Authorization: Bearer`;
- pipes the backend SSE stream back to the client.

One choke point; the httpOnly cookie never reaches client JS; the backend URL is not
exposed. The backend still enforces all gating independently (section 3.4).

### 5.4 Client-side sessions

- **Anonymous** (public/password): no server session. Transcript in memory, mirrored to
  `localStorage` per agent (best-effort refresh survival), with a "clear conversation"
  action. No history UI.
- **Logged-in:** lazy session creation via the existing `CREATE_AGENT_SESSION` GraphQL
  mutation (Apollo client instantiated in the public shell with the user's JWT), slim
  session history list, normal message persistence.

### 5.5 Error states

- Agent unpublished mid-conversation → chat post returns 403/404 → friendly
  "this agent is no longer available" screen.
- `429` (rate limit) → inline notice with retry hint.
- Password cookie expired/invalid → back to the password gate.

## 6. Agent config UI (agent editor)

New **"Guest access"** section (tenth section in
`app/(application)/agents/edit/[id]/`, following the staged-state pattern in
`useAgentEditor`, saved through `UPDATE_AGENT_EDITOR` with normal dirty tracking):

- **Toggle** "Enable guest access" + warning copy: name, description and avatar become
  publicly listed on `/public/agents`.
- **Access mode** radio (public / password / login) with plain-language explanations.
  Password mode: password input (blank = keep existing; `guest_has_password` indicator).
- **Public link** display + copy button: `<domain>/public/agents/[id]`.
- **Custom login image**: upload via existing Uppy → S3 file-picker components
  (image MIME types, preview, remove); stores the S3 key in `guest_cover_image`.
  Shown on the auth page and password gate.
- **Budget**: embedded `BudgetEditor` (`components/budget-editor.tsx`,
  `entityType: "agent"`) + `BudgetBar` status. Prominent warning callout when guest
  access is enabled and no `max_budget` is set: *"Strongly recommended: set an overall
  budget for this agent before exposing it publicly."* Budget saves require
  budget-management rights (`PUT /admin/budgets/agent/:id`); users without that right
  see a read-only notice asking a budget admin to configure it.
- SMTP-not-configured hint when mode is `login` and registration would be unavailable.

## 7. Security considerations

- `guest_password_hash` excluded from every GraphQL/REST payload; only
  `guest_has_password` is exposed.
- Public endpoints return whitelisted fields only — no instructions, tools, model or
  other config leak.
- Guest access is run-only; it never widens GraphQL read/write access to the agent.
- Cover endpoint and SSE proxy re-validate `guest_access` per request.
- `ensure-user` route is per-IP rate-limited to prevent user-row flooding; OTP send is
  already capped by next-auth token maxAge (3 min) and the resend cooldown UI.
- External users are fenced out of the internal app at the layout level (section 4.4).
- Domain allowlist stays enforced for internal users; exemption is scoped strictly to
  `type='external'`.

## 8. i18n

All new UI copy (config section, public pages, auth/registration, error states) is
added to both `messages/en.json` and `messages/de.json`.

## 9. Testing

**Backend:**
- Gating matrix: 3 guest modes × {anonymous, wrong/right password, authenticated
  external, authenticated internal} on the chat endpoint.
- Public endpoints: only guest-enabled agents listed; field whitelist enforced; 404 on
  unpublished; no hash leak.
- Rate limiter: 429 on exceed, 413 on oversize payload/message.
- Registration path: external type/role assignment; domain-allowlist exemption for
  externals; allowlist still enforced for internals.

**Frontend:**
- Unit tests (existing patterns) for new pure logic: transcript localStorage store,
  proxy credential selection, gate-mode branching helpers.
- Manual UAT checklist: all three access modes end-to-end; registration in both
  `AUTH_MODE`s; single-agent redirect vs multi-agent grid; custom image upload and
  display; budget warning; external-user fencing redirect; unpublish-mid-chat.

## 10. Out of scope / future work

- Purge job for stale unverified external users.
- Per-agent daily guest token budgets beyond the existing LiteLLM agent budget.
- File attachments for external users.
- Password reset for external accounts (OTP login covers recovery in otp mode;
  password-mode reset is future work).
- Embeddable widget / iframe variant.
- Expiry dates on guest access (the artifact `expires_at` pattern can be added later).
