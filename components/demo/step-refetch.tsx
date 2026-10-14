"use client";

import { useEffect, useRef } from "react";
import { useApolloClient } from "@apollo/client";
import { useSearchParams } from "next/navigation";

import { shouldRefetch } from "@/lib/demo/step-refetch";
import { TOUR_PARAM } from "@/lib/demo/tour";

/**
 * Refetches every active query whenever the tour moves.
 *
 * Mounted INSIDE the demo ApolloProvider (app/(application)/authenticated.tsx)
 * because the tour provider itself sits outside it and cannot reach the
 * client. Reads the position from the URL, which is the tour's source of
 * truth, rather than from the tour context for the same reason.
 *
 * `reFetchObservableQueries` refetches cache-first queries too; `resetStore`
 * would also clear the cache and briefly empty every screen, which is the
 * flash this exists to avoid.
 */
export function DemoStepRefetch() {
  const client = useApolloClient();
  const raw = useSearchParams().get(TOUR_PARAM);
  const previous = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (shouldRefetch(previous.current, raw)) {
      void client.reFetchObservableQueries();
    }
    previous.current = raw;
  }, [raw, client]);

  return null;
}
