/**
 * Agent World Game Engine
 * Self-contained 2D pixel art game engine for the agent world dashboard.
 * Ported and simplified from github.com/pablodelucca/pixel-agents.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TILE_SIZE = 16;
const COLS = 22;
const ROWS = 12;
const ZOOM = 3;

const CHAR_FRAME_W = 16;
const CHAR_FRAME_H = 32;
const CHAR_FRAMES_PER_ROW = 7;
const CHAR_DIR_COUNT = 3; // down=0, up=1, right=2

const WALK_SPEED = 48; // px/sec at 1x
const WALK_FRAME_DT = 0.15;
const WANDER_PAUSE_MIN = 1.5;
const WANDER_PAUSE_MAX = 4.0;
const BUBBLE_DURATION = 9.0; // seconds bubble shows
const BUBBLE_FADE = 1.5; // fade-out window
const MAX_DT = 0.1;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentWorldAgent {
  sessionId: string;
  agentId: string;
  agentName: string;
  agentImage?: string | null;
  currentTask?: string | null;
  lastActivityAt: string;
}

const DIR = { DOWN: 0, UP: 1, RIGHT: 2, LEFT: 3 } as const;
type Dir = (typeof DIR)[keyof typeof DIR];
const STATE = { IDLE: "idle", WALK: "walk" } as const;
type State = (typeof STATE)[keyof typeof STATE];

interface WorldChar {
  sessionId: string;
  agentName: string;
  palette: number; // 0-5
  x: number; // pixel
  y: number; // pixel
  tileCol: number;
  tileRow: number;
  dir: Dir;
  state: State;
  frame: number;
  frameTimer: number;
  path: Array<{ col: number; row: number }>;
  moveProgress: number;
  wanderTimer: number;
  currentTask: string | null;
  bubbleTimer: number; // counts down from BUBBLE_DURATION → 0
  despawning: boolean;
  despawnTimer: number; // grace period before removal
}

// ─────────────────────────────────────────────────────────────────────────────
// Tile map (all walkable)
// ─────────────────────────────────────────────────────────────────────────────

function buildTileMap(): boolean[][] {
  const map: boolean[][] = [];
  for (let r = 0; r < ROWS; r++) {
    map.push(new Array(COLS).fill(true));
  }
  return map;
}

const WALKABLE_TILES: Array<{ col: number; row: number }> = [];
for (let r = 1; r < ROWS - 1; r++) {
  for (let c = 1; c < COLS - 1; c++) {
    WALKABLE_TILES.push({ col: c, row: r });
  }
}

function findPath(
  sc: number,
  sr: number,
  ec: number,
  er: number,
): Array<{ col: number; row: number }> {
  if (sc === ec && sr === er) return [];
  const key = (c: number, r: number) => `${c},${r}`;
  const visited = new Set([key(sc, sr)]);
  const parent = new Map<string, string>();
  const queue = [{ col: sc, row: sr }];
  const dirs = [
    { dc: 0, dr: -1 },
    { dc: 0, dr: 1 },
    { dc: -1, dr: 0 },
    { dc: 1, dr: 0 },
  ];
  while (queue.length) {
    const curr = queue.shift()!;
    if (curr.col === ec && curr.row === er) {
      const path: Array<{ col: number; row: number }> = [];
      let k = key(ec, er);
      const sk = key(sc, sr);
      while (k !== sk) {
        const [c, r] = k.split(",").map(Number);
        path.unshift({ col: c, row: r });
        k = parent.get(k)!;
      }
      return path;
    }
    for (const d of dirs) {
      const nc = curr.col + d.dc;
      const nr = curr.row + d.dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const nk = key(nc, nr);
      if (visited.has(nk)) continue;
      visited.add(nk);
      parent.set(nk, key(curr.col, curr.row));
      queue.push({ col: nc, row: nr });
    }
  }
  return [];
}

function tileCenter(col: number, row: number) {
  return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
}

// ─────────────────────────────────────────────────────────────────────────────
// djb2 hash for deterministic palette assignment
// ─────────────────────────────────────────────────────────────────────────────

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sprite loading
// ─────────────────────────────────────────────────────────────────────────────

// frames[palette][dir][frame] → HTMLCanvasElement (16×32)
let charFrames: HTMLCanvasElement[][][] | null = null;
// floorTile[floorColorH] → HTMLCanvasElement (TILE_SIZE*ZOOM × TILE_SIZE*ZOOM)
let floorCanvas: HTMLCanvasElement | null = null;

async function loadCharacterSprites(basePath: string): Promise<HTMLCanvasElement[][][]> {
  const palettes: HTMLCanvasElement[][][] = [];
  for (let p = 0; p < 6; p++) {
    const img = new Image();
    img.src = `${basePath}/characters/char_${p}.png`;
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => res(); // skip missing
    });

    const dirFrames: HTMLCanvasElement[][] = [];
    for (let d = 0; d < CHAR_DIR_COUNT; d++) {
      const frames: HTMLCanvasElement[] = [];
      for (let f = 0; f < CHAR_FRAMES_PER_ROW; f++) {
        const fc = document.createElement("canvas");
        fc.width = CHAR_FRAME_W;
        fc.height = CHAR_FRAME_H;
        const fctx = fc.getContext("2d")!;
        fctx.imageSmoothingEnabled = false;
        fctx.drawImage(
          img,
          f * CHAR_FRAME_W,
          d * CHAR_FRAME_H,
          CHAR_FRAME_W,
          CHAR_FRAME_H,
          0,
          0,
          CHAR_FRAME_W,
          CHAR_FRAME_H,
        );
        frames.push(fc);
      }
      dirFrames.push(frames);
    }
    palettes.push(dirFrames);
  }
  return palettes;
}

async function loadFloorTile(basePath: string, h: number, s: number): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = `${basePath}/floors/floor_0.png`;
  await new Promise<void>((res) => {
    img.onload = () => res();
    img.onerror = () => res();
  });

  const sz = TILE_SIZE * ZOOM;
  const c = document.createElement("canvas");
  c.width = sz;
  c.height = sz;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  // Draw the floor tile scaled up
  ctx.drawImage(img, 0, 0, TILE_SIZE, TILE_SIZE, 0, 0, sz, sz);

  // Apply logo-based color tint as overlay
  ctx.globalCompositeOperation = "color";
  ctx.fillStyle = `hsl(${h}, ${s}%, 45%)`;
  ctx.fillRect(0, 0, sz, sz);
  ctx.globalCompositeOperation = "source-over";

  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
// Frame index helpers
// ─────────────────────────────────────────────────────────────────────────────

// Sprite sheet layout per direction:
// frames 0-2: walk
// frames 3-4: typing
// frames 5-6: reading
// We only use walk (0-2) and idle (frame 1) in the agent world

function getFrameIndex(state: State, frame: number): number {
  if (state === STATE.WALK) return frame % 3; // walk frames 0,1,2
  return 1; // idle = frame 1
}

function getDirIndex(dir: Dir): number {
  if (dir === DIR.DOWN) return 0;
  if (dir === DIR.UP) return 1;
  return 2; // RIGHT or LEFT (LEFT is flipped RIGHT)
}

// ─────────────────────────────────────────────────────────────────────────────
// Character update
// ─────────────────────────────────────────────────────────────────────────────

function updateChar(ch: WorldChar, dt: number): void {
  ch.frameTimer += dt;

  if (ch.bubbleTimer > 0) {
    ch.bubbleTimer = Math.max(0, ch.bubbleTimer - dt);
  }

  if (ch.state === STATE.WALK) {
    if (ch.frameTimer >= WALK_FRAME_DT) {
      ch.frameTimer -= WALK_FRAME_DT;
      ch.frame = (ch.frame + 1) % 3;
    }

    if (ch.path.length === 0) {
      ch.state = STATE.IDLE;
      ch.frame = 0;
      ch.frameTimer = 0;
      ch.wanderTimer = WANDER_PAUSE_MIN + Math.random() * (WANDER_PAUSE_MAX - WANDER_PAUSE_MIN);
      return;
    }

    const next = ch.path[0];
    const dc = next.col - ch.tileCol;
    const dr = next.row - ch.tileRow;
    if (dc > 0) ch.dir = DIR.RIGHT;
    else if (dc < 0) ch.dir = DIR.LEFT;
    else if (dr > 0) ch.dir = DIR.DOWN;
    else ch.dir = DIR.UP;

    ch.moveProgress += (WALK_SPEED / TILE_SIZE) * dt;
    const from = tileCenter(ch.tileCol, ch.tileRow);
    const to = tileCenter(next.col, next.row);
    const t = Math.min(ch.moveProgress, 1);
    ch.x = from.x + (to.x - from.x) * t;
    ch.y = from.y + (to.y - from.y) * t;

    if (ch.moveProgress >= 1) {
      ch.tileCol = next.col;
      ch.tileRow = next.row;
      ch.x = to.x;
      ch.y = to.y;
      ch.path.shift();
      ch.moveProgress = 0;
    }
    return;
  }

  // IDLE — wander
  ch.wanderTimer -= dt;
  if (ch.wanderTimer <= 0) {
    const candidates = WALKABLE_TILES;
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    const path = findPath(ch.tileCol, ch.tileRow, target.col, target.row);
    if (path.length > 0) {
      ch.path = path;
      ch.moveProgress = 0;
      ch.state = STATE.WALK;
      ch.frame = 0;
      ch.frameTimer = 0;
    } else {
      ch.wanderTimer = WANDER_PAUSE_MIN + Math.random() * (WANDER_PAUSE_MAX - WANDER_PAUSE_MIN);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────────

// Scaled frame cache: `${palette}:${dir}:${frame}` → HTMLCanvasElement
const scaledFrameCache = new Map<string, HTMLCanvasElement>();

function getScaledFrame(palette: number, dir: Dir, frameIdx: number, flip: boolean): HTMLCanvasElement {
  const cacheKey = `${palette}:${dir}:${frameIdx}:${flip}`;
  const cached = scaledFrameCache.get(cacheKey);
  if (cached) return cached;

  const src = charFrames![palette % charFrames!.length][getDirIndex(dir) === 3 ? 2 : getDirIndex(dir)][frameIdx];
  const sw = CHAR_FRAME_W * ZOOM;
  const sh = CHAR_FRAME_H * ZOOM;
  const c = document.createElement("canvas");
  c.width = sw;
  c.height = sh;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  if (flip) {
    ctx.translate(sw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, 0, 0, CHAR_FRAME_W, CHAR_FRAME_H, 0, 0, sw, sh);

  scaledFrameCache.set(cacheKey, c);
  return c;
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function drawTextBubble(
  ctx: CanvasRenderingContext2D,
  cx: number,
  top: number,
  text: string,
  alpha: number,
): void {
  const lines = wrapText(text, 20);
  if (!lines.length) return;

  const fontSize = 9;
  const pad = 5;
  const lineH = fontSize + 2;
  const maxW = Math.max(...lines.map((l) => l.length)) * (fontSize * 0.6);
  const bw = maxW + pad * 2;
  const bh = lines.length * lineH + pad * 2;
  const bx = cx - bw / 2;
  const by = top - bh - 6; // 6px gap above head

  ctx.save();
  ctx.globalAlpha = alpha;

  // Shadow
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;

  // Bubble body
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  const r = 4;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bw - r, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + r, r);
  ctx.lineTo(bx + bw, by + bh - r);
  ctx.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r);
  ctx.lineTo(bx + bw / 2 + 5, by + bh);
  ctx.lineTo(cx, by + bh + 5); // pointer
  ctx.lineTo(bx + bw / 2 - 5, by + bh);
  ctx.lineTo(bx + r, by + bh);
  ctx.arcTo(bx, by + bh, bx, by + bh - r, r);
  ctx.lineTo(bx, by + r);
  ctx.arcTo(bx, by, bx + r, by, r);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.stroke();

  // Text
  ctx.fillStyle = "#1a1a2e";
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textBaseline = "top";
  for (let i = 0; i < lines.length; i++) {
    const lx = cx - ctx.measureText(lines[i]).width / 2;
    ctx.fillText(lines[i], lx, by + pad + i * lineH);
  }

  ctx.restore();
}

function renderWorld(
  ctx: CanvasRenderingContext2D,
  chars: Map<string, WorldChar>,
  width: number,
  height: number,
): void {
  // Background
  ctx.fillStyle = "#2d3748";
  ctx.fillRect(0, 0, width, height);

  const tileS = TILE_SIZE * ZOOM;
  const worldW = COLS * tileS;
  const worldH = ROWS * tileS;
  const offX = Math.floor((width - worldW) / 2);
  const offY = Math.floor((height - worldH) / 2);

  // Floor tiles
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = offX + c * tileS;
      const y = offY + r * tileS;
      if (floorCanvas) {
        ctx.drawImage(floorCanvas, x, y);
      } else {
        const isEven = (r + c) % 2 === 0;
        ctx.fillStyle = isEven ? "#4a5568" : "#3d4a5a";
        ctx.fillRect(x, y, tileS, tileS);
      }
    }
  }

  // Subtle grid
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(offX + c * tileS + 0.5, offY);
    ctx.lineTo(offX + c * tileS + 0.5, offY + worldH);
    ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(offX, offY + r * tileS + 0.5);
    ctx.lineTo(offX + worldW, offY + r * tileS + 0.5);
    ctx.stroke();
  }

  if (!charFrames) return;

  // Z-sort characters by y position
  const sorted = Array.from(chars.values()).sort((a, b) => a.y - b.y);

  interface Bubble {
    cx: number;
    top: number;
    text: string;
    alpha: number;
  }
  const pendingBubbles: Bubble[] = [];

  for (const ch of sorted) {
    const flip = ch.dir === DIR.LEFT;
    const renderDir: Dir = flip ? DIR.RIGHT : ch.dir;
    const frameIdx = getFrameIndex(ch.state, ch.frame);
    const scaled = getScaledFrame(ch.palette, renderDir, frameIdx, flip);

    const px = offX + ch.x * ZOOM;
    const py = offY + ch.y * ZOOM;

    // Anchor at bottom-center
    const drawX = Math.round(px - scaled.width / 2);
    const drawY = Math.round(py - scaled.height);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scaled, drawX, drawY);

    // Collect bubble for rendering on top
    if (ch.currentTask && ch.bubbleTimer > 0) {
      const alpha = ch.bubbleTimer < BUBBLE_FADE ? ch.bubbleTimer / BUBBLE_FADE : 1;
      pendingBubbles.push({ cx: px, top: drawY, text: ch.currentTask, alpha });
    }
  }

  // Draw all bubbles on top (after all characters)
  for (const b of pendingBubbles) {
    drawTextBubble(ctx, b.cx, b.top, b.text, b.alpha);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// World State
// ─────────────────────────────────────────────────────────────────────────────

export class AgentWorld {
  private chars = new Map<string, WorldChar>();
  private canvas: HTMLCanvasElement;
  private stopLoop?: () => void;
  private loaded = false;
  private logoH = 210;
  private logoS = 40;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init(basePath: string = "/agent-world"): Promise<void> {
    charFrames = await loadCharacterSprites(basePath);
    floorCanvas = await loadFloorTile(basePath, this.logoH, this.logoS);
    scaledFrameCache.clear();
    this.loaded = true;
    this.startLoop();
  }

  setLogoColor(h: number, s: number): void {
    this.logoH = h;
    this.logoS = s;
    // Regenerate floor tile
    loadFloorTile("/agent-world", h, s).then((c) => {
      floorCanvas = c;
    });
  }

  /** Sync polling results → character spawn/despawn/update */
  syncAgents(agents: AgentWorldAgent[]): void {
    const seen = new Set<string>();

    for (const agent of agents) {
      seen.add(agent.sessionId);
      const existing = this.chars.get(agent.sessionId);

      if (!existing) {
        // Spawn new character
        const palette = djb2(agent.agentId || agent.sessionId) % 6;
        const spawnTile =
          WALKABLE_TILES[Math.floor(Math.random() * WALKABLE_TILES.length)];
        const center = tileCenter(spawnTile.col, spawnTile.row);

        const ch: WorldChar = {
          sessionId: agent.sessionId,
          agentName: agent.agentName,
          palette,
          x: center.x,
          y: center.y,
          tileCol: spawnTile.col,
          tileRow: spawnTile.row,
          dir: DIR.DOWN,
          state: STATE.IDLE,
          frame: 0,
          frameTimer: 0,
          path: [],
          moveProgress: 0,
          wanderTimer: Math.random() * 2,
          currentTask: agent.currentTask ?? null,
          bubbleTimer: agent.currentTask ? BUBBLE_DURATION : 0,
          despawning: false,
          despawnTimer: 0,
        };
        this.chars.set(agent.sessionId, ch);
      } else {
        // Update existing character
        existing.despawning = false;
        existing.despawnTimer = 0;

        if (agent.currentTask && agent.currentTask !== existing.currentTask) {
          existing.currentTask = agent.currentTask;
          existing.bubbleTimer = BUBBLE_DURATION;
        } else if (!agent.currentTask) {
          // Task cleared — let bubble fade naturally
        }
      }
    }

    // Mark missing agents for despawn (30s grace)
    for (const [sid, ch] of this.chars) {
      if (!seen.has(sid) && !ch.despawning) {
        ch.despawning = true;
        ch.despawnTimer = 30;
      }
    }
  }

  private update(dt: number): void {
    for (const [sid, ch] of this.chars) {
      if (ch.despawning) {
        ch.despawnTimer -= dt;
        if (ch.despawnTimer <= 0) {
          this.chars.delete(sid);
          continue;
        }
      }
      updateChar(ch, dt);
    }
  }

  private render(): void {
    if (!this.loaded) return;
    const ctx = this.canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    renderWorld(ctx, this.chars, this.canvas.width, this.canvas.height);
  }

  private startLoop(): void {
    let lastTime = 0;
    let rafId = 0;
    let stopped = false;

    const frame = (time: number) => {
      if (stopped) return;
      const dt = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, MAX_DT);
      lastTime = time;
      this.update(dt);
      this.render();
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    this.stopLoop = () => {
      stopped = true;
      cancelAnimationFrame(rafId);
    };
  }

  destroy(): void {
    this.stopLoop?.();
    charFrames = null;
    floorCanvas = null;
    scaledFrameCache.clear();
  }

  get characterCount(): number {
    return this.chars.size;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Logo color extraction
// ─────────────────────────────────────────────────────────────────────────────

let cachedLogoColor: { h: number; s: number } | null = null;

export async function extractLogoColor(src: string): Promise<{ h: number; s: number }> {
  if (cachedLogoColor) return cachedLogoColor;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    await new Promise<void>((res) => {
      img.onload = () => res();
      img.onerror = () => res();
    });
    if (!img.complete || img.naturalWidth === 0) return { h: 220, s: 40 };

    const oc = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
    const octx = oc.getContext("2d")!;
    octx.drawImage(img, 0, 0);
    const data = octx.getImageData(0, 0, oc.width, oc.height).data;

    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let i = 0; i < data.length; i += 16) {
      const a = data[i + 3];
      if (a < 128) continue;
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (lum < 30 || lum > 220) continue;
      rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2]; count++;
    }
    if (!count) return { h: 220, s: 40 };

    const r = rSum / count / 255;
    const g = gSum / count / 255;
    const b = bSum / count / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d > 0.01) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (max === g) h = ((b - r) / d + 2) * 60;
      else h = ((r - g) / d + 4) * 60;
    }
    const l = (max + min) / 2;
    const s = d < 0.01 ? 0 : d / (1 - Math.abs(2 * l - 1));
    cachedLogoColor = { h: Math.round(h), s: Math.min(60, Math.round(s * 100)) };
    return cachedLogoColor;
  } catch {
    return { h: 220, s: 40 };
  }
}
