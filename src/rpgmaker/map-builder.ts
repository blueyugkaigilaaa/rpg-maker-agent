import * as fs from "fs";
import * as path from "path";
import {
  MZ_Map, MZ_Event, MZ_EventPage, MZ_EventCommand, MZ_AudioFile,
} from "./types";
import { defaultConditions, defaultMoveRoute, TRIGGER, PRIORITY, DIR } from "./constants";

// RPG Maker MZ autotile base IDs
const TILE_A2 = 2816;        // floor autotiles (48 shapes per kind)
const TILE_A3_ROOF = 4352;   // A3 roof autotiles, kind%16 < 8 (16 shapes)
const TILE_A3_WALL = 4352 + 8 * 48; // A3 wall-side autotiles, kind%16 >= 8 (16 shapes)
const TILE_A4_TOP = 5888;    // A4 wall-top autotiles, kind%16 < 8 (48 shapes)
const TILE_A4_WALL = 5888 + 8 * 48; // A4 wall-side autotiles, kind%16 >= 8 (16 shapes)
const TILE_A5 = 1536;        // A5 normal floor/object tiles
const TILE_A5_END = 1664;    // end of A5 range (exclusive)

/**
 * Compute wall autotile shape (0-15) from neighbor flags.
 * A "true" neighbor means the adjacent cell is ALSO a wall tile.
 */
function wallShape(top: boolean, right: boolean, bottom: boolean, left: boolean): number {
  let s = 0;
  if (!left) s |= 1;
  if (!top) s |= 2;
  if (!right) s |= 4;
  if (!bottom) s |= 8;
  return s;
}

/**
 * Creates a blank MZ map with the given dimensions.
 * Indoor maps (tilesetId 3,6) get wall borders; outdoor maps get plain ground.
 */
export function createEmptyMap(
  width: number,
  height: number,
  tilesetId: number = 1,
  displayName: string = ""
): MZ_Map {
  const layerSize = width * height;
  const data = new Array(layerSize * 6).fill(0);
  const isIndoor = [3, 6].includes(tilesetId);

  if (isIndoor) {
    fillIndoorRoom(data, width, height, layerSize);
  } else {
    for (let i = 0; i < layerSize; i++) data[i] = TILE_A2;
  }

  return {
    displayName,
    tilesetId,
    width,
    height,
    data,
    events: [null],
    autoplayBgm: false,
    bgm: { name: "", volume: 90, pitch: 100, pan: 0 },
    autoplayBgs: false,
    bgs: { name: "", volume: 90, pitch: 100, pan: 0 },
    battleback1Name: "",
    battleback2Name: "",
    disableDashing: false,
    encounterList: [],
    encounterStep: 30,
    note: "",
    parallaxLoopX: false,
    parallaxLoopY: false,
    parallaxName: "",
    parallaxShow: true,
    parallaxSx: 0,
    parallaxSy: 0,
    scrollType: 0,
    specifyBattleback: false,
  };
}

/**
 * Fill map data with a basic indoor room: floor + surrounding walls.
 *
 * Layout (layer 0):
 *   Row 0..1     : A4 wall-top (ceiling visible from above)
 *   Row 2        : A4 wall-side (front face of wall)
 *   Row 3..h-2   : A2 floor, with A3 wall-side on left/right columns
 *   Row h-1      : A3 wall-side (bottom wall)
 */
function fillIndoorRoom(
  data: number[],
  w: number,
  h: number,
  layerSize: number
): void {
  const set = (x: number, y: number, layer: number, id: number) => {
    data[layer * layerSize + y * w + x] = id;
  };

  const wallRows = Math.min(2, h - 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y < wallRows) {
        // Ceiling rows: A4 wall-top (floor-type autotile, use shape 0 for uniform look)
        set(x, y, 0, TILE_A4_TOP);
      } else if (y === wallRows) {
        // Wall face row: A4 wall-side
        const hasL = x > 0;
        const hasR = x < w - 1;
        const shape = wallShape(true, hasR, true, hasL);
        set(x, y, 0, TILE_A4_WALL + shape);
      } else if (y === h - 1) {
        // Bottom wall: A3 wall-side
        const hasL = x > 0;
        const hasR = x < w - 1;
        const shape = wallShape(true, hasR, false, hasL);
        set(x, y, 0, TILE_A3_WALL + shape);
      } else if (x === 0) {
        // Left wall column: A3 wall-side
        const hasT = y > wallRows + 1;
        const hasB = y < h - 2;
        const shape = wallShape(hasT, true, hasB, false);
        set(x, y, 0, TILE_A3_WALL + shape);
      } else if (x === w - 1) {
        // Right wall column: A3 wall-side
        const hasT = y > wallRows + 1;
        const hasB = y < h - 2;
        const shape = wallShape(hasT, false, hasB, true);
        set(x, y, 0, TILE_A3_WALL + shape);
      } else {
        // Interior floor: A2 floor autotile
        set(x, y, 0, TILE_A2);
      }
    }
  }
}

