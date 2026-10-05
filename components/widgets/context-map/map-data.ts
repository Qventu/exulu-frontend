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
export const NO_VALUE_TOKEN = "--chart-5" as const;

const hslToRgb = (h: number, s: number, l: number): Rgb => {
  // Normalize hue to 0–360 to handle negative values.
  const normalizedH = ((h % 360) + 360) % 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + normalizedH / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
};

/** Tokens are HSL triplets without the wrapper ("217 76% 54%"). */
export function parseHslTriplet(value: string): Rgb {
  const parts = value.trim().split(/\s+/);
  const h = Number.parseFloat(parts[0] ?? "NaN");
  const s = Number.parseFloat((parts[1] ?? "NaN").replace("%", "")) / 100;
  const l = Number.parseFloat((parts[2] ?? "NaN").replace("%", "")) / 100;
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

/**
 * Flagged or conflicting passages are ringed in the theme's destructive
 * colour, which the legend names. It is not part of the categorical palette:
 * the ring says something about the passage, not about its group.
 */
export const RING_TOKEN = "--destructive" as const;

/** The ring colour, read from the theme exactly as the palette is. */
export function resolveRingColor(element: Element): Rgb {
  return parseHslTriplet(getComputedStyle(element).getPropertyValue(RING_TOKEN));
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

/** Average passages per cell of the grid that answers nearest-neighbour queries. */
const CELL_OCCUPANCY = 2;
const MAX_GRID_DIVISIONS = 64;

/**
 * One line segment per passage to its nearest neighbour, as a flat position
 * buffer: the faint web the canvas draws when every link is asked for.
 *
 * A uniform grid keeps this linear in the number of passages. With roughly two
 * per cell, the 27 cells around a point hold its nearest neighbour for all but
 * the most isolated passages, and those get no segment rather than a scan of
 * the whole cloud — 20 000 passages against each other would be 400 million
 * comparisons. A mutually-nearest pair is emitted once: drawn twice it would
 * read as a brighter line, not as a duplicate.
 *
 * A passage whose stored coordinates are not finite is left out of the grid
 * and given no segment: flooring a NaN survives both clamps, so bucketing it
 * would hand the walk an index that is not in any bucket.
 */
export function nearestNeighbourSegments(points: MapPoint[]): Float32Array {
  const count = points.length;
  if (count < 2) return new Float32Array(0);

  const placeable = (p: MapPoint) =>
    Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const p of points) {
    if (!placeable(p)) continue;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  }
  // One cube side for all three axes keeps cells isotropic, so a 27-cell
  // neighbourhood is the same distance in every direction.
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1e-6);
  const divisions = Math.max(1,
    Math.min(MAX_GRID_DIVISIONS, Math.round(Math.cbrt(count / CELL_OCCUPANCY))));
  const cell = span / divisions;
  const axis = (value: number, min: number) =>
    Math.min(divisions - 1, Math.max(0, Math.floor((value - min) / cell)));

  // Singly-linked buckets: one array for the cell heads, one for the chains,
  // and no per-cell array allocation.
  const heads = new Int32Array(divisions * divisions * divisions).fill(-1);
  const chain = new Int32Array(count).fill(-1);
  for (let i = 0; i < count; i += 1) {
    const p = points[i]!;
    if (!placeable(p)) continue;
    const index = axis(p.x, minX)
      + divisions * (axis(p.y, minY) + divisions * axis(p.z, minZ));
    chain[i] = heads[index]!;
    heads[index] = i;
  }

  const nearest = new Int32Array(count).fill(-1);
  for (let i = 0; i < count; i += 1) {
    const p = points[i]!;
    if (!placeable(p)) continue;
    const ix = axis(p.x, minX);
    const iy = axis(p.y, minY);
    const iz = axis(p.z, minZ);
    let best = -1;
    let bestDistance = Infinity;
    for (let dz = -1; dz <= 1; dz += 1) {
      const z = iz + dz;
      if (!(z >= 0 && z < divisions)) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        const y = iy + dy;
        if (!(y >= 0 && y < divisions)) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const x = ix + dx;
          if (!(x >= 0 && x < divisions)) continue;
          let j = heads[x + divisions * (y + divisions * z)]!;
          while (j !== -1) {
            if (j !== i) {
              const other = points[j]!;
              const distance = (other.x - p.x) ** 2
                + (other.y - p.y) ** 2 + (other.z - p.z) ** 2;
              if (distance < bestDistance) {
                bestDistance = distance;
                best = j;
              }
            }
            j = chain[j]!;
          }
        }
      }
    }
    nearest[i] = best;
  }

  const positions = new Float32Array(count * 6);
  let cursor = 0;
  for (let i = 0; i < count; i += 1) {
    const j = nearest[i]!;
    if (j === -1 || (nearest[j] === i && j < i)) continue;
    const from = points[i]!;
    const to = points[j]!;
    positions[cursor] = from.x;
    positions[cursor + 1] = from.y;
    positions[cursor + 2] = from.z;
    positions[cursor + 3] = to.x;
    positions[cursor + 4] = to.y;
    positions[cursor + 5] = to.z;
    cursor += 6;
  }
  return positions.subarray(0, cursor);
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

/** Position (x, y) is the label's centre, not top-left. */
export type LabelBox = { id: string; x: number; y: number; width: number; height: number; count: number };

/** Greedy, largest region first: a label only survives if nothing bigger covers it. Returns IDs ordered by size (largest first), not input order. */
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

/**
 * How much of a passage the points answer carries: the resolver builds a
 * point's `label` as `LEFT(COALESCE(chunks.content, items.name), 120)`. On a
 * knowledge base a chunk runs to around two thousand characters, so what the
 * panel is handed is an opening, not the passage. Widening the answer is not
 * the alternative — the label text is already most of a multi-megabyte payload,
 * sent for every row to serve the one that gets selected — so the panel says
 * that it is an opening instead.
 */
export const PASSAGE_LABEL_LIMIT = 120;

/**
 * Whether a passage's text reaches that width, and is therefore almost
 * certainly cut. A passage exactly that long reads as cut too: nothing in the
 * answer could tell the two apart, and of the two possible mistakes, claiming
 * the text is complete is the worse one.
 */
export function isPassageClipped(label: string): boolean {
  return label.length >= PASSAGE_LABEL_LIMIT;
}

/**
 * Which region a passage belongs to, or null when it belongs to none.
 *
 * A passage carries no record of its region: the regions are k-means over the
 * fit's own sample, and the fit's last act is to assign every sampled point to
 * its nearest returned centre — so this is the same rule, extended to the
 * passages the sample never saw. A tie goes to the earlier region, so the chips
 * never flicker between two answers for the same passage.
 *
 * The same rule, not provably the same answer. A passage's coordinates are
 * stored in `real` columns while the fit clustered on double precision, so a
 * passage sitting almost exactly between two centres can fall on the other
 * side here. And the count on a chip is the fit's own, over every chunk it
 * sampled, while what dims is the capped, access-scoped answer this viewer
 * loaded: the two numbers are not meant to match.
 *
 * Nothing is attributed to a region across a non-finite coordinate — the
 * passage's or the region's. Every comparison against NaN is false, so the
 * walk starts from "no region" rather than from the first one, and a region
 * with no usable centre is simply never the nearest.
 */
export function topicOf(
  point: { x: number; y: number; z: number }, topics: MapTopic[],
): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const topic of topics) {
    const distance = (topic.x - point.x) ** 2
      + (topic.y - point.y) ** 2 + (topic.z - point.z) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = topic.id;
    }
  }
  return best;
}
