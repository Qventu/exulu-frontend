# Project Config Downloads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three config-file download actions ("Download Cowork config", "Download Claude Code config", "Download continue.dev config") to the project detail overflow menu, pre-filled with the project's LiteLLM gateway URL, project ID, and the user's personal JWT.

**Architecture:** A new `useProjectConfigDownloads(projectId, projectName)` hook in `hooks.ts` fetches the token lazily via `getToken()` at click time, reads the backend base URL from `ConfigContext`, and (for Claude Code only) queries the LiteLLM model catalog via Apollo's imperative `client.query()`. Each download function builds a content string and triggers a browser download via a temporary `<a>` element. The three actions are added to the overflow menu's existing copy group; `dividerAfter: true` moves from "Copy project ID" to "Download continue.dev config".

**Tech Stack:** Next.js 16 / React 19, Apollo Client (imperative query), next-intl, sonner (toast), Lucide React icons. No new npm packages.

## Global Constraints

- No new npm dependencies
- `getToken()` from `@/lib/api/client` — used to fetch JWT lazily at click time (not stored in state)
- LiteLLM base URL pattern: `${config.backend}/litellm/${projectId}` (continue.dev appends `/v1`)
- Highest claude-opus-* selection: filter by `/^claude-opus-/i`, sort by parsed version numbers descending; fallback to `catalog[0].model_name`; ultimate fallback to `"claude-opus-4-8"`
- YAML is hand-crafted as a template string — no yaml library
- On missing token or backend: `toast.error(t("detail.downloadFailed"))`, abort download
- Icon for all three download items: `Download` from lucide-react

---

### Task 1: Add i18n keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/de.json`

**Interfaces:**
- Produces: `t("projects.detail.downloadCoworkConfig")`, `t("projects.detail.downloadClaudeCodeConfig")`, `t("projects.detail.downloadContinueDevConfig")`, `t("projects.detail.downloadFailed")`

---

- [ ] **Step 1: Add keys to `messages/en.json`**

Find the `"projects"` → `"detail"` object (the one that now has `"copyId": "Copy project ID"`). Add the four new keys after `"deleteProject"` and before `"editDetails"`:

```json
"detail": {
  "actions": "Project actions",
  "backToProjects": "Back to projects",
  "copyId": "Copy project ID",
  "deleteProject": "Delete project...",
  "downloadClaudeCodeConfig": "Download Claude Code config",
  "downloadContinueDevConfig": "Download continue.dev config",
  "downloadCoworkConfig": "Download Cowork config",
  "downloadFailed": "Couldn't generate config. Please try again.",
  "editDetails": "Edit details",
  "errorTitle": "Couldn't load this project",
  "instructionsActive": "Instructions active",
  "newSession": "New session",
  "notFoundDescription": "It may have been deleted, or you no longer have access to it.",
  "notFoundTitle": "Project not found",
  "viewInstructions": "View"
},
```

- [ ] **Step 2: Add keys to `messages/de.json`**

Find the same `"projects"` → `"detail"` object and add in the same positions:

```json
"detail": {
  "actions": "Projektaktionen",
  "backToProjects": "Zurück zu Projekten",
  "copyId": "Projekt-ID kopieren",
  "deleteProject": "Projekt löschen...",
  "downloadClaudeCodeConfig": "Claude Code-Konfiguration herunterladen",
  "downloadContinueDevConfig": "continue.dev-Konfiguration herunterladen",
  "downloadCoworkConfig": "Cowork-Konfiguration herunterladen",
  "downloadFailed": "Konfiguration konnte nicht erstellt werden. Bitte erneut versuchen.",
  "editDetails": "Details bearbeiten",
  "errorTitle": "Dieses Projekt konnte nicht geladen werden",
  "instructionsActive": "Anweisungen aktiv",
  "newSession": "Neue Sitzung",
  "notFoundDescription": "Es wurde möglicherweise gelöscht oder Sie haben keinen Zugriff mehr darauf.",
  "notFoundTitle": "Projekt nicht gefunden",
  "viewInstructions": "Anzeigen"
},
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/de.json
git commit -m "feat(projects): add i18n keys for config download actions"
```

---

### Task 2: Add `useProjectConfigDownloads` hook

**Files:**
- Modify: `app/(application)/projects/hooks.ts`

**Interfaces:**
- Consumes: `getToken()` from `@/lib/api/client` — returns `Promise<string | undefined>`
- Consumes: `ConfigContext` from `@/components/shell/config-context` — `config.backend: string`
- Consumes: `GET_LITELLM_CATALOG` from `@/queries/queries` — Apollo query, returns `{ litellmCatalog: { model_name: string }[] }`
- Consumes: `useApolloClient()` — already imported in hooks.ts via `@apollo/client`
- Produces: `useProjectConfigDownloads(projectId: string, projectName: string)` → `{ downloadCoworkConfig: () => void, downloadClaudeCodeConfig: () => void, downloadContinueDevConfig: () => void }`

---

- [ ] **Step 1: Add new imports to `hooks.ts`**

