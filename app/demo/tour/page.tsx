"use client";

import { useMemo } from "react";

import { SessionScreen } from "@/app/(application)/chat/components/session-screen";
import { getWorld } from "@/lib/demo/fixtures";
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
  const { position } = useTour();

  // Pinned to the CHAPTER, not the position.
  //
  // getWorld() deep-clones, so reading the agent and session off the tour's
  // step-scoped world handed SessionScreen a new object identity on every
  // step. SessionScreenInner is React.memo'd on prop identity and rebuilds its
  // chat controller when they change, so advancing the tour by one step threw
  // away the conversation — including, on chapter 4, the correction the
  // visitor had just sent and the memory tool call that the very next step is
  // anchored to. The step said "you can see exactly what was stored" over an
  // empty transcript.
  //
  // Neither value varies within a chapter, so deriving them from step 0 keeps
  // the identities stable while leaving anything genuinely step-scoped — the
  // knowledge items Apollo serves — untouched, since the demo link reads the
  // live position itself.
  const chapterWorld = useMemo(
    () => getWorld({ chapter: position.chapter, step: 0 }),
    [position.chapter],
  );

  const agent = chapterWorld.agents[0];

  // Chapter 4 opens mid-conversation: the correction it demonstrates only lands
  // if the answer being corrected is already on screen. Keyed so that switching
  // chapters through the Tour bubble remounts the chat with the right history
  // rather than appending chapter 4's scrollback to chapter 1's transcript.
  // Step-scoped, not just chapter-scoped: chapter 4's correction joins the
  // scrollback at the step that narrates it, so the memory tool call that step
  // anchors to is on screen whether or not the visitor typed the correction.
  const scrollback = scrollbackFor(position.chapter, position.step);

  // Hand the surface an existing session rather than null. On null (the /new
  // path) the first send lazily creates one through a GraphQL mutation, which
  // the demo link does not answer — the send then fails with "Failed to create
  // the conversation". Supplying a session skips that branch entirely, so the
  // demo never needs mutation support.
  const session = chapterWorld.sessions[0] ?? null;

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
