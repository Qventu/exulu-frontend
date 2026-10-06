"use client";

/**
 * The point cloud. Plain three.js in one effect: a single Points object for
 * every passage, a second drawn over it for the ringed ones, a third holding
 * only the dot under the pointer, one LineSegments for the selected node's
 * neighbours, another for the faint nearest-neighbour web, and HTML overlays
 * for the topic labels so they use the page's own type tokens.
 *
 * No test covers this file — jsdom has no WebGL context. Everything that can be
 * reasoned about without a GPU lives in ./map-data and is tested there, so what
 * is left here is the WebGL wiring, the animation loop and their teardown.
 */

import { useTranslations } from "next-intl";
import * as React from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
  buildBuffers,
  cloudBounds,
  frameCloud,
  HOVER_OUTLINE_WIDTH,
  HOVER_SIZE,
  nearestNeighbourSegments,
  pointTitle,
  POINT_SIZE,
  projectToScreen,
  regionColor,
  resolveHoverOutlineColor,
  resolveLabelCollisions,
  resolvePalette,
  resolveRingColor,
  RING_INNER_RADIUS,
  RING_SIZE,
  type MapEdge,
  type MapPoint,
  type MapTopic,
  type Palette,
  type Rgb,
} from "./map-data";

export interface MapCanvasProps {
  points: MapPoint[];
  topics: MapTopic[];
  /**
   * The region a passage belongs to, as an index into the palette, or -1 for
   * none. The card derives it from the region centres with the same rule it
   * dims by, so a dot's colour and its chip cannot disagree. Memoised there,
   * so this effect may depend on its identity.
   */
  regionOf: (point: MapPoint) => number;
  edges: MapEdge[];
  selectedId: string | null;
  highlightTopic: string | null;
  /**
   * The passages belonging to `highlightTopic`, which only the card can know:
   * a MapPoint carries its grouping value, never its region, so membership is
   * derived from the region centres by `topicOf`. Everything outside this set
   * dims while a region is highlighted. Memoised by the card, so this effect
   * may depend on its identity.
   */
  topicMemberIds: Set<string>;
  ringedIds: Set<string>;
  paused: boolean;
  /** Faint nearest-neighbour lines for every passage, not only the selected one. */
  allLinks: boolean;
  /** A neighbour hovered in the panel; its line is drawn at full strength. */
  hoverNeighbourId: string | null;
  onSelect: (id: string | null) => void;
  onUnsupported: () => void;
}

/** The card resets the camera through this, so its button never remounts the scene. */
export interface MapCanvasHandle {
  reset: () => void;
}

/** Round dots without a texture: discard anything outside the point's circle. */
const POINT_VERTEX = `
  attribute vec3 color;
  attribute float dim;
  varying vec3 vColor;
  varying float vDim;
  uniform float size;
  uniform float pixelRatio;
  void main() {
    vColor = color;
    vDim = dim;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * pixelRatio * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const POINT_FRAGMENT = `
  varying vec3 vColor;
  varying float vDim;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    if (dot(d, d) > 0.25) discard;
    gl_FragColor = vec4(vColor, vDim);
  }
`;

/** Ringed passages: an annulus, so the dot's own colour still reads through it. */
const RING_VERTEX = `
  uniform float size;
  uniform float pixelRatio;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * pixelRatio * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const RING_FRAGMENT = `
  uniform vec3 ring;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5 || d < ${RING_INNER_RADIUS.toFixed(2)}) discard;
    gl_FragColor = vec4(ring, 1.0);
  }
`;

/**
 * The hovered dot: a disc in the dot's own colour with a band of the page's
 * text colour round its rim, so the dot is both bigger and outlined and is
 * still recognisably the dot that was there.
 *
 * Its own layer, for the same reason the rings have one — a buffer of one
 * vertex, so a pointer move never re-uploads the cloud's positions or colours.
 * It shares RING_VERTEX: a point sprite's size is the only thing either layer
 * asks the vertex stage for.
 *
 * Deliberately NOT a displacement of the dots around it. A dot's position IS
 * its similarity to everything near it, so pushing neighbours aside would make
 * the map lie at the exact moment someone is reading it closely.
 *
 * Two constants shape it: HOVER_OUTLINE_WIDTH, the band of the sprite's
 * radius the outline takes, and HOVER_SIZE, which sizes the sprite itself.
 * Both live in ./map-data, with POINT_SIZE, RING_SIZE and RING_INNER_RADIUS,
 * because HOVER_SIZE's nesting guarantee against the ring is pure
 * arithmetic and is the one invariant among them worth testing — and this
 * file has none, by design.
 */
const HOVER_FRAGMENT = `
  uniform vec3 fill;
  uniform vec3 outline;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    gl_FragColor = vec4(d > ${(0.5 * (1 - HOVER_OUTLINE_WIDTH)).toFixed(3)} ? outline : fill, 1.0);
  }
`;

