"use client";

import { SessionScreen } from "@/app/(application)/chat/components/session-screen";
import { TourOverlay } from "@/components/demo/tour-overlay";
import { useTour } from "@/components/demo/tour-provider";
import { scrollbackFor } from "@/lib/demo/current-position";

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
  const { position, world } = useTour();

  const agent = world.agents[0];

  // Chapter 4 opens mid-conversation: the correction it demonstrates only lands
  // if the answer being corrected is already on screen. Keyed so that switching
  // chapters through the Tour bubble remounts the chat with the right history
  // rather than appending chapter 4's scrollback to chapter 1's transcript.
  const scrollback = scrollbackFor(position.chapter);

  // Hand the surface an existing session rather than null. On null (the /new
  // path) the first send lazily creates one through a GraphQL mutation, which
  // the demo link does not answer — the send then fails with "Failed to create
  // the conversation". Supplying a session skips that branch entirely, so the
  // demo never needs mutation support.
  const session = world.sessions[0] ?? null;

  return (
    <div className="relative flex h-full min-h-dvh flex-col bg-background">
      <TourOverlay />

      <DemoChatProviders agent={agent}>
        <SessionScreen
          key={position.chapter}
          agent={agent}
          initialSession={session}
          initialMessages={scrollback}
        />
      </DemoChatProviders>
    </div>
  );
}
