# Login & Authentication — Review & Design Concept
**Routes:** `/login` (plus the NextAuth surfaces it implies: `/api/auth/signout` confirmation, `/api/auth/error`)  **Primary persona:** P1 End User (the flow is identical for all personas — design for the least technical)  **Secondary:** P2/P3/P4 (same flow; P3 additionally owns the white-label assets this page displays)  **Current state:** a functional but fragile front door — wrong passwords report "unknown error", a failed OTP permanently disables the submit button, Google-denied users land on an unbranded stock NextAuth page, and the entire first impression of an en/de product is hardcoded English.

This is the first screen anyone sees, and for white-label deployments it is the moment the
customer's brand either holds or breaks. The page already supports three config-driven auth
modes (email+password, email OTP, Google OAuth) and full backend-driven theming
(theme variables, logo, favicons, cover image). The redesign's center of gravity is **flow
honesty** — every failure must explain itself inline, in the user's language, inside the
brand — plus a first-class OTP step. Visually it stays what it is: one calm column, one
purple button.

---

## 1. Current state

### Functionality inventory

Numbered contract — nothing on this list may be lost. File references relative to repo root;
unprefixed files live in `app/(authentication)/`.

**Routing, session & gating**

1. `/login` is a server page with `export const dynamic = "force-dynamic"`; a pre-render
   check redirects already-authenticated users to `/dashboard` (`login/page.tsx:5-14`).
2. `serverSideAuthCheck`: `getServerSession` + direct Postgres lookup joining the user's role
   rights (`agents`, `workflows`, `variables`, `users`, `evals`, `budget_management`);
   returns `false` when there is no session **or** no matching `users` row — a valid NextAuth
   session without a DB user still bounces to login (`lib/server-side-auth-check.ts:33-68`).
3. Best-effort budget snapshot attached to the user during the auth check via backend
   `GET /me/budget` (backend-gated by the "show user budget in chat" setting; never throws)
   (`lib/server-side-auth-check.ts:11-31,66`).
4. **Deep-link preservation:** unauthenticated visits to any `(application)` route redirect to
   `/login?destination=<pathname>` (`app/(application)/layout.tsx:33`); login reads
   `destination` (default `'/'`) and pushes there after success — for form sign-in
   (`login/login.tsx:30,89`), Google (`login/login.tsx:100`), and the OTP callback URL
   (`login/login.tsx:37`).
5. NextAuth `pages` config sets only `signIn: "/login"` (`app/api/auth/[...nextauth]/options.ts:157-159`).
   Consequences that are part of today's UX: the sidebar logout routes to
   `/api/auth/signout` and renders NextAuth's **stock signout confirmation page**
   (`components/custom/main-nav.tsx:455-462,580-585`), and full-redirect errors (e.g. Google
   sign-in denied) render the **stock `/api/auth/error` page**.
6. Session: JWT strategy; on every JWT callback a custom HS256 backend JWT with **365-day
   expiry** is minted and exposed on `session.user.jwt` for API calls
   (`options.ts:13-28,161-166,313-336`).

**Auth modes & providers (config-driven)**

7. `AUTH_MODE` env → `ConfigContext.auth_mode` selects the form mode: `"otp"` = email-code
   flow; anything else **including unset** = email+password credentials
   (`login/login.tsx:59-96`; `(authentication)/layout.tsx:13-17`; type
   `components/config-context.tsx:5-16`).
8. Credentials provider: case-insensitive email lookup, bcrypt compare (iterates all matching
   rows), stamps `last_used` on success (`options.ts:62-97`).
9. Email OTP provider registered only when `EMAIL_SERVER_HOST` is set: 6-digit numeric code,
   **3-minute expiry**, nodemailer SMTP, branded HTML + plain-text email naming the host
   (`options.ts:100-132,342-391`).
