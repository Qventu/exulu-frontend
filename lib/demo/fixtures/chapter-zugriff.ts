import type { DemoWorld } from "../types";
import { aufnahmeWorld } from "./chapter-aufnahme";

/**
 * Chapter 4 — who may read what.
 *
 * Deliberately the COMPLETED ingestion world: the chapter opens on the same
 * knowledge base the previous chapter just filled, so the permissions being
 * set are visibly the permissions on documents the visitor watched arrive.
 * Reusing the last step of chapter 3 rather than rebuilding it also means the
 * two chapters cannot drift apart.
 */
export function zugriffWorld(_step: number): DemoWorld {
  return aufnahmeWorld(3);
}
