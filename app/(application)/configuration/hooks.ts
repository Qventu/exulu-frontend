"use client";

/**
 * Data hooks for /configuration (codebase-structure §3.2: redesigned pages
 * never call useQuery(GET_X) inline).
 *
 * useThemeConfig owns: the by-key load (fixes settings-config.md U11 — never
 * the unfiltered collection), the create-or-update publish pipeline
 * (inventory #18 preserved: same `theme_config` key, same description, same
 * mutation roots), and the runtime apply that makes a publish visible to the
 * publishing admin without a manual reload (fixes U2's "Save + full reload"
 * half; the server-injected <style> in app/(application)/layout.tsx keeps
 * serving everyone else on next load — inventory #26 untouched).
 */

import { useMutation, useQuery } from "@apollo/client";
import * as React from "react";

import {
  buildThemeCss,
  resolveTheme,
  type ThemeOverrides,
} from "./theme-defaults";
import {
  CREATE_THEME_CONFIGURATION,
  GET_THEME_CONFIGURATION,
  UPDATE_THEME_CONFIGURATION,
} from "./queries";

/** The one row this page may ever write (inventory #27). */
export const THEME_CONFIG_KEY = "theme_config";
/** Preserved verbatim from the old page (inventory #18). */
const THEME_CONFIG_DESCRIPTION = "Platform theme configuration";

/**
 * Runtime apply (settings-config.md risk 1): the server-injected theme tag in
 * layout.tsx carries no id (and lives outside this route's file mandate), so
 * we append/refresh our OWN tag at the end of <head> — same selectors, same
 * specificity, later in document order, so it wins. It writes the FULL
 * resolved variable set (defaults merged with the published overrides), which
 * also reverts variables whose overrides were just REMOVED and would
 * otherwise stick around in the stale server tag until reload.
 */
const RUNTIME_STYLE_ID = "exulu-theme-runtime";

export function applyThemeToDocument(theme: {
  light: ThemeOverrides;
  dark: ThemeOverrides;
}): void {
  if (typeof document === "undefined") return;
  let tag = document.getElementById(RUNTIME_STYLE_ID);
  if (!tag) {
    tag = document.createElement("style");
    tag.id = RUNTIME_STYLE_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = buildThemeCss(
    resolveTheme("light", theme.light),
    resolveTheme("dark", theme.dark),
  );
}

export interface StoredThemeConfig {
  id: string;
  config_key: string;
  config_value?: {
    light?: ThemeOverrides;
    dark?: ThemeOverrides;
  } | null;
  updatedAt?: string;
}

export interface PublishableTheme {
  light: ThemeOverrides;
  dark: ThemeOverrides;
}

export function useThemeConfig() {
  const { data, loading, error, refetch } = useQuery(GET_THEME_CONFIGURATION, {
    variables: { config_key: { eq: THEME_CONFIG_KEY } },
  });

  const [createConfig] = useMutation(CREATE_THEME_CONFIGURATION);
  const [updateConfig] = useMutation(UPDATE_THEME_CONFIGURATION);
  const [publishing, setPublishing] = React.useState(false);

  // Id captured at creation so a second publish before the refetch lands can
  // never create a duplicate row (old page's setConfigId behavior, #18).
  const createdIdRef = React.useRef<string | null>(null);

  const item: StoredThemeConfig | undefined =
    data?.platform_configurationsPagination?.items?.[0];
  const configId = item?.id ?? createdIdRef.current;

  const savedTheme = React.useMemo<PublishableTheme>(
    () => ({
      light: item?.config_value?.light ?? {},
      dark: item?.config_value?.dark ?? {},
    }),
    [item],
  );

  /**
   * Create-or-update the `theme_config` row, refetch, and apply the published
   * values to the live document. Rejects on failure so callers (the publish
   * ConfirmDialog) can keep their surface open.
   */
  const publish = React.useCallback(
    async (theme: PublishableTheme): Promise<void> => {
      setPublishing(true);
      try {
        const configData = {
          config_key: THEME_CONFIG_KEY,
          config_value: { light: theme.light, dark: theme.dark },
          description: THEME_CONFIG_DESCRIPTION,
        };

        if (configId) {
          await updateConfig({ variables: { id: configId, data: configData } });
        } else {
          const result = await createConfig({ variables: { data: configData } });
          const newId: string | undefined =
            result.data?.platform_configurationsCreateOne?.item?.id;
          if (newId) createdIdRef.current = newId;
        }

        await refetch();
        applyThemeToDocument(theme);
      } finally {
        setPublishing(false);
      }
    },
    [configId, createConfig, updateConfig, refetch],
  );

  return {
    loading,
    error,
    refetch,
    savedTheme,
    /** True while a publish round-trip is in flight. */
    publishing,
    publish,
  };
}
