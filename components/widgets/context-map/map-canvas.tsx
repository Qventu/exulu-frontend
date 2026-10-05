"use client";

/**
 * The point cloud. Plain three.js in one effect: a single Points object for
 * every passage, a second drawn over it for the ringed ones, one LineSegments
 * for the selected node's neighbours, another for the faint nearest-neighbour
 * web, and HTML overlays for the topic labels so they use the page's own type
 * tokens.
 *
 * No test covers this file — jsdom has no WebGL context. Everything that can be
 * reasoned about without a GPU lives in ./map-data and is tested there, so what
 * is left here is the WebGL wiring, the animation loop and their teardown.
 */

import * as React from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
  buildBuffers,
  nearestNeighbourSegments,
  projectToScreen,
  resolveLabelCollisions,
  resolvePalette,
  resolveRingColor,
  type MapEdge,
  type MapPoint,
  type MapTopic,
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
const RING_INNER_RADIUS = 0.34;
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
 * The layout is normalised to a 99th-percentile radius of 1, so every base
 * frames identically from this distance.
 */
const CAMERA_DISTANCE = 3.2;
/** gl_PointSize is in device pixels; see the pixelRatio factor in the shader. */
const POINT_SIZE = 0.035;
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
/** Wide enough that the annulus sits around the dot rather than on top of it. */
const RING_SIZE = POINT_SIZE * 2.2;
const SELECTED_LINE_OPACITY = 0.75;
const WEB_LINE_OPACITY = 0.12;

const DIM_SELECTED = 1;
const DIM_MUTED = 0.15;
const DIM_NORMAL = 0.85;

type Hover = { label: string; x: number; y: number } | null;
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
    const controlsRef = React.useRef<OrbitControls | null>(null);
    const pointerRef = React.useRef<{ x: number; y: number } | null>(null);
    const hoverKeyRef = React.useRef("");
    const labelKeyRef = React.useRef("");
    const [labels, setLabels] = React.useState<Label[]>([]);
    const [hover, setHover] = React.useState<Hover>(null);

    // The scene is built once, so the loop and the click handler would otherwise
    // keep hit-testing the first render's cloud for ever. They read props from
    // here instead of from their own closure.
    const latestRef = React.useRef({
      points,
      topics,
      ringedIds,
      onSelect,
      onUnsupported,
    });
    React.useEffect(() => {
      latestRef.current = {
        points,
        topics,
        ringedIds,
        onSelect,
        onUnsupported,
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
        50,
        size.width / size.height,
        0.01,
        100,
      );
      camera.position.set(0, 0, CAMERA_DISTANCE);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 1.2;
      controls.maxDistance = 8;
      controls.autoRotateSpeed = 0.6;
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
      // The cloud is always on screen and always centred; culling it against a
      // bounding sphere only risks dropping it while a buffer write is pending.
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

      const raycaster = new THREE.Raycaster();
      raycaster.params.Points.threshold = PICK_THRESHOLD;

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
        let nextHover: Hover = null;
        if (hovered) {
          const screen = projectToScreen(hovered, matrix, width, height);
          if (screen.visible) {
            nextHover = { label: hovered.label, x: screen.x, y: screen.y };
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
            width: topic.label.length * LABEL_CHAR_WIDTH + 12,
            height: LABEL_HEIGHT + 4,
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
        controlsRef.current = null;
      };
      // The scene is built once; data arrives through the effects below.
    }, []);

    // Positions and colours. Also re-run when the theme changes: WebGL colours
    // were resolved from CSS once, so without this the cloud keeps the previous
    // theme's palette.
    React.useEffect(() => {
      const host = hostRef.current;
      const cloud = cloudRef.current;
      if (!host || !cloud) return;
      const write = () => {
        const palette = resolvePalette(host);
        const { positions, colors } = buildBuffers(points, regionOf, palette);
        const ringed = latestRef.current.ringedIds;
        const dim = new Float32Array(points.length);
        for (let i = 0; i < points.length; i += 1) {
          const point = points[i];
          // Outside the highlighted region, so dimmed — whether or not the
          // passage has a grouping value, which says nothing about its region.
          // A ringed passage stays bright: the ring is there to be seen.
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
      };
      write();
      const observer = new MutationObserver(write);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      });
      return () => observer.disconnect();
    }, [points, regionOf, selectedId, highlightTopic, topicMemberIds, ringedKey]);

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
            {hover.label}
          </span>
        )}
      </div>
    );
  },
);