/** Vertical field of view, in degrees; `frameCloud` fits the cloud to it. */
const CAMERA_FOV_DEGREES = 50;
/**
 * The clip planes. The layout is normalised to a 99th-percentile radius of 1,
 * so a cloud is about a unit across and the distances `frameCloud` derives
 * from it are a small multiple of that: these bound the whole dolly range with
 * room to spare, rather than being fitted to any one base.
 */
const CAMERA_NEAR = 0.01;
const CAMERA_FAR = 100;
/**
 * Where the camera waits until the framing effect fits it to the data. An
 * empty base has nothing to frame and nothing to see; this only has to be a
 * non-zero offset, so OrbitControls has something to orbit.
 */
const UNFRAMED_CAMERA_DISTANCE = 1;
/** Scaled by `sizeScale` too, so the pick radius stays constant on screen. */
const PICK_THRESHOLD = 0.03;
/** A click that moved further than this was an orbit drag, not a selection. */
const DRAG_SLOP_PX = 4;
/** Overlay work runs at ten frames a second, not sixty. */
const OVERLAY_INTERVAL_MS = 100;
/** Caps the frame delta so a backgrounded tab does not resume with a lurch. */
const MAX_FRAME_SECONDS = 0.1;
/** Label box estimate for the collision pass, in CSS pixels. */
const LABEL_CHAR_WIDTH = 7;
const LABEL_HEIGHT = 16;
/**
 * The plate the label text sits on, added to the collision box so two labels
 * are kept apart by their plates rather than by their text.
 *
 * COUPLED TO THE SPAN'S PADDING CLASSES, which are `px-1.5 py-0.5` at the
 * bottom of this file: 1.5 and 0.5 on Tailwind's 4px scale, both sides, so 12
 * horizontal and 4 vertical. Change the classes and these go stale silently —
 * the labels keep rendering, they just start overlapping again, which is the
 * failure mode that is easiest to ship and hardest to notice.
 */
const LABEL_PLATE_PAD_X = 12;
const LABEL_PLATE_PAD_Y = 4;
const SELECTED_LINE_OPACITY = 0.75;
const WEB_LINE_OPACITY = 0.12;

const DIM_SELECTED = 1;
const DIM_MUTED = 0.15;
const DIM_NORMAL = 0.85;

/**
 * One dim value per point: `DIM_SELECTED` for the selected point,
 * `DIM_MUTED` outside a highlighted region — unless the point is ringed, a
 * ringed passage stays bright — and `DIM_NORMAL` otherwise.
 *
 * Pulled out of the positions/colours effect's `write` so a chip hover can
 * recompute just this array, in the dim-only effect below, without
 * rebuilding the cloud's positions and colours: `highlightTopic` and
 * `topicMemberIds` fed this loop and nothing else, so running `write` in
 * full on every hover re-uploaded positions and colours that had not moved —
 * ~140 KB at the card's default point limit, twice per chip crossed — and
 * dropped the whole cloud back to full brightness between each pair while
 * it did.
 */
function computeDim(
  points: MapPoint[],
  highlightTopic: string | null,
  topicMemberIds: Set<string>,
  selectedId: string | null,
  ringed: Set<string>,
): Float32Array {
  const dim = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i]!;
    const muted =
      highlightTopic !== null &&
      !topicMemberIds.has(point.id) &&
      !ringed.has(point.id);
    dim[i] =
      selectedId === point.id
        ? DIM_SELECTED
        : muted
          ? DIM_MUTED
          : DIM_NORMAL;
  }
  return dim;
}

/**
 * `id` is carried so the hovered-dot layer can key its effect on the DOT
 * rather than on this state, which is rewritten ten times a second while the
 * cloud turns under a still pointer.
 */
type Hover = { id: string; name: string; x: number; y: number } | null;
type Label = { id: string; label: string; x: number; y: number };
/** A LabelBox for resolveLabelCollisions, carrying the text through with it. */
type LabelCandidate = Label & {
  width: number;
  height: number;
  count: number;
};