export interface TemplateMapResult {
  map: MZ_Map;
  exitSlots: { x: number; y: number }[];
}

/**
 * Load a template map from the samplemaps directory.
 * Extracts original transfer-event positions as exitSlots
 * and keeps non-transfer decoration events (flames, chests, etc.).
 */
export function loadTemplateMap(
  sampleMapsPath: string,
  mapId: number
): TemplateMapResult | null {
  const filename = `Map${String(mapId).padStart(3, "0")}.json`;
  let filePath = path.join(sampleMapsPath, filename);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(sampleMapsPath, "data", filename);
  }

  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const mapData: MZ_Map = JSON.parse(raw);

  const exitSlots: { x: number; y: number }[] = [];
  const keptEvents: (MZ_Event | null)[] = [null];

  for (const evt of mapData.events) {
    if (!evt) continue;
    const hasTransfer = evt.pages.some((p) =>
      p.list.some((c) => c.code === 201)
    );
    if (hasTransfer) {
      exitSlots.push({ x: evt.x, y: evt.y });
    } else {
      keptEvents.push({ ...evt, id: keptEvents.length });
    }
  }

  mapData.events = keptEvents;
  return { map: mapData, exitSlots };
}

/**
 * Add an event to a map. Returns the assigned event ID.
 */
export function addEventToMap(
  map: MZ_Map,
  x: number,
  y: number,
  name: string,
  pages: MZ_EventPage[]
): number {
  const eventId = map.events.length;
  const event: MZ_Event = {
    id: eventId,
    name,
    note: "",
    x,
    y,
    pages,
  };
  map.events.push(event);
  return eventId;
}

/**
 * Create a simple event page with a character image and command list.
 */
export function createEventPage(
  commands: MZ_EventCommand[],
  options?: {
    characterName?: string;
    characterIndex?: number;
    direction?: number;
    trigger?: number;
    priorityType?: number;
    conditions?: Partial<ReturnType<typeof defaultConditions>>;
    moveType?: number;
  }
): MZ_EventPage {
  const conditions = { ...defaultConditions(), ...options?.conditions };
  return {
    conditions,
    directionFix: false,
    image: {
      characterName: options?.characterName || "",
      characterIndex: options?.characterIndex ?? 0,
      direction: options?.direction ?? DIR.DOWN,
      pattern: 0,
      tileId: 0,
    },
    list: commands,
    moveFrequency: 3,
    moveRoute: defaultMoveRoute(),
    moveSpeed: 3,
    moveType: options?.moveType ?? 0,
    priorityType: options?.priorityType ?? PRIORITY.SAME_AS_CHARACTERS,
    stepAnime: false,
    through: false,
    trigger: options?.trigger ?? TRIGGER.ACTION_BUTTON,
    walkAnime: true,
  };
}

/**
 * Create an empty event page (used for "after interaction" state).
 * Uses BELOW_CHARACTERS priority so the event doesn't block movement.
 */
export function createEmptyPage(
  conditions?: Partial<ReturnType<typeof defaultConditions>>
): MZ_EventPage {
  return createEventPage(
    [{ code: 0, indent: 0, parameters: [] }],
    {
      conditions,
      trigger: TRIGGER.ACTION_BUTTON,
      priorityType: PRIORITY.BELOW_CHARACTERS,
    }
  );
}

/**
 * Set the map's auto-play BGM.
 */
export function setMapBGM(map: MZ_Map, bgm: MZ_AudioFile): void {
  map.autoplayBgm = true;
  map.bgm = bgm;
}

/**
 * Set the map's auto-play BGS (background sound).
 */
export function setMapBGS(map: MZ_Map, bgs: MZ_AudioFile): void {
  map.autoplayBgs = true;
  map.bgs = bgs;
}

/**
 * Check if a position on the map is within bounds.
 */
export function isInBounds(map: MZ_Map, x: number, y: number): boolean {
  return x >= 0 && x < map.width && y >= 0 && y < map.height;
}

/**
 * Get tile ID at a given position and layer.
 */
export function getTileAt(map: MZ_Map, x: number, y: number, layer: number = 0): number {
  const index = (layer * map.height + y) * map.width + x;
  return map.data[index] ?? 0;
}

/**
 * Set tile ID at a given position and layer.
 */
export function setTileAt(map: MZ_Map, x: number, y: number, layer: number, tileId: number): void {
  const index = (layer * map.height + y) * map.width + x;
  if (index >= 0 && index < map.data.length) {
    map.data[index] = tileId;
  }
}

function isFloorTileId(tileId: number): boolean {
  if (tileId >= TILE_A5 && tileId < TILE_A5_END) return true;
  return (tileId >= TILE_A2 && tileId < TILE_A3_ROOF);
}

/**
 * RPG Maker MZ passability check, matching Game_Map.checkPassage().
 * Iterates layers 0→3 (same order as MZ's allTiles: bottom layer first)
 * so that the base tile determines passability before decorations on
 * higher layers can override it.
 * If no flags provided, falls back to layer-0-only heuristic.
 */
