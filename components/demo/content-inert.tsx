"use client";

import { useEffect } from "react";
import { installInertLayer } from "./inert-layer";

/** Makes the product non-operable during the tour — the how and why live in ./inert-layer.ts. */
export function ContentInert() {
  useEffect(() => installInertLayer(document), []);
  return null;
}
