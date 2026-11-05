/**
 * Turns a validated `exulu:panel:open` request into calls against the chat
 * controller: this is the last mile of the artifact-panel open-request
 * feature — the button that raises the panel with the composer already
 * filled in and the relevant documents attached, so the user reads a
 * prepared message and presses send themselves instead of an opaque
 * background routine firing on their behalf.
 *
 * `req` has already been through `parseOpenPanelRequest`
 * (lib/artifacts/agent-panel-protocol.ts) — every field here is trusted
 * shape, not raw postMessage data — and its `slot` has already been checked
 * against the assignment list by the caller. This function does not look at
 * `slot` at all; by the time it runs, "which panel" is already decided.
 *
 * Deliberately a pure orchestrator over INJECTED deps, not a hook and not a
 * `ChatSessionController` consumer directly: that is what makes it testable
 * with no React tree and no chat transport. Note what is NOT in the deps
 * shape — there is no way to submit a message. Global constraint: prefill
 * never submits. Filling the composer and stopping is what lets a user
 * verify what an agent is about to receive before they press send; handing
 * this function a send capability would undo that guarantee at the one
 * place it matters most.
 */
import type { OpenPanelRequest } from "@/lib/artifacts/agent-panel-protocol";

export interface ApplyOpenRequestDeps {
  /** Controller.seedInput — the consume-once seed channel (task 9). */
  seedInput: (text: string) => void;
  /** Controller.addSessionItems — pinned knowledge scope. */
  addSessionItems: (gids: string[]) => Promise<void>;
  /** Controller.addSessionFiles — adopts already-uploaded S3 keys. */
  addSessionFiles: (keys: string[]) => Promise<void>;
  /** Controller.setFilesPanelOpen — so the user sees what got attached. */
  setFilesPanelOpen: (open: boolean) => Promise<void>;
}

export const applyOpenRequest = async (
  req: OpenPanelRequest,
  deps: ApplyOpenRequestDeps,
): Promise<void> => {
  // Seeded FIRST and unconditionally ahead of anything below that can fail:
  // an items/files failure further down must never cost the user the prompt
  // they opened the panel to review. `seedInput` itself never throws (it is
  // a plain state setter), so this line cannot be the thing that fails.
  if (req.prompt) {
    deps.seedInput(req.prompt);
  }

  if (req.items && req.items.length > 0) {
    await deps.addSessionItems(req.items);
  }

  if (req.files && req.files.length > 0) {
    // Opened BEFORE adopting, not after: the whole point of this path
    // replacing an opaque background routine is that the user watches what
    // is about to be attached rather than discovering it afterwards — and
    // opening first means the panel is already visible even if the adopt
    // call below rejects.
    await deps.setFilesPanelOpen(true);
    await deps.addSessionFiles(req.files);
  }
};
