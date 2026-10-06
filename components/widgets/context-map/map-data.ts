/**
 * Every pure function behind the context map. The canvas cannot run in jsdom,
 * so everything that can be reasoned about without a GPU lives here and is
 * tested here; map-canvas.tsx keeps only the WebGL calls.
 */

export type MapPoint = {
  id: string; itemId: string; x: number; y: number; z: number;
  /**
   * The passage's opening — the matched text. NOT a title: see `pointTitle`
   * and PASSAGE_LABEL_LIMIT below for why this string so often begins with a
   * document header rather than with anything a reader would recognise.
   */
  label: string;
  /** The name of the item the passage came from, or "" for an unnamed item. */
  itemName: string;
  group: string | null; chunks: number;
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
 * colour, which the chip row names in the one entry that is not a chip. It is
 * not part of the categorical palette: the ring says something about the
 * passage, not about its region — the card's own entry is worded the same way,
 * and it is the region rather than the group because colour is no longer by
 * group at all.
 */
export const RING_TOKEN = "--destructive" as const;

/** The ring colour, read from the theme exactly as the palette is. */
export function resolveRingColor(element: Element): Rgb {
  return parseHslTriplet(getComputedStyle(element).getPropertyValue(RING_TOKEN));
}

/**
 * The outline round the dot under the pointer. The page's own text colour, so
 * it reads against every palette entry and against the page in either theme —
 * the one thing a hover affordance has to do.
 */
export const HOVER_OUTLINE_TOKEN = "--foreground" as const;

/** That outline's colour, read from the theme exactly as the ring's is. */
export function resolveHoverOutlineColor(element: Element): Rgb {
  return parseHslTriplet(getComputedStyle(element).getPropertyValue(HOVER_OUTLINE_TOKEN));
}

/**
 * The colour a region's dots take. The chips are the map's legend, so the
 * card paints their swatches from this too — through this function rather
 * than a second copy of the modulo, which is how a swatch and the dots it
 * explains drift apart.
 */
export function regionColor(palette: Palette, region: number): Rgb {
  if (region < 0) return palette.noValue;
  return palette.colors[region % Math.max(1, palette.colors.length)] ?? palette.noValue;
}

/**
 * A resolved colour as CSS, for an HTML swatch beside the cloud. The triplets
 * are sRGB in 0..1 — the space the renderer tells three.js it is reading —
 * so a byte per channel is the same colour, and an unparseable token greys
 * the swatch exactly as it greys the dot.
 */
export function rgbCss(rgb: Rgb): string {
  const channel = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 255);
  return `rgb(${channel(rgb[0])}, ${channel(rgb[1])}, ${channel(rgb[2])})`;
}

/**
 * Positions and colours as one typed array each: one draw call, no per-frame
 * work.
 *
 * A dot takes the colour of its region. The grouping value it carries is not
 * what colours it: a memory base has one such field and a knowledge base has
 * none, so colouring by it left the first real base — eleven hundred German
 * passages — a single grey blob, with the map's organising idea, its regions,
 * the one thing colour never showed. `regionOf` is the caller's region index
 * for a passage, or -1 for none, and -1 takes the palette's reserved grey.
 *
 * There are more regions than colours — twelve against seven once the violet
 * tokens are out and grey is reserved — so the index cycles. The chips carry
 * identity; colour only has to separate neighbours.
 */
export function buildBuffers(
  points: MapPoint[], regionOf: (point: MapPoint) => number, palette: Palette,
): { positions: Float32Array; colors: Float32Array } {
  const positions = new Float32Array(points.length * 3);
  const colors = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!;
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
    const rgb = regionColor(palette, regionOf(p));
    colors[i * 3] = rgb[0];
    colors[i * 3 + 1] = rgb[1];
    colors[i * 3 + 2] = rgb[2];
  }
  return { positions, colors };
}

/** The cloud's axis-aligned bounding box, in the layout's own coordinates. */
export type CloudBounds = {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
};

/**
 * The box the passages occupy, or null when none of them has a position worth
 * framing.
 *
 * A plain bounding box, with nothing trimmed off its ends. On the first real
 * base — 1134 passages — the radii run median 0.465, 90th percentile 0.813,
 * 99th 1.000, maximum 1.012: a spread, not a tight core with a few points
 * flung out, so a percentile box would frame almost the same cloud while
 * cutting off real passages at the rim.
 *
 * The box is NOT symmetric about the origin even though the layout is centred
 * on its own mean — that base runs from -0.58 to 0.95 across — which is why
 * the camera is aimed at this box's centre rather than at the origin.
 *
 * A passage whose stored coordinates are not finite is left out, exactly as
 * `nearestNeighbourSegments` leaves it out of the grid: one NaN would
 * otherwise swallow the whole box.
 */
export function cloudBounds(
  points: readonly { x: number; y: number; z: number }[],
): CloudBounds | null {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const p of points) {
    if (!(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))) continue;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  }
  if (minX === Infinity) return null;
  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
}