export function isPassableAt(
  map: MZ_Map,
  x: number,
  y: number,
  flags?: number[]
): boolean {
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) return false;

  const layerSize = map.width * map.height;
  const idx = y * map.width + x;

  if (flags) {
    const bit = 0x0F;
    for (let layer = 0; layer < 4; layer++) {
      const tileId = map.data[layer * layerSize + idx];
      if (tileId === 0) continue;
      const f = flags[tileId] ?? 0;
      if ((f & 0x10) !== 0) continue;
      if ((f & bit) === 0) return true;
      if ((f & bit) === bit) return false;
    }
    return false;
  }

  return isFloorTileId(map.data[idx]);
}

/**
 * Find the nearest passable position to (targetX, targetY) via spiral search.
 */
export function findNearestPassable(
  map: MZ_Map,
  targetX: number,
  targetY: number,
  occupied?: Set<string>,
  flags?: number[]
): { x: number; y: number } {
  const cx = Math.max(0, Math.min(map.width - 1, targetX));
  const cy = Math.max(0, Math.min(map.height - 1, targetY));

  if (isPassableAt(map, cx, cy, flags) && !occupied?.has(`${cx},${cy}`)) {
    return { x: cx, y: cy };
  }

  const maxR = Math.max(map.width, map.height);
  for (let r = 1; r < maxR; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
        if (occupied?.has(`${x},${y}`)) continue;
        if (isPassableAt(map, x, y, flags)) return { x, y };
      }
    }
  }

  return { x: cx, y: cy };
}

/**
 * Place an event at the nearest passable position to (x,y).
 */
export function clampToWalkable(
  map: MZ_Map,
  x: number,
  y: number,
  isEdgeEvent: boolean = false,
  flags?: number[]
): { x: number; y: number } {
  const occupied = new Set(
    map.events.filter(Boolean).map(e => `${e!.x},${e!.y}`)
  );
  return findNearestPassable(map, x, y, occupied, flags);
}

/**
 * BFS flood-fill to compute all tiles reachable from (startX, startY).
 * Blocking positions (e.g. NPC events with SAME_AS_CHARACTERS priority)
 * are treated as impassable walls.
 */
export function computeReachable(
  map: MZ_Map,
  startX: number,
  startY: number,
  blockingPositions: Set<string>,
  flags?: number[]
): Set<string> {
  const reachable = new Set<string>();
  const startKey = `${startX},${startY}`;

  if (!isPassableAt(map, startX, startY, flags) || blockingPositions.has(startKey)) {
    return reachable;
  }

  const queue: [number, number][] = [[startX, startY]];
  reachable.add(startKey);

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      const nk = `${nx},${ny}`;
      if (reachable.has(nk)) continue;
      if (!isPassableAt(map, nx, ny, flags)) continue;
      if (blockingPositions.has(nk)) continue;
      reachable.add(nk);
      queue.push([nx, ny]);
    }
  }

  return reachable;
}

/**
 * Find an open passable position on the map near (preferX, preferY).
 */
export function findOpenPosition(
  map: MZ_Map,
  preferX?: number,
  preferY?: number,
  flags?: number[]
): { x: number; y: number } {
  const cx = preferX ?? Math.floor(map.width / 2);
  const cy = preferY ?? Math.floor(map.height / 2);
  const occupied = new Set(
    map.events.filter(Boolean).map(e => `${e!.x},${e!.y}`)
  );
  return findNearestPassable(map, cx, cy, occupied, flags);
}

/**
 * Check if a tile is a narrow passage (≤2 passable orthogonal neighbors).
 * Placing a SAME_AS_CHARACTERS event here would block the corridor.
 */
export function isNarrowPassage(
  map: MZ_Map,
  x: number,
  y: number,
  flags?: number[]
): boolean {
  if (!isPassableAt(map, x, y, flags)) return false;

  let passable = 0;
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    if (isPassableAt(map, x + dx, y + dy, flags)) passable++;
  }

  return passable <= 2;
}

/**
 * Collect the set of all narrow-passage tiles on the map.
 * Used to prevent NPC placement from blocking corridors.
 */
export function collectNarrowPassages(
  map: MZ_Map,
  flags?: number[]
): Set<string> {
  const passages = new Set<string>();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (isNarrowPassage(map, x, y, flags)) {
        passages.add(`${x},${y}`);
      }
    }
  }
  return passages;
}

/**
 * Check if a position has star-passable decoration tiles on upper layers.
 * Tiles like beds, tables, and counters are technically walkable but
 * visually inappropriate for NPC placement.
 */
export function hasUpperLayerDecoration(
  map: MZ_Map,
  x: number,
  y: number,
  flags?: number[]
): boolean {
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) return false;
  const layerSize = map.width * map.height;
  const idx = y * map.width + x;
  for (let layer = 1; layer <= 2; layer++) {
    const tileId = map.data[layer * layerSize + idx];
    if (tileId === 0) continue;
    if (flags) {
      const f = flags[tileId] ?? 0;
      if ((f & 0x10) !== 0) return true;
    } else {
      return true;
    }
  }
  return false;
}
