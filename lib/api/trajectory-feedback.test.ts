import { describe, test, expect } from "vitest";
import {
  trajectoryFeedbackPath,
  buildTrajectoryFeedbackBody,
} from "./trajectory-feedback";

describe("trajectoryFeedbackPath", () => {
  test("encodes the :: ref into the harness route path", () => {
    expect(
      trajectoryFeedbackPath("newton::550e8400-e29b-41d4-a716-446655440000"),
    ).toBe(
      "/retrieval/trajectories/newton%3A%3A550e8400-e29b-41d4-a716-446655440000/feedback",
    );
  });
});

describe("buildTrajectoryFeedbackBody", () => {
  test("positive → bare { positive: true } (fast-path, no message)", () => {
    expect(buildTrajectoryFeedbackBody(1, "great answer")).toEqual({
      positive: true,
    });
  });
  test("negative → { positive: false, message }", () => {
    expect(buildTrajectoryFeedbackBody(0, "wrong doc")).toEqual({
      positive: false,
      message: "wrong doc",
    });
  });
});
