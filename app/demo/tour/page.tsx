"use client";

import { SessionScreen } from "@/app/(application)/chat/components/session-screen";
import { Spotlight } from "@/components/demo/spotlight";
import { TourBubble } from "@/components/demo/tour-bubble";
import { useTour } from "@/components/demo/tour-provider";

import { DemoChatProviders } from "./demo-chat-providers";

/**
 * /demo/tour — the guided tour surface.
 *
 * This renders the REAL SessionScreen, not a lookalike: the spec's premise is
 * that the demo cannot visually drift from the product, which only holds if it
 * IS the product. DemoChatProviders supplies the contexts the product's route
 * tree would otherwise provide, and the agent comes from the same fixture world
 * the Apollo link answers from.
 *
 * The composer is live. Whatever the visitor types, DemoChatTransport replays
 * the scripted turn for the current chapter — so retrieval, streaming text and
 * citations all render through the genuine components.
 */
export default function TourPage() {
  const { step, world } = useTour();

  const agent = world.agents[0];

  return (
    <div className="relative flex h-full min-h-dvh flex-col bg-background">
      <Spotlight anchor={step?.anchor ?? null} />
      <TourBubble />

      <DemoChatProviders agent={agent}>
        <SessionScreen
          agent={agent}
          initialSession={null}
          initialMessages={[]}
        />
      </DemoChatProviders>
    </div>
  );
}
