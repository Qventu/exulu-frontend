# Client-overridable favicon + installable app icon

**Date:** 2026-07-21
**Status:** Approved

## Problem

Clients white-label Exulu by dropping `logo_light.png` / `logo_dark.png` (and
`cover.jpg`) into the `public/` folder of the repo where they run the frontend
and backend packages. The backend serves that folder via
`express.static("public")`, and the frontend loads the assets from the backend
URL.

There is no equivalent for the favicon or the installed-app icon:

- Three frontend layouts (`app/(application)/layout.tsx`,
  `app/(authentication)/layout.tsx`, `app/public/agents/layout.tsx`) link
  `${BACKEND}/icon_16x16.png`, `icon_32x32.png`, `icon_48x48.png`,
  `icon_512x512.png` — a four-file convention that is undocumented and that no
  client follows, so the links 404 and browsers show the default globe icon.
- `app/artifacts/layout.tsx` has no icon links at all.
- There is no web app manifest and no `apple-touch-icon`, so installing the app
  from Edge/Chrome (the "Windows application icon" case) or pinning it on
  iOS/Android shows a generic icon.
- None of the branding conventions (logos, cover, icons) are documented in
  either README.

## Decisions

Confirmed with the user on 2026-07-21:

1. **Convention:** a single `favicon.png` (square PNG, 512×512 recommended,
   transparent background) in the client's `public/` folder, replacing the
   four-size `icon_NxN.png` ladder. Browsers downscale for tab-size rendering;
   slightly less crisp at 16px than a hand-tuned icon is an accepted trade-off.
2. **Scope:** browser favicon **plus** a web app manifest and
   `apple-touch-icon`, so the installed app (Windows taskbar/start menu, iOS
   and Android home screens) shows the client icon.
3. **Fallback:** none. A missing `favicon.png` 404s and the browser shows its
   default icon. No backend changes.

## Design

Frontend-only change.

### 1. Head links

In the three layouts that currently emit the four `icon_NxN.png` links, replace
them with:

```tsx
<link rel="icon" href={process.env.BACKEND + "/favicon.png"} type="image/png" />
<link rel="apple-touch-icon" href={process.env.BACKEND + "/favicon.png"} />
<link rel="manifest" href="/manifest.webmanifest" />
```

`app/artifacts/layout.tsx` gets only the `rel="icon"` link (artifact pages are
not an install target; it currently ships no `<head>` content, so a `<head>`
block is added).

### 2. Manifest route

New route handler `app/manifest.webmanifest/route.ts`:

- `export const dynamic = "force-dynamic"` — the package ships prebuilt, so the
  route must read the client's runtime `BACKEND` / `APP_NAME` env at request
  time; static evaluation would bake in the empty build-time values.
- Responds with `Content-Type: application/manifest+json`:

```json
{
  "name": "<APP_NAME or \"Exulu\">",
  "short_name": "<APP_NAME or \"Exulu\">",
  "start_url": "/",
  "display": "standalone",
  "icons": [
    { "src": "<BACKEND>/favicon.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- A single 512×512 icon entry satisfies Edge/Chrome installability criteria
  (minimum one icon ≥144px), which is what produces the Windows
  taskbar/start-menu icon.
- The manifest is served from the **frontend** origin because browsers reject
  cross-origin manifests; the cross-origin icon URL inside it is fine (same
  pattern as the logos).
- No middleware exists in the frontend, so the route is publicly reachable
  as required.

### 3. `APP_NAME` env var

Optional, read by the manifest route only. Defaults to `"Exulu"`. Provides the
manifest `name` / `short_name` — the label shown under the installed app icon.

### 4. Documentation

Add a "Branding assets" section to the frontend `README.md` documenting the
full client `public/`-folder convention — `logo_light.png`, `logo_dark.png`,
`cover.jpg`, `favicon.png` — and the `APP_NAME` env var. None of this is
currently written down anywhere.

## Error handling

- Missing `favicon.png`: backend 404s; browsers silently fall back to the
  default icon. Installability degrades gracefully (Edge/Chrome won't offer
  install without a valid icon) — accepted per the no-fallback decision.
- Unset `BACKEND`: the icon links render a broken `undefined/favicon.png` URL —
  identical to how the existing `icon_NxN.png` links already degrade. `BACKEND`
  is a required env for every install, so this is not worth guarding; the
  manifest route uses `process.env.BACKEND || ""` like the layouts' config
  objects do.

## Testing

- Unit test for the manifest route: correct content type, icon `src` uses
  `BACKEND`, `name` honors `APP_NAME` and falls back to `"Exulu"`.
- Manual verification: drop a `favicon.png` into a client-style `public/`
  folder, confirm the tab icon appears and the app is installable with the
  icon and `APP_NAME` label.

## Out of scope

- Backend default/fallback icons (explicitly declined).
- Multi-size icon overrides (`icon_16x16.png` etc. are removed, not kept as
  optional overrides).
- `theme_color` / `background_color` manifest fields and any PWA features
  beyond installability (no service worker, no offline).
