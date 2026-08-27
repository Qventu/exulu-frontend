"use client";

import { TourBubble } from "@/components/demo/tour-bubble";
import { Spotlight } from "@/components/demo/spotlight";
import { useTour } from "@/components/demo/tour-provider";
import { TECHDOC_TURNS } from "@/lib/demo/fixtures/chapter-techdoc";

/**
 * /demo/tour — the guided tour surface.
 *
 * NOTE on real chat surface: Mounting the genuine SessionScreen requires
 * three prerequisites that the governing rule forbids extracting to demo mode:
 *
 *   1. ChatShellContext — provided by ChatShell in app/(application)/chat/[agent]/layout.tsx,
 *      which fetches agent data via server-side GraphQL. useChatShell() throws when absent.
 *   2. UserContext — useChatSession() destructures user and uses user.id/user.budget
 *      with no null guard. A missing context crashes at runtime, not degrading.
 *   3. ApolloProvider — useChatSession() issues useMutation/useQuery calls that need
 *      an Apollo client in context.
 *
 * Note: the transport fork for demo mode already exists in app/(application)/chat/hooks.ts
 * (lines 390–424), where isDemoMode() branches to DemoChatTransport. The blockers are
 * context provisioning only. Do this as a dedicated plan once the foundation is validated.
 */
export default function TourPage() {
  const { step, position } = useTour();

  // Representative scripted conversation for chapter 1 (techdoc).
  // Other chapters reuse these turns until their own plans land.
  const turn = TECHDOC_TURNS[0];

  // Derive which parts of the conversation are visible based on the step
  // index within the techdoc chapter. Other chapters start at step 0.
  const stepIndex = position.chapter === "techdoc" ? position.step : 0;
  const showToolTrace = stepIndex >= 1;
  const showSources = stepIndex >= 2;

  return (
    <div className="relative flex h-full min-h-dvh flex-col bg-background">
      {/* Tour chrome */}
      <Spotlight anchor={step?.anchor ?? null} />
      <TourBubble />

      {/* Demo content surface — placeholder for the real chat surface */}
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
        {/* User question */}
        <div className="flex justify-end">
          <div className="max-w-lg rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground">
            What causes fault E47 on the CTRL-3000 control board?
          </div>
        </div>

        {/* Assistant response area */}
        <div className="flex flex-col gap-4">
          {/* Tool trace — chat-tool-trace anchor */}
          {showToolTrace && (
            <div
              data-demo-id="chat-tool-trace"
              className="rounded-md border bg-muted/30 p-3 text-sm"
            >
              <div className="flex items-center gap-2 font-medium text-muted-foreground">
                <span className="inline-block size-3 rounded-full bg-green-500" />
                <span>searchContexts</span>
                <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs">
                  Completed
                </span>
              </div>
              <div className="mt-2 rounded bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
                {`query: "door contact chain fault", contexts: ["ctx-techdoc", "ctx-vorschriften"]`}
              </div>
              <div className="mt-1 rounded bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
                {`→ 7 passages from ctx-techdoc`}
              </div>
            </div>
          )}

          {/* Assistant text */}
          {showToolTrace && (
            <div className="rounded-2xl border bg-card px-4 py-3 text-sm">
              {turn.text}
            </div>
          )}

          {/* Sources — chat-sources anchor */}
          {showSources && (
            <div
              data-demo-id="chat-sources"
              className="text-xs text-primary"
            >
              <p className="flex items-center gap-1 font-medium">
                <span>Used {turn.sources.length} source{turn.sources.length !== 1 ? "s" : ""}</span>
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {turn.sources.map((src) => (
                  <li key={src.sourceId}>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 hover:underline"
                    >
                      <span className="inline-block size-3 shrink-0 rounded-sm bg-muted-foreground/40" />
                      {src.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Composer — chat-composer anchor */}
        <div className="mt-auto">
          <form
            data-demo-id="chat-composer"
            onSubmit={(e) => e.preventDefault()}
            className="rounded-lg border bg-card p-2"
          >
            <textarea
              readOnly
              rows={1}
              placeholder="Ask a question…"
              className="w-full resize-none bg-transparent px-2 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
            />
          </form>
        </div>
      </div>
    </div>
  );
}
