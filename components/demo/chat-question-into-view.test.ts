import { describe, expect, it } from "vitest";

import { questionToAlign } from "./chat-question-into-view";

describe("questionToAlign", () => {
  it("aligns the LAST question by default — a finished exchange, the question above its answer", () => {
    expect(questionToAlign({ anchor: "chat-messages" })).toBe("last");
    expect(questionToAlign({ anchor: null })).toBe("last");
    expect(questionToAlign(undefined)).toBe("last");
  });

  it("stays out of the way when a step anchors a card inside the conversation", () => {
    // The ring's own scroll must win: aligning the question would push the
    // approval card at the end of a long answer off the screen (found on the
    // sub-project 8 walk, email.4).
    expect(questionToAlign({ anchor: "chat-tool-approval" })).toBeNull();
    expect(questionToAlign({ anchor: "chat-tool-trace", scrollBlock: "start" })).toBeNull();
  });

  it("aligns the FIRST question when a step anchors the conversation at its start", () => {
    // Chapter 9's "Worum es geht": the inbound mail is the first message of a
    // stored session, and the step is about it.
    expect(questionToAlign({ anchor: "chat-messages", scrollBlock: "start" })).toBe("first");
  });
});