/**
 * The fraction of the limiting viewport dimension the cloud spans. The rest is
 * margin: a cloud that touched both edges would read as cropped, and the
 * margin also absorbs the near face of the cloud projecting slightly larger
 * than the mid-plane this fit is measured at.
 */
export const VIEWPORT_FILL = 0.85;

/**
 * How close and how far a viewer may dolly, as multiples of the framing
 * distance. Relative, not absolute: the fixed 1.2 these replace sat all but
 * exactly at the distance the first real base wants to be framed from, so
 * zooming in by hand crawled to the right framing and then stopped dead, with
 * no room left to look closer. A small cloud can now be approached and a large
 * one backed away from, in proportion to its own size.
 */
const NEAR_LIMIT_FACTOR = 0.3;
const FAR_LIMIT_FACTOR = 3;

/** A canvas with no measurable size yet is framed as if it were square. */
const FALLBACK_ASPECT = 1;

/** One passage, or every passage stacked: no extent, but the camera still needs to be somewhere. */
const DEGENERATE_DISTANCE = 1;

/**
 * The distance the map was framed from before the camera was fitted to the
 * data, and so the distance the dot sizes in map-canvas were chosen at. The
 * point shader scales a dot by 1/distance, so framing a cloud closer enlarges
 * every dot in proportion; `sizeScale` below undoes exactly that.
 */
export const FRAMING_REFERENCE_DISTANCE = 3.2;

/** Where the camera looks from, how far a viewer may dolly, and what that does to the dots. */
export type Framing = {
  center: { x: number; y: number; z: number };
  distance: number;
  minDistance: number;
  maxDistance: number;
  /**
   * Multiply a world-space size — a point size, a pick radius — by this to
   * keep it the same apparent size it had at FRAMING_REFERENCE_DISTANCE.
   */
  sizeScale: number;
};

/**
 * Where to put the camera so the cloud fills the viewport.
 *
 * `fovDegrees` is the camera's VERTICAL field of view; the horizontal one is
 * the aspect ratio times it. Each screen axis is therefore fitted against its
 * own field and the further of the two distances wins, which makes the height
 * the limiting dimension on a wide canvas and the width on a narrow one.
 *
 * Fitting one radius against the vertical field instead is what leaves a cloud
 * marooned, and is in effect what the constant distance did: this base's
 * radius is set by its width, 0.765, while its height is only 0.485, so the
 * vertical field would be asked to frame a cloud half again as tall as the one
 * it actually has to hold — and on a canvas four times wider than it is tall,
 * the width it wasted on that has four times the room to spare.
 *
 * The horizontal fit uses the larger of the x and z half-extents because the
 * map idles in an azimuthal rotation about the camera's up axis, which swings
 * depth into width and back. That rotation leaves the vertical extent exactly
 * as it is, so the fit holds for every frame of the idle spin. A viewer who
 * tilts the camera off the horizon can swing depth into the height instead and
 * push the rim past the frame — their own doing, and they can dolly back out.
 */