At the top of `app/(application)/projects/hooks.ts`, add these imports after the existing import block:

The existing import block ends with the local queries import:
```ts
import {
  DELETE_ITEM,
  DELETE_PROJECT,
  GET_AGENT_SESSIONS,
  GET_PROJECT_AGENTS,
  GET_PROJECT_BY_ID,
  GET_PROJECTS,
  GET_PROJECTS_BY_IDS,
  GET_USER_FAVOURITE_PROJECTS,
  REMOVE_AGENT_SESSION_BY_ID,
  UPDATE_AGENT_SESSION_PROJECT,
  UPDATE_USER_FAVOURITE_PROJECTS,
} from "./queries";
```

Add these new imports directly after that block:

```ts
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { ConfigContext } from "@/components/shell/config-context";
import { getToken } from "@/lib/api/client";
import { GET_LITELLM_CATALOG } from "@/queries/queries";
```

- [ ] **Step 2: Append the hook at the end of `hooks.ts`**

Add the full hook after the closing `}` of `useDeleteProjectCascade`:

```ts
/** Generates and triggers browser downloads for tool-specific config files. */
export function useProjectConfigDownloads(projectId: string, projectName: string) {
  const config = React.useContext(ConfigContext);
  const apolloClient = useApolloClient();
  const t = useTranslations("projects");

  function toSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  function triggerDownload(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function pickBestOpusModel(catalog: { model_name: string }[]): string {
    const opusModels = catalog
      .filter((m) => /^claude-opus-/i.test(m.model_name))
      .sort((a, b) => {
        const parseVer = (s: string) =>
          s.replace(/^claude-opus-/i, "").split(/[-.]/).map(Number);
        const av = parseVer(a.model_name);
        const bv = parseVer(b.model_name);
        for (let i = 0; i < Math.max(av.length, bv.length); i++) {
          const diff = (bv[i] ?? 0) - (av[i] ?? 0);
          if (diff !== 0) return diff;
        }
        return 0;
      });
    if (opusModels.length > 0) return opusModels[0].model_name;
    if (catalog.length > 0) return catalog[0].model_name;
    return "claude-opus-4-8";
  }

  async function downloadCoworkConfig(): Promise<void> {
    const token = await getToken();
    if (!token || !config?.backend) {
      toast.error(t("detail.downloadFailed"));
      return;
    }
    const slug = toSlug(projectName);
    const baseUrl = `${config.backend}/litellm/${projectId}`;
    triggerDownload(
      JSON.stringify(
        {
          inferenceProvider: "gateway",
          inferenceCredentialKind: "static",
          inferenceGatewayBaseUrl: baseUrl,
          inferenceGatewayApiKey: token,
          banner: {
            enabled: true,
            text: "OPEN",
            backgroundColor: "#E6D200",
            textColor: "#000000",
          },
        },
        null,
        2,
      ),
      `cowork_config_${slug}.json`,
      "application/json",
    );
  }

  async function downloadClaudeCodeConfig(): Promise<void> {
    const token = await getToken();
    if (!token || !config?.backend) {
      toast.error(t("detail.downloadFailed"));
      return;
    }
    const { data } = await apolloClient.query({
      query: GET_LITELLM_CATALOG,
      fetchPolicy: "cache-first",
    });
    const catalog: { model_name: string }[] = data?.litellmCatalog ?? [];
    const baseUrl = `${config.backend}/litellm/${projectId}`;
    triggerDownload(
      JSON.stringify(
        {
          model: pickBestOpusModel(catalog),
          availableModels: catalog.map((m) => m.model_name),
          env: {
            ANTHROPIC_BASE_URL: baseUrl,
            CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: 1,
            DISABLE_AUTOUPDATER: 0,
          },
          apiKeyHelper: `echo ${token}`,
        },
        null,
        2,
      ),
      "settings.json",
      "application/json",
    );
  }

  async function downloadContinueDevConfig(): Promise<void> {
    const token = await getToken();
    if (!token || !config?.backend) {
      toast.error(t("detail.downloadFailed"));
      return;
    }
    const slug = toSlug(projectName);
    const apiBase = `${config.backend}/litellm/${projectId}/v1`;
    const yaml = [
      "name: Local Config",
      "version: 1.0.0",
      "schema: v1",
      "models:",
      "  - name: AI.OPEN",
      "    provider: openai",
      `    apiBase: ${apiBase}`,
      `    apiKey: ${token}`,
      "    model: AUTODETECT",
      "    roles:",
      "      - chat",
      "      - edit",
      "      - apply",
      "    capabilities:",
      "      - tool_use",
      "      - image_input",
    ].join("\n");
    triggerDownload(yaml, `continue_config_${slug}.yaml`, "application/yaml");
  }

  return {
    downloadCoworkConfig: () => { void downloadCoworkConfig(); },
    downloadClaudeCodeConfig: () => { void downloadClaudeCodeConfig(); },
    downloadContinueDevConfig: () => { void downloadContinueDevConfig(); },
  };
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add "app/(application)/projects/hooks.ts"
git commit -m "feat(projects): add useProjectConfigDownloads hook"
```

