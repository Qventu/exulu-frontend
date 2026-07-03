# Design: Project config download actions

**Date:** 2026-07-03  
**Status:** Approved

## Summary

Add three download actions to the project detail page's `⋯` overflow menu: "Download Cowork config", "Download Claude Code config", and "Download continue.dev config". Each generates a pre-filled config file for the respective tool and triggers a browser download. The three actions extend the existing copy group above the Edit/Delete divider.

## Motivation

Developers need pre-filled config files to connect Cowork, Claude Code CLI, and continue.dev to their project's LiteLLM gateway. Generating these from the project detail page eliminates manual copy-paste of base URLs, project IDs, and tokens.

## Menu Structure

```
⋯ (Project actions)
├── Copy project ID
├── Download Cowork config
├── Download Claude Code config
├── Download continue.dev config   ← dividerAfter: true (moved from "Copy project ID")
├───────────────────────────────
├── Edit details
└── Delete project...              ← destructive
```

The `dividerAfter: true` flag moves from "Copy project ID" to "Download continue.dev config" — the last item in the copy/download group.

## Architecture

### New hook: `useProjectConfigDownloads`

Located in `app/(application)/projects/hooks.ts`. Consumes:
- `ConfigContext` → `config.backend` (the backend base URL, e.g. `https://backend.ai.open.de`)
- `usePersonalToken()` → `token: string | null` (the user's JWT, same as shown on /token page)
- `useQuery(GET_LITELLM_CATALOG)` → `litellmCatalog: LiteLLMCatalogEntry[]` (fetched once, shared across all downloads)

Exposes:
```ts
{
  downloadCoworkConfig: () => void;
  downloadClaudeCodeConfig: () => void;
  downloadContinueDevConfig: () => void;
}
```

Each function builds a content string, creates a `Blob`, triggers a browser download via a temporary `<a>` element with the `download` attribute, then revokes the object URL. No new npm dependencies.

### Download mechanism (shared pattern)

```ts
function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Slug utility (inline, not a shared utility)

```ts
function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
```

### Highest claude-opus-* model selection

Filter `litellmCatalog` entries whose `model_name` matches `/^claude-opus-/i`. Parse the version numbers from the model name (e.g. `claude-opus-4-8` → `[4, 8]`) and sort descending. Take the first result. Fallbacks:
1. If no `claude-opus-*` model found → use `litellmCatalog[0].model_name`
2. If catalog is empty → use the hardcoded string `"claude-opus-4-8"`

## File Specifications

### 1. Cowork config

**Filename:** `cowork_config_<slug>.json`  
**MIME type:** `application/json`

```json
{
  "inferenceProvider": "gateway",
  "inferenceCredentialKind": "static",
  "inferenceGatewayBaseUrl": "<backend>/litellm/<project.id>",
  "inferenceGatewayApiKey": "<token>",
  "banner": {
    "enabled": true,
    "text": "OPEN",
    "backgroundColor": "#E6D200",
    "textColor": "#000000"
  }
}
```

### 2. Claude Code config

**Filename:** `settings.json`  
**MIME type:** `application/json`

```json
{
  "model": "<highest-claude-opus-model>",
  "availableModels": ["model_name_1", "model_name_2", "..."],
  "env": {
    "ANTHROPIC_BASE_URL": "<backend>/litellm/<project.id>",
    "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS": 1,
    "DISABLE_AUTOUPDATER": 0
  },
  "apiKeyHelper": "echo <token>"
}
```

`availableModels` is a flat array of all `model_name` strings from the LiteLLM catalog.

### 3. continue.dev config

**Filename:** `continue_config_<slug>.yaml`  
**MIME type:** `application/yaml`

```yaml
name: Local Config
version: 1.0.0
schema: v1
models:
  - name: AI.OPEN
    provider: openai
    apiBase: <backend>/litellm/<project.id>/v1
    apiKey: <token>
    model: AUTODETECT
    roles:
      - chat
      - edit
      - apply
    capabilities:
      - tool_use
      - image_input
```

Hand-crafted as a template string — no yaml library needed for this fixed structure.

## Error Handling

If `token` is null or `config.backend` is missing when a download is triggered:
- Show `toast.error(t("projects.detail.downloadFailed"))`
- Do not trigger the download

### i18n keys added

In `projects.detail` (both `en.json` and `de.json`):

```json
"downloadCoworkConfig": "Download Cowork config",
"downloadClaudeCodeConfig": "Download Claude Code config",
"downloadContinueDevConfig": "Download continue.dev config",
"downloadFailed": "Couldn't generate config. Please try again."
```

German:
```json
"downloadCoworkConfig": "Cowork-Konfiguration herunterladen",
"downloadClaudeCodeConfig": "Claude Code-Konfiguration herunterladen",
"downloadContinueDevConfig": "continue.dev-Konfiguration herunterladen",
"downloadFailed": "Konfiguration konnte nicht erstellt werden. Bitte erneut versuchen."
```

## Files to Change

| File | Change |
|------|--------|
| `app/(application)/projects/hooks.ts` | Add `useProjectConfigDownloads` hook |
| `app/(application)/projects/components/project-detail-view.tsx` | Consume hook; add 3 download items; move `dividerAfter` to last download item |
| `messages/en.json` | Add 4 new keys under `projects.detail` |
| `messages/de.json` | Add 4 new keys under `projects.detail` |

## Out of Scope

- Model filtering by `active` status — catalog is shown as-is on the models page, same here
- Customising the banner fields in Cowork config — hardcoded per spec
- YAML library integration — template string is sufficient for this fixed structure
