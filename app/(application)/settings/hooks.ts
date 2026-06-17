"use client";

/**
 * Data hooks for /settings (codebase-structure §3.2: redesigned pages never
 * call useMutation(GQL_OP) inline in components).
 *
 * usePersonalSystemPrompt owns the prompt draft, dirty tracking
 * (settings-config.md U13), the narrowed save mutation, and the UserContext
 * write-back (U9): the context exposes no setter (authenticated.tsx provides
 * a plain `{ user }` value), so the saved value is written onto the context's
 * user object in place — revisiting /settings after navigation then re-seeds
 * from the post-save value instead of the stale server snapshot. Behavior
 * preserved from the old page (inventory #10/#11/#12): seed from
 * UserContext, re-seed on `user.id` change, "Saving…" pending state, success
 * toast; the error toast leads with plain language and keeps the raw GraphQL
 * detail in the description (U15).
 */

import { useMutation } from "@apollo/client";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";

import { UPDATE_PERSONAL_SYSTEM_PROMPT } from "./queries";

export interface SettingsUser {
  id?: string | number;
  email?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  super_admin?: boolean | null;
  personal_system_prompt?: string | null;
  /** serverSideAuthCheck attaches the resolved role object; api keys carry a string. */
  role?: { id?: string; name?: string } | string | null;
}

export function useSettingsUser(): SettingsUser | null {
  const context = React.useContext(UserContext);
  return (context?.user as SettingsUser | undefined) ?? null;
}

export function usePersonalSystemPrompt() {
  const t = useTranslations("settings");
  const user = useSettingsUser();

  const seed = user?.personal_system_prompt ?? "";
  const [value, setValue] = React.useState<string>(seed);
  const [savedValue, setSavedValue] = React.useState<string>(seed);

  // Re-seed when the account changes (inventory #10 preserved).
  const userId = user?.id;
  React.useEffect(() => {
    const next = user?.personal_system_prompt ?? "";
    setValue(next);
    setSavedValue(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const [mutate, { loading: saving }] = useMutation(
    UPDATE_PERSONAL_SYSTEM_PROMPT,
    {
      onCompleted: (data) => {
        const saved: string =
          data?.usersUpdateOneById?.item?.personal_system_prompt ?? value;
        // U9 fix: write the saved value back onto the context's user object
        // (the context has no setter — see file JSDoc), so the next visit
        // seeds from the post-save value without a full reload.
        if (user) user.personal_system_prompt = saved;
        setSavedValue(saved);
        toast.success(t("prompt.savedTitle"), {
          description: t("prompt.savedDescription"),
          duration: 3000,
        });
      },
      onError: (error) => {
        // U15: plain-language headline; the raw detail stays one level deeper.
        toast.error(t("prompt.errorTitle"), {
          description: error.message,
          duration: 5000,
        });
      },
    },
  );

  const dirty = value !== savedValue;

  const save = React.useCallback(() => {
    if (!user?.id) return;
    void mutate({
      variables: { id: user.id, personal_system_prompt: value },
    });
  }, [mutate, user?.id, value]);

  return { user, value, setValue, dirty, saving, save };
}