---

### Task 3: Wire download actions into the project detail view

**Files:**
- Modify: `app/(application)/projects/components/project-detail-view.tsx`

**Interfaces:**
- Consumes: `useProjectConfigDownloads(projectId: string, projectName: string)` from `../hooks` (Task 2)
- Consumes: `t("detail.downloadCoworkConfig")`, `t("detail.downloadClaudeCodeConfig")`, `t("detail.downloadContinueDevConfig")` (Task 1)
- `dividerAfter: true` moves OFF "Copy project ID" and ON to "Download continue.dev config"

---

- [ ] **Step 1: Add `Download` to the lucide-react import**

The current import line reads:
```tsx
import { Copy, FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
```

Replace with:
```tsx
import { Copy, Download, FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
```

- [ ] **Step 2: Import and call `useProjectConfigDownloads`**

The existing hook imports block in the component reads:
```tsx
import {
  MAX_PROJECT_ITEMS,
  useDeleteProjectCascade,
  useFavoriteProjects,
  useProject,
  useProjectAgents,
  useProjectSessions,
} from "../hooks";
```

Replace with:
```tsx
import {
  MAX_PROJECT_ITEMS,
  useDeleteProjectCascade,
  useFavoriteProjects,
  useProject,
  useProjectAgents,
  useProjectConfigDownloads,
  useProjectSessions,
} from "../hooks";
```

Then in the `ProjectDetailView` component body, add the hook call directly after the existing hooks (after `const deleteProjectCascade = useDeleteProjectCascade();`):

```tsx
const { downloadCoworkConfig, downloadClaudeCodeConfig, downloadContinueDevConfig } =
  useProjectConfigDownloads(projectId, project?.name ?? "");
```

Note: `projectId` is the component prop; `project?.name ?? ""` safely handles the loading state where `project` is undefined (the hook only uses these values at click time, after the project is guaranteed loaded).

- [ ] **Step 3: Update the OverflowMenu items array**

Find the `OverflowMenu` `items` prop in the `action` prop of `PageHeader`. It currently reads:

```tsx
items={[
  {
    label: t("detail.copyId"),
    icon: Copy,
    dividerAfter: true,
    onSelect: async () => {
      try {
        await navigator.clipboard.writeText(project.id);
        toast.success(t("common.copied"));
      } catch {
        toast.error(t("common.copyFailed"));
      }
    },
  },
  {
    label: t("detail.editDetails"),
    icon: Pencil,
    onSelect: () => setTab("settings", { edit: true }),
  },
  {
    label: t("detail.deleteProject"),
    icon: Trash2,
    destructive: true,
    onSelect: () => setDeleteOpen(true),
  },
]}
```

Replace with:

```tsx
items={[
  {
    label: t("detail.copyId"),
    icon: Copy,
    onSelect: async () => {
      try {
        await navigator.clipboard.writeText(project.id);
        toast.success(t("common.copied"));
      } catch {
        toast.error(t("common.copyFailed"));
      }
    },
  },
  {
    label: t("detail.downloadCoworkConfig"),
    icon: Download,
    onSelect: downloadCoworkConfig,
  },
  {
    label: t("detail.downloadClaudeCodeConfig"),
    icon: Download,
    onSelect: downloadClaudeCodeConfig,
  },
  {
    label: t("detail.downloadContinueDevConfig"),
    icon: Download,
    dividerAfter: true,
    onSelect: downloadContinueDevConfig,
  },
  {
    label: t("detail.editDetails"),
    icon: Pencil,
    onSelect: () => setTab("settings", { edit: true }),
  },
  {
    label: t("detail.deleteProject"),
    icon: Trash2,
    destructive: true,
    onSelect: () => setDeleteOpen(true),
  },
]}
```

Key changes: `dividerAfter: true` removed from "Copy project ID" and added to "Download continue.dev config".

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (clean).

- [ ] **Step 5: Manual browser verification**

Start the dev server (`npm run dev`), open a project detail page, click `⋯` and verify:

1. Menu shows in order: Copy project ID → Download Cowork config → Download Claude Code config → Download continue.dev config → (separator) → Edit details → (separator) → Delete project...
2. "Download Cowork config" downloads `cowork_config_<project-name-slug>.json` with correct `inferenceGatewayBaseUrl` and `inferenceGatewayApiKey`
3. "Download Claude Code config" downloads `settings.json` with a `model` field set to the highest `claude-opus-*` model, `availableModels` as a flat array of model names, and correct `ANTHROPIC_BASE_URL` and `apiKeyHelper`
4. "Download continue.dev config" downloads `continue_config_<slug>.yaml` with correct `apiBase` (ending in `/v1`) and `apiKey`
5. Existing "Copy project ID", "Edit details", and "Delete project..." still work

- [ ] **Step 6: Commit**

```bash
git add "app/(application)/projects/components/project-detail-view.tsx"
git commit -m "feat(projects): wire config download actions into overflow menu"
```