export function frameCloud(
  bounds: CloudBounds, aspect: number, fovDegrees: number,
): Framing {
  const center = {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
  const halfX = (bounds.max.x - bounds.min.x) / 2;
  const halfY = (bounds.max.y - bounds.min.y) / 2;
  const halfZ = (bounds.max.z - bounds.min.z) / 2;

  // Half the viewport, in world units, one unit in front of the camera.
  const perUnitHeight = Math.tan((fovDegrees * Math.PI) / 360);
  const usableAspect =
    Number.isFinite(aspect) && aspect > 0 ? aspect : FALLBACK_ASPECT;
  const perUnitWidth = perUnitHeight * usableAspect;

  const forHeight = halfY / (perUnitHeight * VIEWPORT_FILL);
  const forWidth = Math.max(halfX, halfZ) / (perUnitWidth * VIEWPORT_FILL);
  const fitted = Math.max(forHeight, forWidth);
  const distance =
    Number.isFinite(fitted) && fitted > 0 ? fitted : DEGENERATE_DISTANCE;

  return {
    center,
    distance,
    minDistance: distance * NEAR_LIMIT_FACTOR,
    maxDistance: distance * FAR_LIMIT_FACTOR,
    sizeScale: distance / FRAMING_REFERENCE_DISTANCE,
  };
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
 * What to call a point on screen.
 *
 * Never its `label`. That is the first 120 characters of the chunk, and this
 * product's ingestion injects a document header into every chunk — so the
 * opening reads `--- Document (Exulu ID: 6adc924b-…) ---` and a tooltip, a
 * panel heading or a neighbour row taken from it shows an identifier. The
 * item's name is what a reader calls the thing.
 *
 * NOT the opening, even when `itemName` is blank. `name` is nullable on an
 * items table, and falling back to `label` here is exactly the bug a blank
 * name exposed: in PASSAGES mode the "opening" IS that injected document
 * header, so the fallback showed the identifier right back, and a heading
 * taken from it duplicated the body text rendered immediately below it.
 * Returning "" and letting each call site render its own translated
 * "Untitled item" is the fix — this function is pure and lives in map-data,
 * so it cannot reach next-intl itself.
 */
export function pointTitle(point: { itemName: string; label: string }): string {
  return point.itemName.trim() === "" ? "" : point.itemName;
}

/**
 * The neighbour list with one row per item, each keeping its strongest
 * passage.
 *
 * The edges answer is per PASSAGE, so a document chunked into four pieces
 * comes back as four neighbours — and the panel listed its name four times.
 * A row therefore now counts an ITEM, not a chunk, and the list can be
 * shorter than the number of relations the API was asked for. The edge the
 * row carries is still a single passage's, so the line drawn on the cloud and
 * the score behind the row are the strongest passage's, not an aggregate.
 *
 * An edge whose target is not among the points is left alone: the edges query
 * does not filter to passages that have a position and the cloud is capped
 * anyway, so such a row is a real relation whose item is simply unknown here
 * and cannot be folded into anything. Keyed by its target, so it stays one
 * row per relation exactly as before.
 */
export function strongestPerItem(
  edges: MapEdge[], byId: Map<string, MapPoint>,
): MapEdge[] {
  // Insertion-ordered, so the sort below only has to settle the cases the
  // answer's own order does not already.
  const best = new Map<string, MapEdge>();
  for (const edge of edges) {
    const neighbour = byId.get(edge.target);
    const key = neighbour === undefined ? `#${edge.target}` : neighbour.itemId;
    const kept = best.get(key);
    if (kept === undefined || edge.score > kept.score) best.set(key, edge);
  }
  // Array.prototype.sort is stable, so items whose strongest passage ties keep
  // the order the answer gave them.
  return Array.from(best.values()).sort((a, b) => b.score - a.score);
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

/**
 * The point cloud's dot sizes, and the hovered dot's outline width. These
 * five are used by map-canvas.tsx's point-size shaders (gl_PointSize = size *
 * pixelRatio * 300/-mv.z, there) and imported back, rather than declared in
 * that file, because HOVER_SIZE's nesting guarantee against the ring is pure
 * arithmetic and is the one invariant among them worth testing — and
 * map-canvas.tsx has no tests, by design: jsdom has no WebGL context.
 */

/**
 * gl_PointSize is in device pixels; see the pixelRatio factor in the point
 * shader (map-canvas.tsx). This is the size that reads well at
 * FRAMING_REFERENCE_DISTANCE, and the framing effect scales it by
 * `sizeScale` so a dot keeps that apparent size however close the camera
 * ends up.
 */
export const POINT_SIZE = 0.035;

/** Wide enough that the ring's annulus sits around the dot rather than on top of it. */
export const RING_SIZE = POINT_SIZE * 2.2;

/** Ringed passages: an annulus, so the dot's own colour still reads through it. */
export const RING_INNER_RADIUS = 0.34;

/**
 * The sprite the hovered dot is drawn on.
 *
 * Capped at the ring layer's inner edge — RING_SIZE × RING_INNER_RADIUS, as
 * a diameter — so that growing the dot never paints over the conflict ring a
 * viewer is leaning in to read. Written as one expression against those two,
 * because widening the ring is exactly the change that would break the
 * nesting silently.
 */
export const HOVER_SIZE = Math.min(POINT_SIZE * 1.5, RING_SIZE * RING_INNER_RADIUS * 2);

/**
 * The fraction of the hovered dot's sprite RADIUS that its outline takes, in
 * map-canvas.tsx's HOVER_FRAGMENT, which paints outline wherever
 * d > 0.5 × (1 − this).
 *
 * Radius, not diameter — the two differ by 2× and the earlier wording used
 * both in one sentence. At FRAMING_REFERENCE_DISTANCE and DPR 1 the hovered
 * sprite renders at HOVER_SIZE × 300/FRAMING_REFERENCE_DISTANCE ≈ 4.91 CSS px
 * across, so its radius is ≈2.46 CSS px and the rim is this × 2.46, per side:
 *
 *   0.2 → ≈0.49 CSS px — half a device pixel, hard-edged with no antialiasing
 *         to soften it, which did not read as a hover state at all.
 *   0.4 → ≈0.98 CSS px, with a fill diameter of (1 − 0.4) × ≈4.91 ≈ 2.95 px.
 *
 * ≈1 CSS px is the most a rim can take here: HOVER_SIZE is already capped at
 * the conflict ring's inner edge, so the sprite cannot grow, and past ≈0.5 the
 * fill stops reading as the dot's region colour. A bolder hover state needs a
 * larger POINT_SIZE cloud-wide, not a larger value here.
 */
export const HOVER_OUTLINE_WIDTH = 0.4;
