# Client Favicon + Installable App Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let clients brand the browser tab and the installed app (Windows taskbar / iOS / Android) by dropping a single `favicon.png` into the same backend-served `public/` folder they already use for `logo_light.png` / `logo_dark.png`.

**Architecture:** Frontend-only. The backend already serves the client's `public/` folder via `express.static("public")`; the frontend layouts link `${BACKEND}/favicon.png` directly (replacing four dead `icon_NxN.png` links), and a new `force-dynamic` route handler serves a web app manifest from the frontend origin (browsers reject cross-origin manifests) whose icon points at the backend favicon. No fallback: a missing file 404s and browsers show their default icon.

**Tech Stack:** Next.js 16 App Router (route handlers, server layouts), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-21-client-favicon-app-icon-design.md`

## Global Constraints

- Env vars are read at **request time**, never baked at build: the package ships prebuilt, so the manifest route needs `export const dynamic = "force-dynamic"` (same pattern as `app/api/config/route.ts`). The four layouts are already request-dynamic.
- The manifest app name comes from `process.env.APP_NAME` with the exact default `"IMP"`.
- Do NOT create `app/manifest.ts` (the Next metadata-route convention) — it evaluates statically at build. Use the explicit route-handler folder `app/manifest.webmanifest/route.ts`; dotted segment folders are proven in this repo (`app/api/skills/install.sh/route.ts`).
- Commitlint runs on commit: subject must be conventional-commit style and must not start sentence-case (e.g. `feat(branding): web app manifest route` is valid, `feat(branding): Web app manifest` is not).
- Known pre-existing baseline failures on main (do not fix, do not let them block): the FE nav-config test and the entity-types lint warning. Only NEW failures are yours.
- Working tree contains unrelated in-progress chat changes — always `git add` explicit paths, never `git add -A` or `git add .`.

---

### Task 1: Web app manifest route

**Files:**
- Create: `app/manifest.webmanifest/route.test.ts`
- Create: `app/manifest.webmanifest/route.ts`

**Interfaces:**
- Consumes: `process.env.BACKEND`, `process.env.APP_NAME` (both optional strings).
- Produces: `GET /manifest.webmanifest` → `application/manifest+json` body `{ name, short_name, start_url: "/", display: "standalone", icons: [{ src: "<BACKEND>/favicon.png", sizes: "512x512", type: "image/png" }] }`. Task 2 links this path from layout `<head>`s as `/manifest.webmanifest`.

- [ ] **Step 1: Write the failing test**

Create `app/manifest.webmanifest/route.test.ts` (mirrors the pattern of `app/api/config/route.test.ts`):

```ts
import { describe, test, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";

describe("/manifest.webmanifest", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("BACKEND", "http://backend.test");
  });

  test("serves the manifest content type", async () => {
    const res = await GET();
    expect(res.headers.get("Content-Type")).toBe("application/manifest+json");
  });

  test("points the icon at the backend favicon", async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.icons).toEqual([
      {
        src: "http://backend.test/favicon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ]);
  });

  test("uses APP_NAME for name and short_name", async () => {
    vi.stubEnv("APP_NAME", "Acme Agents");
    const res = await GET();
    const json = await res.json();
    expect(json.name).toBe("Acme Agents");
    expect(json.short_name).toBe("Acme Agents");
  });

  test("defaults the name to IMP when APP_NAME is unset", async () => {
    vi.stubEnv("APP_NAME", undefined);
    const res = await GET();
    const json = await res.json();
    expect(json.name).toBe("IMP");
    expect(json.short_name).toBe("IMP");
  });

  test("is installable: standalone display and root start_url", async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.display).toBe("standalone");
    expect(json.start_url).toBe("/");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/manifest.webmanifest/route.test.ts`
Expected: FAIL — cannot resolve `./route` (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `app/manifest.webmanifest/route.ts`:

```ts
import { NextResponse } from "next/server";

// Request-time env: the package ships prebuilt, so a static route would
// bake in the empty build-time BACKEND/APP_NAME values.
export const dynamic = "force-dynamic";

// Served from the frontend origin because browsers reject cross-origin
// manifests. The icon inside may point at the backend, same as the logos:
// clients drop favicon.png into the public/ folder their backend serves.
// One 512px icon satisfies Edge/Chrome installability (>=144px), which is
// what produces the Windows taskbar / home-screen icon.
export async function GET() {
  const backend = process.env.BACKEND || "";
  const name = process.env.APP_NAME || "IMP";
  return NextResponse.json(
    {
      name,
      short_name: name,
      start_url: "/",
      display: "standalone",
      icons: [
        {
          src: `${backend}/favicon.png`,
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/manifest.webmanifest/route.test.ts`
Expected: PASS — 5 passed.

- [ ] **Step 5: Commit**

```bash
git add app/manifest.webmanifest/route.ts app/manifest.webmanifest/route.test.ts
git commit -m "feat(branding): web app manifest route with client favicon" -- app/manifest.webmanifest
```

---

### Task 2: Favicon head links in the four layouts

**Files:**
- Modify: `app/(application)/layout.tsx:96-99`
- Modify: `app/(authentication)/layout.tsx:5-6,61-64`
- Modify: `app/public/agents/layout.tsx:51-54`
- Modify: `app/artifacts/layout.tsx:14-19`

**Interfaces:**
- Consumes: `GET /manifest.webmanifest` from Task 1; `${BACKEND}/favicon.png` served by the client's backend (or 404, by design).
- Produces: nothing consumed by later tasks; Task 3 documents this behavior.

- [ ] **Step 1: Replace the four dead icon links in `app/(application)/layout.tsx`**

The file indents with 16 spaces here. Replace exactly:

```tsx
                <link rel="icon" href={process.env.BACKEND + "/icon_16x16.png"} type="image/png" sizes="16x16" />
                <link rel="icon" href={process.env.BACKEND + "/icon_32x32.png"} type="image/png" sizes="32x32" />
                <link rel="icon" href={process.env.BACKEND + "/icon_48x48.png"} type="image/png" sizes="48x48" />
                <link rel="icon" href={process.env.BACKEND + "/icon_512x512.png"} type="image/png" sizes="512x512" />
```

with:

```tsx
                <link rel="icon" href={process.env.BACKEND + "/favicon.png"} type="image/png" />
                <link rel="apple-touch-icon" href={process.env.BACKEND + "/favicon.png"} />
                <link rel="manifest" href="/manifest.webmanifest" />
```

- [ ] **Step 2: Same replacement in `app/(authentication)/layout.tsx` (8-space indent), plus fix its header comment**

Replace:

```tsx
        <link rel="icon" href={process.env.BACKEND + "/icon_16x16.png"} type="image/png" sizes="16x16" />
        <link rel="icon" href={process.env.BACKEND + "/icon_32x32.png"} type="image/png" sizes="32x32" />
        <link rel="icon" href={process.env.BACKEND + "/icon_48x48.png"} type="image/png" sizes="48x48" />
        <link rel="icon" href={process.env.BACKEND + "/icon_512x512.png"} type="image/png" sizes="512x512" />
```

with:

```tsx
        <link rel="icon" href={process.env.BACKEND + "/favicon.png"} type="image/png" />
        <link rel="apple-touch-icon" href={process.env.BACKEND + "/favicon.png"} />
        <link rel="manifest" href="/manifest.webmanifest" />
```

And update the now-stale doc comment at lines 5-6. Replace:

```tsx
 * - White-label theming kept: backend `GET /theme` CSS variables injected for
 *   `:root` + `.dark`, backend favicons in four sizes (ladder #27).
```

with:

```tsx
 * - White-label theming kept: backend `GET /theme` CSS variables injected for
 *   `:root` + `.dark`, single backend favicon.png + manifest (ladder #27).
```

- [ ] **Step 3: Same replacement in `app/public/agents/layout.tsx` (8-space indent)**

Replace:

```tsx
        <link rel="icon" href={process.env.BACKEND + "/icon_16x16.png"} type="image/png" sizes="16x16" />
        <link rel="icon" href={process.env.BACKEND + "/icon_32x32.png"} type="image/png" sizes="32x32" />
        <link rel="icon" href={process.env.BACKEND + "/icon_48x48.png"} type="image/png" sizes="48x48" />
        <link rel="icon" href={process.env.BACKEND + "/icon_512x512.png"} type="image/png" sizes="512x512" />
```

with:

```tsx
        <link rel="icon" href={process.env.BACKEND + "/favicon.png"} type="image/png" />
        <link rel="apple-touch-icon" href={process.env.BACKEND + "/favicon.png"} />
        <link rel="manifest" href="/manifest.webmanifest" />
```

- [ ] **Step 4: Add the favicon (only) to `app/artifacts/layout.tsx`**

Artifact pages are share links, not an install target — favicon link only, no manifest. The env read is request-time because `app/artifacts/[artifact_name]/page.tsx` is `force-dynamic`. Replace:

```tsx
    <html lang="en" suppressHydrationWarning>
      <body className={cn("bg-background font-sans antialiased", fontVariables)}>
        {children}
      </body>
    </html>
```

with:

```tsx
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href={process.env.BACKEND + "/favicon.png"} type="image/png" />
      </head>
      <body className={cn("bg-background font-sans antialiased", fontVariables)}>
        {children}
      </body>
    </html>
```

- [ ] **Step 5: Verify no icon_NxN references remain and types check**

Run: `grep -rn "icon_16x16\|icon_32x32\|icon_48x48\|icon_512x512" app components lib`
Expected: no output.

Run: `npx tsc --noEmit`
Expected: clean (the svg/tsc baseline issues were fixed on main; any error here is new and yours).

- [ ] **Step 6: Commit**

```bash
git add "app/(application)/layout.tsx" "app/(authentication)/layout.tsx" app/public/agents/layout.tsx app/artifacts/layout.tsx
git commit -m "feat(branding): single client favicon.png replaces four-size icon links" -- "app/(application)/layout.tsx" "app/(authentication)/layout.tsx" app/public/agents/layout.tsx app/artifacts/layout.tsx
```

---

### Task 3: Documentation (README + .env.example)

**Files:**
- Modify: `README.md:81-86` (after the `### 🎨 Theming & Customization` bullets)
- Modify: `.env.example` (after the `BACKEND=""` line at line 10)

**Interfaces:**
- Consumes: the behavior shipped in Tasks 1-2 (file names, APP_NAME default `"IMP"`).
- Produces: nothing — docs only.

- [ ] **Step 1: Add a Branding Assets section to `README.md`**

Insert directly after the `### 🎨 Theming & Customization` bullet list (after the `- Import and export theme configurations` line, before `### 🔧 Developer Tools`):

```markdown
### 🏷️ Branding Assets

White-label the app by dropping files into the `public/` folder of the project
where you run the Exulu backend package. The backend serves that folder
statically and the frontend loads the assets from the backend URL:

| File | Used for | Format |
| --- | --- | --- |
| `logo_light.png` | Logo in light mode | PNG |
| `logo_dark.png` | Logo in dark mode | PNG |
| `cover.jpg` | Login screen cover image | JPEG |
| `favicon.png` | Browser tab icon and installed-app icon (Windows taskbar, iOS/Android home screen) | Square PNG, 512×512 recommended, transparent background |

Missing files simply 404 and browsers fall back to their defaults.

To name the installed app (the label under the icon), set the optional
`APP_NAME` environment variable on the frontend. Defaults to `IMP`.
```

- [ ] **Step 2: Add `APP_NAME` to `.env.example`**

Insert directly after the `BACKEND=""` line (line 10):

```bash
APP_NAME="" # Optional: name of the installed app in the web app manifest (label under the icon). Defaults to IMP.
```

- [ ] **Step 3: Smoke-check the manifest URL resolves**

The unit test never exercises Next's routing of the dotted `manifest.webmanifest`
segment folder — prove it once against a real server:

```bash
npm run dev &
sleep 15
curl -s http://localhost:3000/manifest.webmanifest
kill %1
```

Expected: JSON body containing `"name":"IMP"` and `"display":"standalone"`
(dev env has no `APP_NAME`). If port 3000 is taken, the dev server prints the
port it chose — curl that one instead.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run app/manifest.webmanifest/route.test.ts`
Expected: PASS — 5 passed (regression check before the final commit).

```bash
git add README.md .env.example
git commit -m "docs(branding): document client branding assets and APP_NAME" -- README.md .env.example
```
