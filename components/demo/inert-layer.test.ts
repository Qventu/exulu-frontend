// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { installInertLayer } from "./inert-layer";

/**
 * The inert layer cancels every click outside the tour's own controls. The
 * closing scene's booking buttons live in <main>, like product controls do,
 * and were cancelled with them (the scene's former shared button was dead the
 * same way since 42d2b88). They are marked data-demo-id="booking-cta" and
 * must pass through like the panel does.
 */
describe("installInertLayer", () => {
  let uninstall: (() => void) | null = null;
  afterEach(() => {
    uninstall?.();
    uninstall = null;
    document.body.innerHTML = "";
  });

  function mount() {
    document.body.innerHTML = `
      <aside data-demo-id="tour-panel"><a id="panel-link" href="#tour">Buchen</a></aside>
      <main>
        <div class="demo-scene">
          <a id="path-cta" data-demo-id="booking-cta" class="demo-button" href="#probe-3-monate"><span id="path-cta-label">Testphase anfragen</span></a>
        </div>
        <a id="product-link" href="#data">Wissensbasis</a>
        <button id="product-button">Neues Element</button>
      </main>`;
    uninstall = installInertLayer(document);
  }

  const click = (id: string) => {
    const el = document.getElementById(id)!;
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  };

  it("lets a click on the panel's link through", () => {
    mount();
    expect(click("panel-link")).toBe(false);
  });

  it("lets a click on a scene booking button through, even on its label span", () => {
    mount();
    expect(click("path-cta")).toBe(false);
    expect(click("path-cta-label")).toBe(false);
  });

  it("still cancels a click on a product link and a product button", () => {
    mount();
    expect(click("product-link")).toBe(true);
    expect(click("product-button")).toBe(true);
  });

  it("lets a mousedown on the booking button move focus, but not on a product link", () => {
    mount();
    const down = (id: string) => {
      const ev = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
      document.getElementById(id)!.dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    expect(down("path-cta")).toBe(false);
    expect(down("product-link")).toBe(true);
  });

  it("uninstalls cleanly", () => {
    mount();
    uninstall!();
    uninstall = null;
    expect(click("product-link")).toBe(false);
  });
});
