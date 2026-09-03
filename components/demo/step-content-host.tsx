"use client";

import { createRoot, type Root } from "react-dom/client";

import type { DemoStep } from "@/lib/demo/tour";

import { StepPanel } from "./step-panel";

/**
 * React roots for Shepherd, one per step id.
 *
 * Shepherd takes an HTMLElement for a step's text, so the bridge is a detached
 * div with a React root in it. Caching matters: tour-shepherd.tsx calls
 * show() for the SAME step up to five times while an anchor settles, and a
 * fresh createRoot per call would leak a root — and its framer-motion
 * animation — on every one.
 */
const hosts = new Map<string, { el: HTMLElement; root: Root }>();

export function renderStepContent(step: DemoStep): HTMLElement {
  let host = hosts.get(step.id);
  if (!host) {
    const el = document.createElement("div");
    el.className = "demo-step-content";
    host = { el, root: createRoot(el) };
    hosts.set(step.id, host);
  }
  host.root.render(<StepPanel step={step} />);
  return host.el;
}

/**
 * Tears every root down. Called when the tour is destroyed.
 *
 * Deferred to a microtask because unmount() during React's own render phase
 * warns, and the caller is a cleanup running inside one.
 */
export function disposeStepContent(): void {
  const roots = [...hosts.values()];
  hosts.clear();
  queueMicrotask(() => {
    for (const { root } of roots) root.unmount();
  });
}
