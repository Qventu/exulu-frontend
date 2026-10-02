// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, test, vi } from "vitest";

import enMessages from "@/messages/en.json";

import { SkillAccessToggle } from "./skill-access-toggle";

// vitest.config.ts does not set `test.globals: true`, so testing-library's
// implicit afterEach(cleanup) registration (which depends on a global
// `afterEach`) never fires — unmount explicitly between tests, or renders
// from earlier tests in this file pile up in the same jsdom document.
afterEach(cleanup);

/**
 * The real en.json copy is loaded through NextIntlClientProvider rather than
 * mocked, so this test also guards the message keys the component depends
 * on — a key rename or deletion fails the test, not just a type check.
 */
function renderToggle(props: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SkillAccessToggle {...props} />
    </NextIntlClientProvider>,
  );
}

describe("SkillAccessToggle", () => {
  test("renders the label and the explanatory copy", () => {
    renderToggle({ checked: false, onCheckedChange: () => {} });

    expect(
      screen.getByLabelText(/allow agent access when using skills/i),
    ).toBeDefined();
    expect(screen.getByText(/never shared with skills/i)).toBeDefined();
  });

  test("reflects an off checked state", () => {
    renderToggle({ checked: false, onCheckedChange: () => {} });

    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  test("reflects an on checked state", () => {
    renderToggle({ checked: true, onCheckedChange: () => {} });

    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  test("reports the new checked state when toggled", () => {
    const onCheckedChange = vi.fn();
    renderToggle({ checked: false, onCheckedChange });

    fireEvent.click(screen.getByRole("switch"));

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  test("does not report a change when disabled", () => {
    const onCheckedChange = vi.fn();
    renderToggle({ checked: false, onCheckedChange, disabled: true });

    fireEvent.click(screen.getByRole("switch"));

    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