export const MapCanvas = React.forwardRef<MapCanvasHandle, MapCanvasProps>(
  function MapCanvas(
    {
      points,
      topics,
      regionOf,
      edges,
      selectedId,
      highlightTopic,
      topicMemberIds,
      ringedIds,
      paused,
      allLinks,
      hoverNeighbourId,
      onSelect,
      onUnsupported,
    },
    ref,
  ) {
    const t = useTranslations("map");
    const hostRef = React.useRef<HTMLDivElement | null>(null);
    const layerRef = React.useRef<HTMLDivElement | null>(null);
    const cloudRef = React.useRef<THREE.Points<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    > | null>(null);
    const linesRef = React.useRef<THREE.LineSegments<
      THREE.BufferGeometry,
      THREE.LineBasicMaterial
    > | null>(null);
    const webRef = React.useRef<THREE.LineSegments<
      THREE.BufferGeometry,
      THREE.LineBasicMaterial
    > | null>(null);
    const ringsRef = React.useRef<THREE.Points<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    > | null>(null);
    /** One vertex: the dot under the pointer, or none. */
    const hoverDotRef = React.useRef<THREE.Points<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    > | null>(null);
    const cameraRef = React.useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = React.useRef<OrbitControls | null>(null);
    const raycasterRef = React.useRef<THREE.Raycaster | null>(null);
    const pointerRef = React.useRef<{ x: number; y: number } | null>(null);
    /**
     * The palette and the hover outline colour, refreshed by the
     * positions/colours effect below whenever it actually runs — on a data
     * change or a theme change — and read, never re-resolved, by
     * `paintHoveredDot`. The cloud auto-rotates under a still pointer, so
     * the dot under it changes on its own: without this, `paintHoveredDot`
     * called `getComputedStyle` twice a time, up to ten times a second,
     * for values only a theme change can alter.
     */
    const themeCacheRef = React.useRef<{ palette: Palette; outline: Rgb } | null>(
      null,
    );
    const hoverKeyRef = React.useRef("");
    const labelKeyRef = React.useRef("");
    const [labels, setLabels] = React.useState<Label[]>([]);
    const [hover, setHover] = React.useState<Hover>(null);

    /** The box the camera is framed to, measured once per set of points. */
    const bounds = React.useMemo(() => cloudBounds(points), [points]);

    /**
     * The framing effect depends on the box's NUMBERS rather than on the
     * memo's identity, for the same reason `ringedKey` exists below:
     * `cache-and-network` hands the points answer a new identity on every
     * refetch, and a background refetch snapping the camera back to its
     * framing mid-orbit is precisely what must not happen.
     */
    const boundsKey = bounds
      ? [
          bounds.min.x, bounds.min.y, bounds.min.z,
          bounds.max.x, bounds.max.y, bounds.max.z,
        ].join(",")
      : "";

    // The scene is built once, so the loop and the click handler would otherwise
    // keep hit-testing the first render's cloud for ever. They read props from
    // here instead of from their own closure.
    const latestRef = React.useRef({
      points,
      topics,
      ringedIds,
      bounds,
      onSelect,
      onUnsupported,
      t,
      /**
       * The dot under the pointer, for the colour effect's theme re-read to
       * repaint. Through this ref and not through that effect's dependencies,
       * or a pointer move would re-upload the whole cloud — which is the
       * entire reason this ref exists.
       */
      hovered: null as MapPoint | null,
      /**
       * For the positions/colours effect's `write`, which the theme-change
       * observer keeps calling long after a chip hover last ran that effect:
       * `highlightTopic` and `topicMemberIds` are no longer that effect's own
       * dependencies (see the dim-only effect below), so without this a theme
       * change after a hover would repaint using whichever region was
       * highlighted the last time positions and colours actually rebuilt.
       */
      highlightTopic,
      topicMemberIds,
    });
    React.useEffect(() => {
      latestRef.current = {
        ...latestRef.current,
        points,
        topics,
        ringedIds,
        bounds,
        onSelect,
        onUnsupported,
        t,
        highlightTopic,
        topicMemberIds,
      };
    });

    React.useImperativeHandle(
      ref,
      () => ({ reset: () => controlsRef.current?.reset() }),
      [],
    );

    /**
     * One lookup map per set of points, not one per hovered neighbour: the
     * edge effect below re-runs on every panel hover, and rebuilding twenty
     * thousand entries each time is the same churn `ringedKey` removes from
     * the buffer path.
     */
    const byId = React.useMemo(
      () => new Map(points.map((point) => [point.id, point])),
      [points],
    );

    /**
     * The colour and ring effects below depend on this set's CONTENTS rather
     * than its identity. The card memoises it, but it derives it from the
     * points answer, and `cache-and-network` hands that answer a new identity
     * on every refetch — so a Set holding exactly the same ids arrives
     * regularly, and must not re-upload a buffer.
     */
    const ringedKey = React.useMemo(
      () => Array.from(ringedIds).sort().join("\u0000"),
      [ringedIds],
    );

    // One scene for the life of the component. Data changes rewrite geometry;
    // they never rebuild this.
    React.useEffect(() => {
      const host = hostRef.current;
      const layer = layerRef.current;
      if (!host || !layer) return;

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        latestRef.current.onUnsupported();
        return;
      }
      const measure = () => ({
        width: Math.max(1, host.clientWidth),
        height: Math.max(1, host.clientHeight),
      });
      const ratio = () => Math.min(window.devicePixelRatio || 1, 2);
      const size = measure();
      renderer.setPixelRatio(ratio());
      renderer.setSize(size.width, size.height);
      layer.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        CAMERA_FOV_DEGREES,
        size.width / size.height,
        CAMERA_NEAR,
        CAMERA_FAR,
      );
      camera.position.set(0, 0, UNFRAMED_CAMERA_DISTANCE);
      cameraRef.current = camera;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.autoRotateSpeed = 0.6;
      // The dolly limits are a multiple of the distance the cloud is framed
      // from, so the framing effect below owns them. Until it runs there is no
      // cloud to clamp against, and OrbitControls' own 0..Infinity will do.
      controls.saveState();
      controlsRef.current = controls;

      const cloudMaterial = new THREE.ShaderMaterial({
        vertexShader: POINT_VERTEX,
        fragmentShader: POINT_FRAGMENT,
        uniforms: {
          size: { value: POINT_SIZE },
          pixelRatio: { value: ratio() },
        },
        transparent: true,
        depthWrite: false,
      });
      const cloud = new THREE.Points(new THREE.BufferGeometry(), cloudMaterial);
      // The camera is framed to this cloud, so it is always on screen; culling
      // it against a bounding sphere only risks dropping it while a buffer
      // write is pending.
      cloud.frustumCulled = false;
      scene.add(cloud);
      cloudRef.current = cloud;

      const lines = new THREE.LineSegments(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: SELECTED_LINE_OPACITY,
          depthWrite: false,
        }),
      );
      lines.frustumCulled = false;
      scene.add(lines);
      linesRef.current = lines;

      const web = new THREE.LineSegments(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({
          transparent: true,
          opacity: WEB_LINE_OPACITY,
          depthWrite: false,
        }),
      );
      web.frustumCulled = false;
      scene.add(web);
      webRef.current = web;

      const ringMaterial = new THREE.ShaderMaterial({
        vertexShader: RING_VERTEX,
        fragmentShader: RING_FRAGMENT,
        uniforms: {
          size: { value: RING_SIZE },
          pixelRatio: { value: ratio() },
          // A Vector3, not a Color: the shader writes gl_FragColor itself, so
          // the sRGB triple has to reach it unconverted, exactly as the
          // cloud's vertex colours do.
          ring: { value: new THREE.Vector3() },
        },
        transparent: true,
        depthWrite: false,
      });
      const rings = new THREE.Points(new THREE.BufferGeometry(), ringMaterial);
      rings.frustumCulled = false;
      // Nothing in this scene writes depth, so the order is the render order:
      // a flagged passage must never be painted under an ordinary one.
      rings.renderOrder = 1;
      scene.add(rings);
      ringsRef.current = rings;

      const hoverMaterial = new THREE.ShaderMaterial({
        // The size-only vertex stage the rings already use.
        vertexShader: RING_VERTEX,
        fragmentShader: HOVER_FRAGMENT,
        uniforms: {
          size: { value: HOVER_SIZE },
          pixelRatio: { value: ratio() },
          // Vector3s for the same reason the ring's colour is one: the shader
          // writes gl_FragColor itself, so the sRGB triples have to reach it
          // unconverted.
          fill: { value: new THREE.Vector3() },
          outline: { value: new THREE.Vector3() },
        },
        transparent: true,
        depthWrite: false,
      });
      const hoverDot = new THREE.Points(
        new THREE.BufferGeometry(),
        hoverMaterial,
      );
      // One vertex, allocated once: `paintHoveredDot` writes into this same
      // attribute's array on every hover change instead of swapping in a
      // fresh BufferGeometry, which is what a pointer held still over an
      // auto-rotating cloud used to do up to ten times a second. `visible`
      // stands in for "no dot hovered" — the attribute is always sized for
      // one point, never for zero.
      hoverDot.geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(3), 3),
      );
      hoverDot.visible = false;
      hoverDot.frustumCulled = false;
      // Above the rings, which are above the cloud: the dot under the pointer
      // is the one thing nothing else may be painted over. HOVER_SIZE keeps it
      // inside the ring's annulus, so a flagged dot keeps its ring as well.
      hoverDot.renderOrder = 2;
      scene.add(hoverDot);
      hoverDotRef.current = hoverDot;

      const raycaster = new THREE.Raycaster();
      raycaster.params.Points.threshold = PICK_THRESHOLD;
      raycasterRef.current = raycaster;

      // Reused by the overlay pass: ten times a second is still ten allocations
      // a second for each of these.
      const ndc = new THREE.Vector2();
      const viewProjection = new THREE.Matrix4();
      const hits: THREE.Intersection[] = [];

      const hitTest = (clientX: number, clientY: number): MapPoint | null => {
        const bounds = renderer.domElement.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return null;
        ndc.set(
          ((clientX - bounds.left) / bounds.width) * 2 - 1,
          -((clientY - bounds.top) / bounds.height) * 2 + 1,
        );
        raycaster.setFromCamera(ndc, camera);
        hits.length = 0;
        raycaster.intersectObject(cloud, false, hits);
        const index = hits[0]?.index;
        return typeof index === "number"
          ? (latestRef.current.points[index] ?? null)
          : null;
      };

      let frame = 0;
      let lastOverlay = 0;
      let lastFrame = 0;
      let pressX = 0;
      let pressY = 0;
      let dragged = false;

      const onPointerDown = (event: PointerEvent) => {
        pressX = event.clientX;
        pressY = event.clientY;
        dragged = false;
      };
      const onPointerMove = (event: PointerEvent) => {
        pointerRef.current = { x: event.clientX, y: event.clientY };
        if (
          event.buttons !== 0 &&
          (Math.abs(event.clientX - pressX) > DRAG_SLOP_PX ||
            Math.abs(event.clientY - pressY) > DRAG_SLOP_PX)
        ) {
          dragged = true;
        }
      };
      const onPointerLeave = () => {
        pointerRef.current = null;
        hoverKeyRef.current = "";
        // The hit test only runs with the overlay pass, so the cursor is
        // cleared here rather than waiting up to OVERLAY_INTERVAL_MS to
        // discover that the pointer has gone.
        renderer.domElement.style.cursor = "";
        setHover(null);
      };
      const onClick = (event: MouseEvent) => {
        // Releasing an orbit drag also fires a click; it must not clear the
        // selection.
        if (dragged) return;
        const hit = hitTest(event.clientX, event.clientY);
        latestRef.current.onSelect(hit?.id ?? null);
      };
      const onContextLost = (event: Event) => {
        event.preventDefault();
        cancelAnimationFrame(frame);
        latestRef.current.onUnsupported();
      };

      const canvas = renderer.domElement;
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerleave", onPointerLeave);
      canvas.addEventListener("click", onClick);
      canvas.addEventListener("webglcontextlost", onContextLost);

      const resize = new ResizeObserver(() => {
        if (!host.clientWidth || !host.clientHeight) return;
        const next = ratio();
        renderer.setPixelRatio(next);
        cloudMaterial.uniforms.pixelRatio.value = next;
        ringMaterial.uniforms.pixelRatio.value = next;
        hoverMaterial.uniforms.pixelRatio.value = next;
        camera.aspect = host.clientWidth / host.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(host.clientWidth, host.clientHeight);
      });
      resize.observe(host);

      // Labels and the hover read-out are React state, so the overlay pass runs
      // at about ten frames a second rather than sixty, and only writes state
      // when the rounded screen positions actually changed: a still camera
      // re-renders nothing.
      const tick = (now: number) => {
        frame = requestAnimationFrame(tick);
        // OrbitControls falls back to a fixed per-frame increment when it is
        // given no delta, which ties the idle rotation to the display's
        // refresh rate: half a revolution's difference between 60 and 120 Hz.
        // Clamped, so a backgrounded tab does not resume with a lurch.
        const delta = lastFrame
          ? Math.min((now - lastFrame) / 1000, MAX_FRAME_SECONDS)
          : 0;
        lastFrame = now;
        controls.update(delta);
        renderer.render(scene, camera);
        if (now - lastOverlay < OVERLAY_INTERVAL_MS) return;
        lastOverlay = now;

        const width = host.clientWidth;
        const height = host.clientHeight;
        if (!width || !height) return;
        // render() has just refreshed matrixWorldInverse, so this is the matrix
        // the frame on screen was drawn with. projectToScreen reads the
        // elements column-major, exactly as three stores them.
        const matrix = viewProjection.multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse,
        ).elements;

        const pointer = pointerRef.current;
        const hovered = pointer ? hitTest(pointer.x, pointer.y) : null;
        // A dot is clickable, so it says so. Written only on a change: this
        // runs ten times a second.
        const cursor = hovered ? "pointer" : "";
        if (renderer.domElement.style.cursor !== cursor) {
          renderer.domElement.style.cursor = cursor;
        }
        let nextHover: Hover = null;
        if (hovered) {
          const screen = projectToScreen(hovered, matrix, width, height);
          if (screen.visible) {
            nextHover = {
              id: hovered.id,
              // The item's name, not the passage's opening: the opening begins
              // with an injected document header on a real base. pointTitle
              // returns "" for a blank name — never the opening — so the
              // translated fallback is rendered here, not inside it.
              name: pointTitle(hovered) || latestRef.current.t("panel.untitled"),
              x: screen.x,
              y: screen.y,
            };
          }
        }
        const hoverKey = nextHover
          ? `${hovered?.id}:${Math.round(nextHover.x)}:${Math.round(nextHover.y)}`
          : "";
        if (hoverKey !== hoverKeyRef.current) {
          hoverKeyRef.current = hoverKey;
          setHover(nextHover);
        }

        const boxes: LabelCandidate[] = [];
        for (const topic of latestRef.current.topics) {
          const screen = projectToScreen(topic, matrix, width, height);
          if (!screen.visible) continue;
          boxes.push({
            id: topic.id,
            label: topic.label,
            x: screen.x,
            y: screen.y,
            width: topic.label.length * LABEL_CHAR_WIDTH + LABEL_PLATE_PAD_X,
            height: LABEL_HEIGHT + LABEL_PLATE_PAD_Y,
            count: topic.count,
          });
        }
        // resolveLabelCollisions answers largest-region-first; the overlay keeps
        // the topics' own order so React is not re-keying the list every pass.
        const keep = new Set(resolveLabelCollisions(boxes));
        const nextLabels = boxes
          .filter((box) => keep.has(box.id))
          .map((box) => ({
            id: box.id,
            label: box.label,
            x: box.x,
            y: box.y,
          }));
        const labelKey = nextLabels
          .map(
            (label) =>
              `${label.id}:${Math.round(label.x)}:${Math.round(label.y)}`,
          )
          .join("|");
        if (labelKey !== labelKeyRef.current) {
          labelKeyRef.current = labelKey;
          setLabels(nextLabels);
        }
      };
      frame = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(frame);
        resize.disconnect();
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerleave", onPointerLeave);
        canvas.removeEventListener("click", onClick);
        canvas.removeEventListener("webglcontextlost", onContextLost);
        controls.dispose();
        // The geometries read here are whatever the data effects left behind,
        // not the empty ones created above.
        cloud.geometry.dispose();
        cloudMaterial.dispose();
        lines.geometry.dispose();
        lines.material.dispose();
        web.geometry.dispose();
        web.material.dispose();
        rings.geometry.dispose();
        ringMaterial.dispose();
        hoverDot.geometry.dispose();
        hoverMaterial.dispose();
        scene.clear();
        renderer.dispose();
        // dispose() frees three's own caches but leaves the GL context alive
        // until the canvas is collected, and a browser only grants a handful of
        // contexts: opening and closing the map has to hand each one back.
        renderer.forceContextLoss();
        canvas.remove();
        cloudRef.current = null;
        linesRef.current = null;
        webRef.current = null;
        ringsRef.current = null;
        hoverDotRef.current = null;
        cameraRef.current = null;
        controlsRef.current = null;
        raycasterRef.current = null;
      };
      // The scene is built once; data arrives through the effects below.
    }, []);

    /**
     * Fit the camera to the cloud.
     *
     * The camera used to be parked at a constant distance on the argument that
     * the layout's 99th-percentile radius is normalised to 1, so every base
     * would frame alike. It does frame alike — alike and too small. That
     * distance frames a world box about three units tall whatever the cloud is,
     * and on the first real base the cloud is 1.53 by 0.97, so it sat in a
     * third of the height and an eighth of the width of a canvas four times
     * wider than it is tall.
     *
     * Three things follow from the box rather than from a constant: where the
     * camera sits (`frameCloud` fits both viewport dimensions), what it looks
     * at (the box's centre, which is not the origin), and how far a viewer may
     * dolly either way.
     *
     * A fourth thing follows from the distance. The point shader scales a dot
     * by 1/distance, so framing this base at 1.22 instead of 3.2 would make
     * every dot two and a half times larger — and so would the pick radius,
     * which is a world-space distance from the ray. Both are scaled back by
     * `sizeScale`, which leaves a dot and the slop around it exactly the
     * apparent size they have today.
     *
     * Keyed on the box, so a different base or a refit re-frames and a
     * selection, a panel hover or a theme change cannot move the camera.
     */
    React.useEffect(() => {
      const host = hostRef.current;
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const raycaster = raycasterRef.current;
      const cloud = cloudRef.current;
      const rings = ringsRef.current;
      const hoverDot = hoverDotRef.current;
      if (!host || !camera || !controls || !raycaster || !cloud || !rings || !hoverDot) return;
      const measured = latestRef.current.bounds;
      if (!measured) return;

      // A host with no layout yet divides to 0 or NaN, which frameCloud reads
      // as "no aspect ratio" rather than propagating into the distance.
      const framing = frameCloud(
        measured,
        host.clientWidth / host.clientHeight,
        CAMERA_FOV_DEGREES,
      );
      const { center } = framing;
      controls.target.set(center.x, center.y, center.z);
      camera.position.set(center.x, center.y, center.z + framing.distance);
      controls.minDistance = framing.minDistance;
      controls.maxDistance = framing.maxDistance;
      controls.update();
      // Reset restores this framing, not wherever the camera was parked before
      // the data arrived.
      controls.saveState();

      cloud.material.uniforms.size.value = POINT_SIZE * framing.sizeScale;
      rings.material.uniforms.size.value = RING_SIZE * framing.sizeScale;
      hoverDot.material.uniforms.size.value = HOVER_SIZE * framing.sizeScale;
      raycaster.params.Points.threshold = PICK_THRESHOLD * framing.sizeScale;
    }, [boundsKey]);

    /**
     * Paints the hovered dot's layer: one vertex, and the two colours it is
     * drawn in.
     *
     * A callback rather than effect bodies, because two things repaint it —
     * the hover effect below when the dot changes, and the colour effect when
     * the theme changes — and an outline left in the previous theme's text
     * colour is the one thing that would otherwise go unnoticed.
     *
     * Writes into the position attribute allocated once in the scene-build
     * effect, and reads the palette and the outline colour from
     * `themeCacheRef` rather than resolving either — no `getComputedStyle`,
     * no new BufferGeometry. The cloud auto-rotates under a still pointer,
     * so the dot under it changes on its own, up to ten times a second,
     * and only an actual theme change can alter either cached value.
     */
    const paintHoveredDot = React.useCallback(
      (point: MapPoint | null) => {
        const hoverDot = hoverDotRef.current;
        if (!hoverDot) return;
        // Both guards come before `visible`. The uniforms start as zeroed
        // vectors from the scene build, so showing the dot without the cached
        // colours would paint a black disc with a black rim. The colour effect
        // is declared before this one and fills the cache, so this is
        // unreachable today — and is one line to keep unreachable if that
        // ordering ever changes.
        const cache = themeCacheRef.current;
        if (!point || !cache) {
          hoverDot.visible = false;
          return;
        }
        hoverDot.visible = true;
        const position = hoverDot.geometry.attributes
          .position as THREE.BufferAttribute;
        (position.array as Float32Array).set([point.x, point.y, point.z]);
        position.needsUpdate = true;
        // The dot's own region colour, through the same function that colours
        // it in the cloud, so the hovered dot is recognisably the dot that was
        // there rather than a second mark in a colour of its own.
        const fill = regionColor(cache.palette, regionOf(point));
        hoverDot.material.uniforms.fill.value.set(fill[0], fill[1], fill[2]);
        hoverDot.material.uniforms.outline.value.set(
          cache.outline[0],
          cache.outline[1],
          cache.outline[2],
        );
      },
      [regionOf],
    );

    // Positions and colours. Also re-run when the theme changes: WebGL colours
    // were resolved from CSS once, so without this the cloud keeps the previous
    // theme's palette.
    React.useEffect(() => {
      const host = hostRef.current;
      const cloud = cloudRef.current;
      if (!host || !cloud) return;
      const write = () => {
        const palette = resolvePalette(host);
        // Cached for `paintHoveredDot`, which otherwise re-read both of
        // these on every rotation-driven hover change. This effect already
        // reruns on a theme change (the MutationObserver below), so it is
        // the one place both need resolving — not a second observer.
        themeCacheRef.current = {
          palette,
          outline: resolveHoverOutlineColor(host),
        };
        const { positions, colors } = buildBuffers(points, regionOf, palette);
        // Read through the ref, not from this closure's own highlightTopic /
        // topicMemberIds: those are no longer this effect's dependencies (see
        // the dim-only effect below), so the theme-change observer calling
        // this `write` long after the last hover needs the current values,
        // not whichever were in scope when positions and colours last
        // actually rebuilt.
        const dim = computeDim(
          points,
          latestRef.current.highlightTopic,
          latestRef.current.topicMemberIds,
          selectedId,
          latestRef.current.ringedIds,
        );
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(positions, 3),
        );
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute("dim", new THREE.BufferAttribute(dim, 1));
        // Picking rejects against the bounding sphere before it walks the
        // points, so a stale one would make the cloud unclickable.
        geometry.computeBoundingSphere();
        const previous = cloud.geometry;
        cloud.geometry = geometry;
        // Replacing an attribute leaves its GPU buffer behind until the geometry
        // that owned it is disposed, so the old geometry goes out on every write.
        previous.dispose();

        const web = webRef.current;
        // The web is neutral: --chart-5 is the palette's reserved "no value".
        // setRGB stores into the working (linear) space by default, so the sRGB
        // triple the theme gave us has to say which space it is in.
        if (web) {
          web.material.color.setRGB(
            palette.noValue[0],
            palette.noValue[1],
            palette.noValue[2],
            THREE.SRGBColorSpace,
          );
        }
        const rings = ringsRef.current;
        if (rings) {
          const ring = resolveRingColor(host);
          rings.material.uniforms.ring.value.set(ring[0], ring[1], ring[2]);
        }
        // The hovered dot reads two theme colours of its own, now cached
        // above. Its id comes through the ref, so a pointer move does not
        // land here — only a theme change and a data change do.
        paintHoveredDot(latestRef.current.hovered);
      };
      write();
      const observer = new MutationObserver(write);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      });
      return () => observer.disconnect();
    }, [points, regionOf, selectedId, ringedKey, paintHoveredDot]);

    /**
     * `dim` alone. `highlightTopic` and `topicMemberIds` — what a chip hover
     * rewrites — are no longer dependencies of the effect above, so this is
     * now the only thing a hover reruns. `selectedId` and `ringedKey` stay
     * dependencies of both: the effect above still rebuilds the whole cloud
     * on a selection or a ring change exactly as before (neither is the cost
     * this fixes), and recomputing `dim` here too on those same two changes
     * is redundant but harmless — this runs right after it, against the
     * geometry it just built.
     *
     * Mutating the existing attribute's array and flagging it costs one
     * O(N) loop and a partial GPU re-upload of a one-float-per-point
     * buffer — no new geometry, no `computeBoundingSphere`, no touching the
     * position or colour buffers — so the cloud no longer flashes back to
     * full brightness between a chip row's hovers.
     */
    React.useEffect(() => {
      const cloud = cloudRef.current;
      if (!cloud) return;
      const attribute = cloud.geometry.attributes.dim as
        | THREE.BufferAttribute
        | undefined;
      if (!attribute) return;
      const freshDim = computeDim(
        points, highlightTopic, topicMemberIds, selectedId,
        latestRef.current.ringedIds,
      );
      (attribute.array as Float32Array).set(freshDim);
      attribute.needsUpdate = true;
    }, [points, highlightTopic, topicMemberIds, selectedId, ringedKey]);

    /**
     * The dot under the pointer, drawn again larger and outlined.
     *
     * Keyed on the dot's ID, not on the hover state: that state also carries
     * the tooltip's screen position and is rewritten ten times a second while
     * the cloud turns under a still pointer. Keyed on the id, this writes one
     * vertex when the dot actually changes, and the cloud's own position and
     * colour buffers are never touched by a hover at all.
     */
    const hoveredId = hover?.id ?? null;
    React.useEffect(() => {
      const host = hostRef.current;
      if (!host) return;
      const point = hoveredId === null ? null : (byId.get(hoveredId) ?? null);
      // Read by the colour effect's theme re-read, which has no dependency on
      // the hovered dot and must not grow one.
      latestRef.current.hovered = point;
      paintHoveredDot(point);
    }, [hoveredId, byId, paintHoveredDot]);

    // Neighbour lines, rebuilt only when the selection or the hovered
    // neighbour changes.
    React.useEffect(() => {
      const lines = linesRef.current;
      if (!lines) return;
      const selected = selectedId ? byId.get(selectedId) : undefined;
      const vertices: number[] = [];
      const colors: number[] = [];
      if (selected) {
        for (const edge of edges) {
          const from = byId.get(edge.source) ?? selected;
          const to = byId.get(edge.target);
          if (!to) continue;
          vertices.push(from.x, from.y, from.z, to.x, to.y, to.z);
          const weight =
            edge.target === hoverNeighbourId
              ? 1
              : Math.max(0.25, Math.min(1, edge.score));
          colors.push(weight, weight, weight, weight, weight, weight);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(vertices), 3),
      );
      geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(new Float32Array(colors), 3),
      );
      const previous = lines.geometry;
      lines.geometry = geometry;
      previous.dispose();
    }, [edges, selectedId, byId, hoverNeighbourId]);

    // The faint web. Its own object, so a nearest-neighbour pass over twenty
    // thousand passages does not run again every time the selection changes.
    React.useEffect(() => {
      const web = webRef.current;
      if (!web) return;
      const positions = allLinks
        ? nearestNeighbourSegments(points)
        : new Float32Array(0);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      const previous = web.geometry;
      web.geometry = geometry;
      previous.dispose();
    }, [allLinks, points]);

    // The rings. Their own buffer, so flagging a handful of passages does not
    // re-upload the whole cloud, and the common case stays one upload.
    React.useEffect(() => {
      const rings = ringsRef.current;
      if (!rings) return;
      const ringed = latestRef.current.ringedIds;
      const positions = new Float32Array(ringed.size * 3);
      let cursor = 0;
      for (const point of points) {
        if (!ringed.has(point.id)) continue;
        positions[cursor] = point.x;
        positions[cursor + 1] = point.y;
        positions[cursor + 2] = point.z;
        cursor += 3;
      }
      const geometry = new THREE.BufferGeometry();
      // A ringed id the viewer may not read is simply not among the points,
      // so the buffer is trimmed to what was actually found.
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions.subarray(0, cursor), 3),
      );
      const previous = rings.geometry;
      rings.geometry = geometry;
      previous.dispose();
    }, [points, ringedKey]);

    // Idle rotation. OrbitControls owns it; pausing is one flag.
    React.useEffect(() => {
      const controls = controlsRef.current;
      if (!controls) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      const apply = () => {
        controls.autoRotate = !paused && !reduced.matches;
      };
      apply();
      reduced.addEventListener("change", apply);
      return () => reduced.removeEventListener("change", apply);
    }, [paused]);

    return (
      <div ref={hostRef} className="relative size-full">
        <div ref={layerRef} className="absolute inset-0" />
        {labels.map((label) => (
          // `px-1.5 py-0.5` is what LABEL_PLATE_PAD_X / _Y encode for the
          // collision box; changing the padding here means changing those.
          <span
            key={label.id}
            className="pointer-events-none absolute whitespace-nowrap rounded border border-border/60 bg-background/85 px-1.5 py-0.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-[2px]"
            style={{
              left: label.x,
              top: label.y,
              transform: "translate(-50%, -50%)",
            }}
          >
            {label.label}
          </span>
        ))}
        {hover && (
          <span
            className="pointer-events-none absolute max-w-xs truncate rounded border bg-popover px-2 py-1 text-xs text-popover-foreground shadow"
            style={{ left: hover.x + 8, top: hover.y + 8 }}
          >
            {hover.name}
          </span>
        )}
      </div>
    );
  },
);
