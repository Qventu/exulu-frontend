"use client";

/**
 * PromptDetailClient — client wrapper for /prompts/[id] that supplies the
 * working Edit + post-delete redirect the legacy server route lacked
 * (prompts.md inventory item 57 + H6 fix). Server `page.tsx` server-fetches
 * the prompt and hands it down; this wrapper hosts `useRouter` for the
 * navigation that the bare `PromptDetail` doesn't own, AND owns the back-
 * link copy so the server page stays translation-free (the project's
 * `next-intl/server` getRequestConfig pathway is not wired — see
 * ./page.tsx note).
 *
 * Loads the user's favorites map on mount so the favorite toggle resolves
 * its `favoriteId` correctly (fixes H2, same source of truth as the list
 * page).
 */

import { useQuery } from "@apollo/client";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useContext, useMemo } from "react";
import { useRouter } from "next/navigation";

import { UserContext } from "@/app/(application)/authenticated";
import { Button } from "@/components/ui/button";
import type { PromptLibrary } from "@/types/models/prompt-library";

import { PromptDetail } from "../components/prompt-detail";
import { GET_USER_PROMPT_FAVORITES_INDEX } from "../queries";

interface PromptDetailClientProps {
  prompt: PromptLibrary;
}

export function PromptDetailClient({ prompt }: PromptDetailClientProps) {
  const router = useRouter();
  const { user } = useContext(UserContext);
  const t = useTranslations("prompts");

  const { data: favoritesData, refetch: refetchFavorites } = useQuery(
    GET_USER_PROMPT_FAVORITES_INDEX,
    {
      variables: { user_id: user?.id ?? 0 },
      skip: !user?.id,
      fetchPolicy: "cache-first",
    },
  );

  const favoriteId = useMemo(() => {
    const items: Array<{ id: string; prompt_id: string }> =
      favoritesData?.prompt_favoritesPagination?.items ?? [];
    return items.find((f) => f.prompt_id === prompt.id)?.id;
  }, [favoritesData, prompt.id]);

  const promptWithFav: PromptLibrary = useMemo(
    () => ({ ...prompt, is_favorited: !!favoriteId }),
    [prompt, favoriteId],
  );

  return (
    <>
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1">
          <Link href="/prompts">
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t("backToPrompts")}
          </Link>
        </Button>
      </div>
      <div className="overflow-hidden rounded-md border bg-card">
        <PromptDetail
          prompt={promptWithFav}
          favoriteId={favoriteId}
          onUpdated={() => router.refresh()}
          onFavoritesChanged={() => refetchFavorites()}
          onDeleted={() => router.push("/prompts")}
        />
      </div>
    </>
  );
}
