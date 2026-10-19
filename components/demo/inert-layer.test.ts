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

/**
 * Chapter 5 asks the visitor to open a citation (a6aa769 made it openable;
 * the freeze two weeks later caught it with everything else — a tester's
 * first feedback on the deployed demo). The badge, the dialog it opens and
 * the dialog's backdrop are the tour's: clicks, keys and pointer events pass.
 */
describe("installInertLayer — the citation dialog", () => {
  let uninstall: (() => void) | null = null;
  afterEach(() => {
    uninstall?.();
    uninstall = null;
    document.body.innerHTML = "";
  });
  function mount() {
    document.body.innerHTML = `
      <main>
        <input id="product-input" />
        <span id="citation" data-demo-id="chat-citation"><span id="citation-label">Software-Dokumentation #1</span></span>
      </main>
      <div id="portal">
        <div id="overlay" data-slot="dialog-overlay"></div>
        <div id="dialog" role="dialog" data-demo-id="chat-citation-dialog"><p id="dialog-text">Passage</p><button id="dialog-close">Close</button></div>
      </div>`;
    uninstall = installInertLayer(document);
  }
  /** Dispatches `type` at `id`; reports whether the default survived and whether a bubble listener on document was reached. */
  const fire = (id: string, type: string, init: EventInit = {}) => {
    let reached = false;
    const spy = () => { reached = true; };
    document.addEventListener(type, spy, false);
    const Ctor = type === "keydown" ? KeyboardEvent : MouseEvent; // jsdom has no PointerEvent; the listener keys on the type name
    const ev = new Ctor(type, { bubbles: true, cancelable: true, ...init });
    document.getElementById(id)!.dispatchEvent(ev);
    document.removeEventListener(type, spy, false);
    return { prevented: ev.defaultPrevented, reached };
  };

  it("lets the citation badge be clicked, label span included", () => {
    mount();
    expect(fire("citation", "click")).toEqual({ prevented: false, reached: true });
    expect(fire("citation-label", "click")).toEqual({ prevented: false, reached: true });
  });

  it("lets the dialog's own controls work: click, Escape, focus", () => {
    mount();
    expect(fire("dialog-close", "click")).toEqual({ prevented: false, reached: true });
    expect(fire("dialog-text", "keydown", { key: "Escape" } as EventInit)).toEqual({ prevented: false, reached: true });
    expect(fire("dialog-close", "mousedown")).toEqual({ prevented: false, reached: true });
  });

  it("lets a pointerdown on the dialog's backdrop reach Radix, which closes on outside press", () => {
    mount();
    expect(fire("overlay", "pointerdown").reached).toBe(true);
  });

  it("still mutes the product beside them", () => {
    mount();
    expect(fire("product-input", "keydown", { key: "a" } as EventInit)).toEqual({ prevented: true, reached: false });
    expect(fire("product-input", "pointerdown").reached).toBe(false);
  });
});
