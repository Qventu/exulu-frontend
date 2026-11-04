/**
 * Wire shapes for the agent-panel channel between the IMP page and an
 * artifact rendered in a sandboxed, opaque-origin iframe.
 *
 * This is a separate channel from the `exulu:identity:*` handshake (see
 * app/artifacts/[artifact_name]/artifact-frame.tsx), which stays on its own
 * version (`IDENTITY_V = 1`) and is unaffected by `CHANNEL_V` here. The host
 * tells the artifact which agents are assigned to it and how wide its
 * viewport is (`exulu:host:info`, `exulu:panel:viewport`), and reports when
 * an agent's turn made progress (`exulu:session:progress`); the artifact
 * asks for the panel to be opened with a prefilled prompt and attachments
 * (`exulu:panel:open`) and the host acknowledges (`exulu:panel:open:ack`).
 *
 * Agent ids never cross this channel: `PanelSlot` carries only the `key` an
 * owner assigned a slot (stable, used by the artifact to bind its own
 * buttons) and a `label` for display in a picker. The backend's
 * `{ key, agentId }` pairing stays server-side.
 *
 * The artifact side is authored by third parties in other repositories, so
 * `exulu:panel:open` arrives untrusted. `parseOpenPanelRequest` is the trust
 * boundary: it validates every field and builds a fresh object from the
 * validated pieces rather than returning (or spreading) its input, so
 * unknown or malformed properties on a hostile or malformed message can
 * never reach a consumer.
 */

export const CHANNEL_V = 2;

export interface PanelSlot {
  key: string;
  label: string;
}

export interface HostInfo {
  type: "exulu:host:info";
  v: number;
  panel: boolean;
  slots: PanelSlot[];
}

export interface PanelViewport {
  type: "exulu:panel:viewport";
  v: number;
  width: number;
  open: boolean;
}

export interface TurnProgress {
  type: "exulu:session:progress";
  v: number;
  reason: "tool" | "turn";
}

export interface OpenPanelRequest {
  type: "exulu:panel:open";
  v: number;
  slot: string;
  prompt?: string;
  items?: string[];
  files?: string[];
}

export interface OpenPanelAck {
  type: "exulu:panel:open:ack";
  v: number;
  slot: string;
  accepted: boolean;
  reason?: string;
}

/** A plain object guard that narrows away `null`, arrays and primitives. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Sentinel returned by `stringArrayOrUndefined` for "present but malformed" — distinct from `undefined`, which means "not present". */
const INVALID = Symbol("invalid");

function stringArrayOrUndefined(value: unknown): string[] | undefined | typeof INVALID {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return INVALID;
  if (!value.every((entry): entry is string => typeof entry === "string")) return INVALID;
  // Copy rather than alias: the result must not share mutable state with
  // whatever object the caller passed in.
  return [...value];
}

/**
 * Validates an untrusted `postMessage` payload as an `exulu:panel:open`
 * request and rebuilds it from its validated fields, or returns `null`.
 *
 * Only `CHANNEL_V` is accepted — a message stamped with the identity
 * handshake's `v: 1`, or any other version, is rejected rather than
 * interpreted.
 */
export function parseOpenPanelRequest(data: unknown): OpenPanelRequest | null {
  if (!isRecord(data)) return null;
  if (data.type !== "exulu:panel:open") return null;
  if (data.v !== CHANNEL_V) return null;
  if (typeof data.slot !== "string") return null;

  const result: OpenPanelRequest = {
    type: "exulu:panel:open",
    v: CHANNEL_V,
    slot: data.slot,
  };

  if (data.prompt !== undefined) {
    if (typeof data.prompt !== "string") return null;
    result.prompt = data.prompt;
  }

  const items = stringArrayOrUndefined(data.items);
  if (items === INVALID) return null;
  if (items !== undefined) result.items = items;

  const files = stringArrayOrUndefined(data.files);
  if (files === INVALID) return null;
  if (files !== undefined) result.files = files;

  return result;
}

/** Tells the artifact which agent slots are assigned to it and whether a panel can be opened at all. */
export function hostInfo(panel: boolean, slots: PanelSlot[]): HostInfo {
  return { type: "exulu:host:info", v: CHANNEL_V, panel, slots };
}

/** Tells the artifact how wide the agent panel's viewport is and whether it is open. */
export function panelViewport(width: number, open: boolean): PanelViewport {
  return { type: "exulu:panel:viewport", v: CHANNEL_V, width, open };
}

/** Tells the artifact an agent turn made progress — a tool call, or the whole turn finishing. */
export function turnProgress(reason: "tool" | "turn"): TurnProgress {
  return { type: "exulu:session:progress", v: CHANNEL_V, reason };
}

/** The host's reply to an `exulu:panel:open` request: whether it was accepted, and why not when it wasn't. */
export function openPanelAck(slot: string, accepted: boolean, reason?: string): OpenPanelAck {
  const ack: OpenPanelAck = { type: "exulu:panel:open:ack", v: CHANNEL_V, slot, accepted };
  if (reason !== undefined) ack.reason = reason;
  return ack;
}