10. Google OAuth provider registered only when `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
    are set, requesting offline access and Google Directory scopes (`options.ts:133-153`);
    the login button renders only when `google_client_id` is present in config
    (`login/login.tsx:223,239`).
11. `signIn` callback: email normalization (trim+lowercase); `ALLOWED_EMAIL_DOMAINS`
    allowlist (always appending `exulu.com` and `qventu.com`); `last_used` and
    `emailVerified` stamping; **unknown users are rejected** for credentials/OTP — there is
    no self-registration (`options.ts:171-247,305`).
12. **Google auto-provisioning:** unknown Google users are created on first sign-in with the
    `"default"` role, type `"user"`, non-super-admin; the Google `accounts` row is upserted
    with refreshed tokens (`options.ts:248-301`). RBAC-relevant: Google sign-in is the one
    path that creates accounts.
13. Dead code marking future capability (keep as inert, do not resurrect silently):
    commented-out Google security-group gating (`options.ts:202-234`) and a commented-out
    "Sign in with Microsoft Teams" button (`login/login.tsx:196-220`).

**Step 1 — identify (the form)**

14. Title "Login" (`text-3xl font-bold`) + subline "Enter your email below to login to your
    account", centered (`login/login.tsx:112-117`).
15. Error alert driven by the `?error=` query param with mapped messages for
    `Configuration` / `AccessDenied` / `Verification` and a `Default` fallback
    (`login/error.tsx:8-29`), rendered above the form in both steps (`login/login.tsx:118`).
16. Email field: `Label` + `Input type="email"`, required, placeholder `m@example.com`
    (`login/login.tsx:159-167`).
17. Password field (`Label` + `Input type="password"`), rendered **only when
    `authMode !== "otp"`**, required (`login/login.tsx:168-182`).
18. Primary submit button, full-width, disabled while submitting, three-pulsing-dot loading
    state (`login/login.tsx:184-194`).
19. Submit handler: `signIn("email" | "credentials", { redirect: false })`; on error →
    `router.replace("/login?error=<err>")`; OTP success → switch to the code step
    (`setSubmittedOTP(true)`); password success → push `destination`
    (`login/login.tsx:61-96`).
20. Google button (outline, Google logo SVG asset `public/assets/google.svg`) →
    `signIn("google", { callbackUrl: destination })`; shares the `submitting` disabled state
    (`login/login.tsx:98-106,222-240`).
21. "Don't have an account? Contact your admin" notice below the form
    (`login/login.tsx:243-245`).

**Step 2 — OTP verification**

22. Six-slot `InputOTP` (shadcn, `input-otp` lib), centered, controlled
    (`login/login.tsx:126-138`).
23. **Auto-submit** when 6 digits are entered (`login/login.tsx:53-57`) plus a manual
    "Submit code" button with the same loading-dots state (`login/login.tsx:143-153`).
24. Helper text "Enter your one-time password." (`login/login.tsx:139-141`).
25. Verification: client `fetch` of `GET ../api/auth/callback/email?email&token&callbackUrl`
    with the email lowercased/trimmed and the destination as callback; success path pushes
    `response.url`; failure path replaces to `/login?error=Verification`
    (`login/login.tsx:32-51`).

**Chrome & white-label (the `(authentication)` layout)**

26. Standalone root layout for the route group: own `<html>`/`<body>`, `ConfigContext`
    provider (BACKEND, GOOGLE_CLIENT_ID, AUTH_MODE), TanStack Query provider, `ThemeProvider`
    (system default, light/dark), `Toaster` (`(authentication)/layout.tsx:12-77`).
27. **White-label theming:** backend `GET /theme` CSS variables injected inline for `:root`
    and `.dark` (`(authentication)/layout.tsx:19,28-43`; `util/api.ts:76-98`); backend-served
    favicons in four sizes (`(authentication)/layout.tsx:24-27`).
28. Footer bar (`h-20`, border-top): theme-aware customer `Logo` (backend
    `logo_light.png`/`logo_dark.png`) + "© 2025"; commented-out Terms & Conditions link
    (`(authentication)/layout.tsx:59-70`; `components/logo.tsx:14-39`).
29. Split-screen brand panel: backend `/cover.jpg` fills the right half at `lg+`, hidden
    below (`login/login.tsx:248-256`).
30. Client config delivery for pre-auth surfaces: `GET /api/config` exposes `backend`,
    `google_client_id`, `auth_mode`, feedback config (`app/api/config/route.ts:19-43`),
    backing client-side `getUris` (`util/api.ts:19-27`).

### UX review

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| U1 | **High** | **Wrong password reports "There was an unknown error."** `CredentialsSignin` (the most common error on this page) and `EmailSignin` are not in the error map, so they fall to `Default`, telling the user to "refresh the page and try again" — actively wrong advice for a typo'd password. | `login/error.tsx:8-15`; `login/login.tsx:75-80` |
| U2 | **High** | **A failed OTP dead-ends the flow.** `handleOTPVerification` sets `submitting=true` and never resets it on any failure path; after `router.replace("/login?error=Verification")` the component stays mounted with the code step visible and the "Submit code" button **permanently disabled with pulsing dots**. There is also no "resend code" or "use a different email" affordance, and the 3-minute expiry is never shown in the UI — the error copy literally instructs users to "refresh the page to request a new one". | `login/login.tsx:32-51` (no `setSubmitting(false)` after line 43); `login/error.tsx:12-13`; `options.ts:121` |
| U3 | **High** | **Always-true URL check ships users to a raw NextAuth URL.** `destination` defaults to `'/'` (`login.tsx:30`), and the success check is `response.url.includes(destination)` — `.includes('/')` is true for *every* URL. With no `?destination` param, an **invalid** code passes the check and the user is `router.push`ed to whatever URL NextAuth redirected the callback fetch to (its error surface), instead of seeing the inline Verification alert. | `login/login.tsx:30,37,45-48` |
| U4 | **High** | **Unbranded stock pages in the auth journey.** `pages.error` and `pages.signOut` are unset, so (a) full-redirect failures — a Google user denied by the domain allowlist (`options.ts:193-200`) — land on NextAuth's default `/api/auth/error` page with no logo, theme, or copy control; (b) every logout passes through the default "Are you sure you want to sign out?" page (`main-nav.tsx:455-462`). The white-label promise (#27-29) breaks exactly at the edges. | `options.ts:157-159`; `components/custom/main-nav.tsx:455-462` |
| U5 | **High** | **The OTP step never says a code was sent.** After submitting an email, the screen silently swaps to six empty boxes; the page header still reads "Enter your email below to login to your account" (it sits outside the conditional), the target address is not shown, and nothing mentions the email or its 3-minute lifetime. | `login/login.tsx:112-117` vs `119-141` |
| U6 | Med | **Zero i18n on the product's first screen.** Every string is hardcoded English in an en/de app; `<html lang="en">` is fixed; no language switcher exists pre-auth (the `LanguageProvider`/next-intl wiring is mounted only in the application layout). A German org's employees meet an English login. | `login/login.tsx` throughout; `(authentication)/layout.tsx:22`; `app/(application)/layout.tsx:17,27,110` |
| U7 | Med | **Password managers and code autofill are broken.** No `autocomplete` attributes anywhere: email lacks `autocomplete="email"`, password lacks `autocomplete="current-password"`, the OTP input lacks `autocomplete="one-time-code"` (killing iOS/Android SMS-and-mail code suggestions); no `autoFocus` on the initial field or the OTP group. | `login/login.tsx:159-182,126-138` |
| U8 | Med | **`error.tsx` is a reserved Next.js filename used as an ordinary component.** Inside `app/(authentication)/login/`, it doubles as the route segment's error boundary; it ignores the `{error, reset}` props, so a genuine render/runtime error in the page renders an unrelated (usually empty) alert with no recovery action. | `login/error.tsx:17`; imported at `login/login.tsx:9,118` |
| U9 | Med | Error alert uses `variant="default"` — visually identical to an info note despite a warning icon; errors have no destructive styling. Plus a typo in user-facing copy: "permission to **sigin** or register". | `login/error.tsx:11,22` |
| U10 | Med | Google button says "**Sign up** with Google" on a sign-*in* page; `handleGoogleSignIn` never sets `submitting=true`, so the button's loading state is unreachable from its own click; and its loading dots use `bg-primary-foreground` — near-invisible on an outline (background-colored) button. | `login/login.tsx:98-106,230-237` |
| U11 | Med | `Logo` selects light/dark assets from `theme` instead of `resolvedTheme`: under the default `"system"` setting, `theme !== "dark"` is always true and **dark-mode users get the light logo** in the footer; nothing renders until next-themes hydrates. | `components/logo.tsx:17-36` |
| U12 | Med | **Pre-auth theme fetch is authenticated by construction.** The auth layout calls `apiConfig.theme()`, which sends `Authorization: Bearer <token>` where the token comes from `getSession()` (a client API) executed server-side — effectively `Bearer undefined` for logged-out visitors. If the backend gates `/theme`, the login page silently falls back to default tokens (`catch → {light:{},dark:{}}`) and the white-label theme vanishes exactly where it matters most. Verify backend behavior. | `(authentication)/layout.tsx:19`; `util/api.ts:30-34,76-98` |
| U13 | Low | Buttons lose their accessible name while loading — content is replaced by three unlabeled pulsing `<span>`s with no `aria-live`/`sr-only` text. | `login/login.tsx:143-153,184-193` |
| U14 | Low | The OTP input group has no label or `aria-label`; the helper sentence below is not associated via `aria-describedby`. | `login/login.tsx:126-141` |
| U15 | Low | Cover image `alt="Image"` (decorative imagery should be `alt=""`); native `<img>` with fixed `width="1920" height="1080"` attributes. | `login/login.tsx:249-255` |
| U16 | Low | "Contact your admin" sits in a bare `<div>` inside a sentence — forces a line break, isn't actionable (no link/mailto), and reads as a dead end. | `login/login.tsx:243-245` |
| U17 | Low | "© 2025" hardcoded in the footer (stale — it is 2026); the Terms & Conditions link is commented out rather than configurable. | `(authentication)/layout.tsx:61-69` |
| U18 | Low | Email is lowercased/trimmed at OTP **verification** but sent raw at initial `signIn("email")` — consistency currently rests on NextAuth's default identifier normalization; the asymmetry is fragile. | `login/login.tsx:70` vs `35` |
| U19 | Low | Dead code paths confuse maintenance: `if (!response)` after `fetch` can never be truthy (`login/login.tsx:41-43`); because `destination` defaults to `'/'`, every `destination ? … : "/dashboard"` fallback is unreachable (`login/login.tsx:37,45,89,100`). | as cited |

### Mobile audit

**Severity: minor** — the page renders and the core flow works at 390 px portrait, but it has
real clipping risks:

- The auth layout's `<body>` is `max-h-screen overflow-y-hidden`
  (`(authentication)/layout.tsx:50`) — **the page cannot scroll, period.** When the on-screen
  keyboard opens (visual viewport ~450 px) the browser cannot scroll the focused field or the
  submit button into view; with an error alert adding height, the primary button and Google
  button can become unreachable. Landscape phones (~390 px height) clip immediately.
- The form column is a fixed `w-[350px]` with no `max-w-full` (`login/login.tsx:111`) — fits
  390 px with 20 px to spare, but overflows on 320–349 px viewports (older devices,
  split-screen, large display zoom).
- Fixed chrome is expensive on small screens: `py-12` (96 px vertical padding,
  `login/login.tsx:110`) plus the `h-20` footer (80 px, `(authentication)/layout.tsx:59`)
  spend 176 px before any content.
- Correct behaviors worth keeping: the cover panel is hidden below `lg`
  (`login/login.tsx:248`), buttons are full-width touch targets, OTP slots are ≥40 px, and
  there are no hover-only affordances.
- P1's mobile job (personas.md: full chat on a phone) starts here — login is the gate to the
  one experience that must be flawless on mobile.

---

## 2. Jobs to be done

**PRIMARY: P1 End User — "Get past this screen and into my work in under ten seconds,
without thinking."** They sign in with whatever method their org configured, on whatever
device they are holding, and they judge the screen against the consumer AI apps
(personas.md: *"zero learning curve, zero intimidation"*).

**P1 End User (primary owner)** — ranked by frequency:
1. Sign in with the org's method (password, emailed code, or Google) — new device, new
   browser, session expiry.
2. Recover from a mistake: typo'd password, expired/mistyped code, wrong Google account —
   without losing context or being told to "refresh the page".
3. Sign in on a phone (gateway to P1's first-class mobile chat job).
4. Land where they were headed — the `?destination` deep link must survive the whole flow
   (#4), including the OTP detour and Google redirect.

**P2 / P3 / P4 (secondary — same flow, different stakes):**
- **P2** hits this page most often in absolute terms (heaviest user) but has zero special
  needs here — speed is everything.
- **P3** owns what this page *displays*: the white-label theme, logo, cover, favicon (#27-29)
  are configured in `/configuration`; P3's job is "the login page carries our brand and
  rejects outsiders correctly" (domain allowlist #11, no self-registration #21, Google
  auto-provisioning #12 — which P3 must be able to reason about).
- **P4** sees this page rarely (365-day JWT, #6) and cares only that auth never blocks API
  work; the signout confirmation and error pages (#5) are the surfaces they trip over.

**Ownership matrix check:** `design/personas.md:174` lists `/login` as primary **"all"**,
secondary "—". That is imprecise rather than wrong: the flow is byte-identical for every
persona, so the page should be **designed for P1** — the least technical, most easily
intimidated visitor — and the other personas are served automatically. This doc designates
P1 as the design owner; recommend updating the matrix row to "P1 (flow identical for all)".

---

## 3. Design concept

**Headline:** A calm, brand-true front door — one centered column that adapts to the
configured auth mode, speaks the user's language, recovers gracefully from every failure
inline (no stock NextAuth surfaces, no dead-end states), and treats the OTP step as a
first-class screen instead of an afterthought.

### Default view (L1)

What anyone sees arriving at `/login` (desktop ≥ `lg`; the split layout is kept — it is the
white-label showcase):

- **Left pane** (50%): a vertically centered column, `w-full max-w-[350px]`:
  1. **Customer logo** (theme-correct via `resolvedTheme`, fixes U11) at the top of the
     column — the brand greets you before the form does (today it hides in the footer).
  2. Heading **"Sign in"** (`text-2xl font-semibold` — on the CLAUDE.md type scale; the
     current `text-3xl` is off-scale) + one mode-adaptive subline (`text-sm
     text-muted-foreground`): password mode → "Enter your email and password."; OTP mode →
     "We'll email you a one-time code."
  3. **Inline error alert** (destructive variant, fixes U9) when `?error=` is present, with
     a complete message map (see ladder #15) — including `CredentialsSignin` → "Incorrect
     email or password." (fixes U1).
  4. **The form** (mode-adaptive, #7): Email (`autocomplete="email"`, `autoFocus`) and — in
     password mode — Password (`autocomplete="current-password"`) (fixes U7). One
     full-width primary button: **"Sign in"** / **"Email me a code"** — the only purple on
     the screen.
  5. When Google is configured (#10): a quiet `or` separator + outline button **"Continue
     with Google"** (fixes U10's "Sign up" mislabel).
  6. Footer line (`text-sm text-muted-foreground`, single sentence, fixes U16): "No account?
     Ask your administrator."
- **Right pane** (≥ `lg` only): the backend `/cover.jpg` brand panel, `alt=""` (fixes U15),
  unchanged in role (#29).
- **Page footer** (slimmed, `h-14`): logo removed (now in-column), "© {currentYear}
  {auto}" (fixes U17), and a **minimal language toggle** (EN/DE ghost button writing the
  existing `NEXT_LOCALE` cookie) — the one new control, required to make i18n real pre-auth
  (fixes U6).
- All strings via next-intl (`auth.*` namespace, en + de); `<html lang>` from the locale
  cookie.

**OTP code step (L2 — one step in, replaces the form in place):**
1. Heading swaps to **"Check your email"** with subline "We sent a 6-digit code to
   **{email}**. It expires in 3 minutes." (fixes U5; expiry from #9 finally surfaces).
2. Six-slot `InputOTP`, auto-focused, `autocomplete="one-time-code"`, labeled via
   `aria-label` + `aria-describedby` (fixes U7/U14); auto-submit at 6 digits kept (#23).
3. A failed code shows the inline destructive alert **in this step**, clears the slots,
   re-enables the button, and refocuses — never a URL round-trip, never a stuck spinner
   (fixes U2/U3).
4. Two quiet ghost actions: **"Resend code"** (re-invokes `signIn("email")`, 30 s cooldown
   with countdown) and **"Use a different email"** (back to step 1, email preserved) —
   the missing recovery paths from U2.

**Primary action:** the single purple submit button. Nothing else on the screen is purple.

### Disclosure ladder

Every inventory item mapped. "→" marks a move from its current location. (A login page is
inherently L1-heavy; the ladder's work here is pulling hidden failure states up into view
and pushing stock/raw surfaces out of existence.)

| # | Capability | Level | Where it lives |
|---|------------|-------|----------------|
| 1 | Authenticated-visitor redirect to `/dashboard` | — | unchanged (server precheck, invisible) |
| 2 | Session + role/rights resolution | — | unchanged infrastructure (`serverSideAuthCheck`) |
| 3 | Budget snapshot attach | — | unchanged (consumed by chat, not this page) |
| 4 | `?destination` deep-link round-trip | — | kept across all three methods **and** the OTP detour; dead `"/dashboard"` fallbacks removed (U19); success-check rewritten to not depend on `includes('/')` (U3) |
| 5 | Signout confirmation & error surfaces | L1/L2 | → **branded**: `pages.error: "/login"` routes every full-redirect error into the inline alert (#15); logout switches to client `signOut({ callbackUrl: "/login" })` so the stock confirmation page is no longer in the journey (kept reachable at `/api/auth/signout` for direct hits — nothing deleted) |
| 6 | 365-day backend JWT session | — | unchanged (infrastructure) |
| 7 | `AUTH_MODE`-driven form variants | L1 | mode-adaptive form + subline + button label |
| 8 | Credentials (bcrypt) sign-in | L1 | email + password fields, primary button |
| 9 | OTP issue (6 digits / 3 min / SMTP email) | L1→L2 | "Email me a code" (L1) → code step (L2); expiry now stated on screen |
| 10 | Google OAuth (conditional render) | L1 | "Continue with Google" below an `or` separator, only when configured |
| 11 | Domain allowlist + no self-registration | L1 (feedback) | rejection surfaces as the inline `AccessDenied` message (via `pages.error`, #5) in the user's language |
| 12 | Google auto-provisioning with default role | — | backend behavior unchanged; noted in `/users` & `/configuration` docs as the one account-creating path |
| 13 | Dormant Teams button + Google-groups gating | — | stays commented/inert; Teams slot documented as a future provider in the same "Continue with…" pattern |
| 14 | Title + subline | L1 | column header; copy is step- and mode-aware (fixes U5's stale header) |
| 15 | `?error=` alert with message map | L1 | inline destructive Alert; map **extended** to `CredentialsSignin`, `EmailSignin`, `OAuthSignin`, `OAuthCallback`, `OAuthAccountNotLinked`, `SessionRequired` + existing four; all i18n; "sigin" typo dies (U1/U9) |
| 16 | Email field | L1 | `autocomplete="email"`, `autoFocus`, normalized (trim+lowercase) once on submit (U18) |
| 17 | Password field (mode-gated) | L1 | `autocomplete="current-password"` |
| 18 | Primary submit + loading state | L1 | full-width button; loading = `Loader2` spinner + visible label kept (`sr-only` safe), `aria-busy` (U13) |
| 19 | Submit handler (mode dispatch, error routing) | — | rewritten: state-machine `identify → verify`; `submitting` reset on **every** path (U2); errors render in place without `router.replace` round-trips where possible |
| 20 | Google sign-in + shared disabled state | L1 | outline button; sets its own pending state (U10); spinner token visible on outline background |
| 21 | "No account → admin" notice | L1 | single-sentence footer line under the form (U16) |
| 22 | Six-slot OTP input | L2 | code step; labeled, `one-time-code` autofill (U7/U14) |
| 23 | Auto-submit at 6 digits + manual submit | L2 | kept; manual button remains for SR/keyboard users |
| 24 | OTP helper text | L2 | absorbed into the step's subline ("sent to {email}… expires in 3 minutes") |
| 25 | OTP verification via email-callback GET | L2 | same endpoint, same semantics; response handling fixed (U3) — failure stays in-step with slot reset, resend, and change-email affordances |
| 26 | Standalone auth layout (providers, theme, toaster) | — | kept; + next-intl provider, `lang` from locale cookie, **scrollable body** (see Mobile) |
| 27 | Backend theme variables + favicons | L1 (ambient) | unchanged injection; backend `/theme` must be anonymously readable (U12 — see §4) |
| 28 | Footer logo + copyright | L1 (ambient) | logo → column top; footer keeps © (dynamic year) + language toggle; T&C link becomes config-driven instead of commented out (U17) |
| 29 | Cover-image brand panel ≥ lg | L1 (ambient) | unchanged; `alt=""` (U15) |
| 30 | `/api/config` client config | — | unchanged (infrastructure) |

Nothing is deleted. The only relocations are the logo (footer → column top) and the stock
NextAuth pages (replaced by branded equivalents while the underlying endpoints remain).

### Layout & components

**Why the philosophy §5 primitives don't apply here (written reason, per decision
heuristic 5):** `/login` sits *outside* the app shell — no sidebar, no PageShell/PageHeader/
Toolbar context. It is the one full-bleed brand surface in the product. Instead, it
introduces one small pre-auth primitive (see §4): **AuthShell**.

- **AuthShell (NEW):** the branded pre-auth frame — theme-variable injection, favicons,
  centered column slot (`w-full max-w-[350px] px-4`), optional cover pane (`hidden lg:block`),
  slim footer (`h-14`, © + locale toggle). Reused by `/login`, the error presentation, and
  any future pre-auth surface (signout landing, invite acceptance).
- **Column composition** (top → bottom, `flex flex-col gap-6` — Medium spacing per
  CLAUDE.md): `Logo` (height 32) → heading block (`gap-2`: `text-2xl font-semibold` +
  `text-sm text-muted-foreground`) → `Alert variant="destructive"` (conditional) → form
  (`grid gap-4`; field groups `grid gap-2`: `Label text-sm` + `Input h-10`) → `Button
  size="lg" className="w-full"` → separator row (`Separator` + `text-xs
  text-muted-foreground uppercase` "or") → outline Google `Button` → footer sentence
  (`text-sm text-muted-foreground text-center`).
- **OTP step:** same column skeleton; `InputOTP`/`InputOTPGroup`/`InputOTPSlot` (existing
  `components/ui/input-otp.tsx`), slots `size-10`; ghost `Button`s for Resend (with `30s`
  countdown in `text-xs tabular-nums`) and "Use a different email".
- **shadcn inventory:** `Button` (default, outline, ghost), `Input`, `Label`, `Alert`,
  `Separator`, `InputOTP`. Icons: `Loader2` (spinner), `Languages` (locale toggle),
  lucide stroke-width 1 per CLAUDE.md. No Card — the column floats on `bg-background`
  (philosophy: whitespace over boxes).
- **Color:** exactly one purple element per state (the primary button). Google button is
  neutral outline. Error = destructive tokens only. Both themes verified — all colors come
  from the injected theme variables, which is the point of the page.
- **Accessibility:** `<form>` semantics kept; `aria-busy` on pending buttons with persistent
  visible labels (U13); OTP group `aria-label="One-time code"` + `aria-describedby` to the
  expiry line (U14); error `Alert` gets `role="alert"` so SR users hear failures; focus
  management on step change (heading receives focus); `lang` correct (U6).
- **File hygiene:** the alert component moves out of the reserved `error.tsx` filename
  (U8); a real `error.tsx` boundary (using AuthShell + "Something went wrong / Try again"
  with `reset()`) takes its place.

### Mobile behavior

P1's mobile job starts here — login is the gate to first-class mobile chat.

- **All breakpoints:** the auth layout drops `max-h-screen overflow-y-hidden` for
  `min-h-dvh` with natural scrolling — the keyboard can no longer trap the submit button
  (the mobile-audit fix). Column becomes `w-full max-w-[350px] px-4` (no fixed-width
  overflow at 320 px).
- **< lg (incl. 390 px):** single column, cover pane hidden (unchanged, #29). Vertical
  padding relaxes from `py-12` to `py-8`; footer `h-14` with © and the locale toggle only.
  Buttons full-width `h-10`+; OTP slots `size-10` (44 px-class touch targets with gaps).
  Autofill is the star: `email`/`current-password`/`one-time-code` make most sign-ins
  zero-typing (U7).
- **≥ lg:** split layout with the cover panel, exactly as today; column centered in the
  left half.
- No tables, panels, or toolbars on this page — none of the standard responsive
  transformations apply.

### Motion

Per CLAUDE.md timings; everything honors `prefers-reduced-motion`:

- **Step transition** (form ↔ code step): 300 ms crossfade + 8 px slide — explains that the
  flow advanced, not navigated. The signature moment.
- Error alert: 200 ms fade/slide-in; OTP slot clear on failure: 150 ms.
- Button pending state: label → spinner crossfade 150 ms; hover/focus transitions 150 ms
  `ease-in-out`.
- Resend cooldown countdown: plain text tick, no animation.
- Nothing else animates. (The current three-dot `animate-pulse` pattern is retired with its
  contrast bug, U10/U13.)

---

## 4. Implementation notes

**Files to change**
- `app/(authentication)/login/login.tsx` — rewrite as an `identify → verify` state machine:
  mode-adaptive copy, autocomplete/autoFocus, in-step OTP failure handling with
  `setSubmitting(false)` on all paths (U2), rewritten callback-URL success check (U3),
  resend + change-email affordances, Google pending state (U10), one-time email
  normalization (U18), dead-code removal (U19), full i18n.
- `app/(authentication)/login/error.tsx` — **rename** the alert to
  `app/(authentication)/login/components/auth-error-alert.tsx` (extended message map, U1;
  destructive variant + `role="alert"`, U9; typo fix); add a genuine `error.tsx` boundary
  in its place (U8).
- `app/(authentication)/layout.tsx` — `min-h-dvh` scrollable body (mobile fix); `lang` +
  next-intl provider from the `NEXT_LOCALE` cookie (mirroring
  `app/(application)/layout.tsx:27,110`); dynamic © year; slim footer with locale toggle;
  config-driven T&C link (U17).
- `app/api/auth/[...nextauth]/options.ts` — add `pages.error: "/login"` (NextAuth appends
  `?error=`, feeding the existing alert; fixes U4a). No provider/callback logic changes.
- `components/custom/main-nav.tsx:455-462` — logout switches to client
  `signOut({ callbackUrl: "/login" })` (fixes U4b). *Owned by the navigation/shell
  workstream; listed here as the dependency.*
- `components/logo.tsx` — use `resolvedTheme`; render a stable placeholder pre-hydration
  (U11).
- `util/api.ts:76-98` — `config.theme()` must not send a bogus `Authorization` header for
  anonymous calls (or accept an explicit token param); pairs with the backend check below
  (U12).
- `messages/en.json`, `messages/de.json` — new `auth.*` namespace (titles, sublines, field
  labels, button labels, all error-map entries, OTP step copy, footer strings) (U6).
- **NEW** `components/auth-shell.tsx` — the pre-auth frame (column slot, cover pane, footer,
  locale toggle).
- **NEW** `app/(authentication)/login/components/otp-step.tsx` — code entry step (InputOTP,
  auto-submit, resend cooldown, change-email).

**Backend dependencies**
1. **`GET /theme` must be anonymously readable** (U12) — verify; if it is auth-gated today,
   the login page has been shipping without white-label theming and the backend needs a
   public theme endpoint (or the layout should read theme config from a public config blob).
2. None otherwise — all providers, callbacks, and the email-callback verification endpoint
   are reused unchanged.

**Shared components needed**
- From philosophy §5: none apply (pre-shell surface; reason documented in §3).
- **NEW shared primitives to add to philosophy §5 (or a "pre-auth" appendix):**
  - **AuthShell** — branded pre-auth frame; reused by login, the login error boundary, and
    future pre-auth surfaces (invite acceptance, signout landing).
  - **LocaleSwitcher** — minimal EN/DE toggle writing `NEXT_LOCALE`; needed here and
    reusable in the app shell's Personal area (`design/navigation.md`).

**Scope: M.** The page itself is small (one route, two steps), but the work is
cross-cutting and risk-bearing: a second root layout gains i18n wiring, NextAuth `pages`
config changes affect every error redirect in the app, the logout path changes in the nav,
and the OTP flow's failure handling is effectively rebuilt. Test matrix: AUTH_MODE
(`password`/`otp`/unset) × Google (on/off) × email server (on/off) × en/de × light/dark ×
390/1440 px.

**Dependencies**
- Navigation/shell workstream (`design/navigation.md`): the logout `signOut()` change and
  LocaleSwitcher reuse.
- `/configuration` page doc: owns the white-label assets (theme, logo, cover, favicon) this
  page displays; the public-`/theme` backend decision affects both.
- `design/responsive.md`: no table/panel patterns needed; the `min-h-dvh` scroll rule should
  be recorded there as the pre-auth standard.

**Risks**
- **Auth flows are production-critical** — regressions lock users out. Keep every NextAuth
  call signature identical (`signIn("email"|"credentials"|"google")`, the email-callback GET
  in #25); only the surrounding state handling changes. Stage behind a thorough manual pass
  of the test matrix above.
- `pages.error: "/login"` reroutes **all** NextAuth error redirects (including ones from
  non-login flows like session expiry during OAuth refresh) to the login page — the extended
  message map must cover the full error-code set so nothing degrades to "unknown error".
- Switching logout from the confirmation page to direct `signOut()` removes a deliberate
  step; it uses NextAuth's CSRF-protected POST so it is safe, but if the org wants a
  confirmation, render a branded ConfirmDialog in the nav instead — never the stock page.
- "Resend code" issues a new verification token while the old one may still be live
  (3-minute window, adapter semantics) — acceptable, but the cooldown (30 s) must be
  client-enforced to avoid hammering SMTP; consider server-side rate limiting as a follow-up.
- The in-step OTP failure handling depends on the email-callback GET's redirect URL shapes;
  the implementation must detect failure by *absence of the success destination* (exact-path
  match, not `includes`) so it stays robust if NextAuth changes its error URL.
