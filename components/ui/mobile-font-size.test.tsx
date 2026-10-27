// @vitest-environment jsdom

/**
 * Regression guard for the one rule that is invisible in a desktop browser:
 * a focused form control under 16px makes iOS Safari zoom the page in, and the
 * zoomed layout viewport is wider than the screen, so the right edge of the
 * form is cut off. Reported from an iPhone on the public agent sign-in, where
 * both fields were 14px.
 *
 * These assert class names rather than computed styles on purpose — Tailwind
 * does not run in the test environment, so the class IS the contract here.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "./input";
import { Textarea } from "./textarea";

describe("form controls on mobile", () => {
  it("renders the input at 16px below md and 14px from md up", () => {
    const { container } = render(<Input aria-label="field" />);
    const className = container.querySelector("input")?.className ?? "";

    expect(className).toContain("text-base");
    expect(className).toContain("md:text-sm");
    // A bare `text-sm` would win at every width and bring the zoom back.
    expect(className).not.toMatch(/(^|\s)text-sm(\s|$)/);
  });

  it("renders the textarea at 16px below md and 14px from md up", () => {
    const { container } = render(<Textarea aria-label="field" />);
    const className = container.querySelector("textarea")?.className ?? "";

    expect(className).toContain("text-base");
    expect(className).toContain("md:text-sm");
    expect(className).not.toMatch(/(^|\s)text-sm(\s|$)/);
  });

  it("still lets a caller override the size deliberately", () => {
    const { container } = render(<Input aria-label="field" className="text-xs" />);
    expect(container.querySelector("input")?.className ?? "").toContain("text-xs");
  });
});
