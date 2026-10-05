/**
 * Every pure function behind the context map. The canvas cannot run in jsdom,
 * so everything that can be reasoned about without a GPU lives here and is
 * tested here; map-canvas.tsx keeps only the WebGL calls.
 */

export type MapPoint = {
  id: string; itemId: string; x: number; y: number; z: number;
  label: string; group: string | null; chunks: number;
};
export type MapTopic = { id: string; label: string; count: number; x: number; y: number; z: number };
export type MapEdge = { source: string; target: string; score: number };
export type Rgb = [number, number, number];
export type Palette = { colors: Rgb[]; noValue: Rgb };

/**
 * The categorical palette, in order. --chart-2 (258°) and --chart-9 (292°) are
 * violet and are deliberately absent; --chart-5 is grey and is reserved below
 * for points with no value.
 */
export const PALETTE_TOKENS = [
  "--chart-4", "--chart-1", "--chart-8", "--chart-7", "--chart-6", "--chart-3", "--chart-10",
] as const;
export const NO_VALUE_TOKEN = "--chart-5";

const hslToRgb = (h: number, s: number, l: number): Rgb => {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
};

/** Tokens are HSL triplets without the wrapper ("217 76% 54%"). */
export function parseHslTriplet(value: string): Rgb {
  const parts = value.trim().split(/\s+/);
  const h = Number.parseFloat(parts[0] ?? "0");
  const s = Number.parseFloat((parts[1] ?? "0").replace("%", "")) / 100;
  const l = Number.parseFloat((parts[2] ?? "0").replace("%", "")) / 100;
  if (![h, s, l].every(Number.isFinite)) return [0.5, 0.5, 0.5];
  return hslToRgb(h, s, l);
}

/**
 * WebGL cannot read CSS variables, so the palette is resolved from the theme
 * once per mount and again whenever the theme changes.
 */
export function resolvePalette(element: Element): Palette {
  const style = getComputedStyle(element);
  return {
    colors: PALETTE_TOKENS.map((token) => parseHslTriplet(style.getPropertyValue(token))),
    noValue: parseHslTriplet(style.getPropertyValue(NO_VALUE_TOKEN)),
  };
}

/** Positions and colours as one typed array each: one draw call, no per-frame work. */
export function buildBuffers(
  points: MapPoint[], groups: string[], palette: Palette,
): { positions: Float32Array; colors: Float32Array } {
  const positions = new Float32Array(points.length * 3);
  const colors = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!;
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
    const declared = p.group == null ? -1 : groups.indexOf(p.group);
    const rgb = declared < 0
      ? palette.noValue
      : (palette.colors[declared % Math.max(1, palette.colors.length)] ?? palette.noValue);
    colors[i * 3] = rgb[0];
    colors[i * 3 + 1] = rgb[1];
    colors[i * 3 + 2] = rgb[2];
  }
  return { positions, colors };
}

/** Projects a world position with a column-major 4×4 matrix, for HTML overlays. */
export function projectToScreen(
  p: { x: number; y: number; z: number }, matrix: number[], width: number, height: number,
): { x: number; y: number; visible: boolean } {
  const m = (i: number) => matrix[i] ?? 0;
  const cx = m(0) * p.x + m(4) * p.y + m(8) * p.z + m(12);
  const cy = m(1) * p.x + m(5) * p.y + m(9) * p.z + m(13);
  const cw = m(3) * p.x + m(7) * p.y + m(11) * p.z + m(15);
  if (!Number.isFinite(cw) || cw <= 0) return { x: 0, y: 0, visible: false };
  return {
    x: ((cx / cw) * 0.5 + 0.5) * width,
    y: (0.5 - (cy / cw) * 0.5) * height,
    visible: true,
  };
}

export type LabelBox = { id: string; x: number; y: number; width: number; height: number; count: number };

/** Greedy, largest region first: a label only survives if nothing bigger covers it. */
export function resolveLabelCollisions(labels: LabelBox[]): string[] {
  const kept: LabelBox[] = [];
  for (const label of [...labels].sort((a, b) => b.count - a.count)) {
    const overlaps = kept.some((k) =>
      Math.abs(k.x - label.x) * 2 < k.width + label.width &&
      Math.abs(k.y - label.y) * 2 < k.height + label.height);
    if (!overlaps) kept.push(label);
  }
  return kept.map((l) => l.id);
}

export function legendEntries(groups: string[]): { value: string; index: number }[] {
  return groups.map((value, index) => ({ value, index }));
}

/** What the card says under the cloud, or nothing when there is nothing to admit. */
export function coverageCaption({
  drawn, total, sampled, mapped, totalChunks,
}: { drawn: number; total: number; sampled: boolean; mapped: number; totalChunks: number }):
  { key: string; values: Record<string, number> } | null {
  if (sampled) return { key: "caption.sampled", values: { drawn, total } };
  if (totalChunks > mapped) return { key: "caption.partial", values: { missing: totalChunks - mapped } };
  return null;
}
