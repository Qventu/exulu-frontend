"use client";

import { EditorView } from "@/app/(application)/agents/edit/[id]/components/editor-view";
import { Spotlight } from "@/components/demo/spotlight";
import { TourBubble } from "@/components/demo/tour-bubble";
import { useTour } from "@/components/demo/tour-provider";

import { DemoChatProviders } from "../tour/demo-chat-providers";

/**
 * /demo/agent — chapter 3, the agent configuration wizard.
 *
 * Why this is not simply /agents/edit/[id]: that route is an async Server
 * Component calling fetchGraphQLServerSide, which needs a JWT the demo does
 * not have. It fails with "fetch failed" and renders EditorErrorView.
 *
 * The rule this follows, learned the hard way: INDEX routes (/data, /agents,
 * /evals) are client-rendered and work as real routes under the demo Apollo
 * link; DETAIL routes fetch server-side and need a demo-owned page that hands
 * the component its data as props. EditorView takes `agent` exactly like
 * SessionScreen does, so the same trick applies.
 *
 * Everything below the props boundary is genuine: useEditorReferenceData still
 * issues EditorContexts / EditorTools / EditorSkills / EditorVariables through
 * Apollo, and the demo link answers them. The wizard reads its configuration
 * from the agent's own tool config — Newlift's real one.
 */
export default function DemoAgentEditorPage() {
  const { step, world } = useTour();

  const agent = world.agents[0];

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <Spotlight anchor={step?.anchor ?? null} />
      <TourBubble />

      <DemoChatProviders agent={agent}>
        <EditorView agent={agent} />
      </DemoChatProviders>
    </div>
  );
}
