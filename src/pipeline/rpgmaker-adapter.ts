import * as path from "path";
import * as fs from "fs";
import {
  EventBuilder,
  buildAutorunCutscene,
  buildTransferEvent,
  audioFile,
} from "@/rpgmaker/event-builder";
import {
  createEmptyMap,
  loadTemplateMap,
  addEventToMap,
  createEventPage,
  createEmptyPage,
  setMapBGM,
  findOpenPosition,
  clampToWalkable,
  findNearestPassable,
  isPassableAt,
  computeReachable,
  collectNarrowPassages,
  hasUpperLayerDecoration,
  TemplateMapResult,
} from "@/rpgmaker/map-builder";
import {
  buildProject,
  createDefaultSystem,
  createActor,
  createMapInfo,
  ProjectFiles,
} from "@/rpgmaker/project-builder";
import { CMD, TRIGGER, DIR, PRIORITY, defaultConditions } from "@/rpgmaker/constants";
import {
  TextAnalysis,
  GameDesign,
  ScenePlan,
  SceneDetail,
  SceneEvent,
  AssetMapping,
  CharacterAsset,
  MapMarker,
  ChangeActorImage,
} from "@/pipeline/types";
import { MZ_Map, MZ_EventPage } from "@/rpgmaker/types";

interface AdapterInput {
  textAnalysis: TextAnalysis;
  gameDesign: GameDesign;
  scenePlan: ScenePlan;
  sceneDetails: SceneDetail[];
  assetMapping: AssetMapping;
}

const SCENE_SIZE_DIMENSIONS: Record<string, { w: number; h: number }> = {
  small: { w: 17, h: 13 },
  medium: { w: 25, h: 19 },
  large: { w: 33, h: 25 },
};

export async function adaptToRPGMaker(state: AdapterInput): Promise<string> {
  const { textAnalysis, gameDesign, scenePlan, sceneDetails, assetMapping } = state;

  const templatePath = path.resolve(
    process.cwd(),
    "..",
    process.env.RPGMAKER_TEMPLATE_PATH || "template"
  );
  const sampleMapsPath = path.resolve(
    process.cwd(),
    "..",
    process.env.RPGMAKER_SAMPLEMAPS_PATH || "samplemaps"
  );
  const outputDir = path.join(process.cwd(), "generated", `project-${Date.now()}`);

  const sceneIdToMapId = new Map<string, number>();
  scenePlan.scenes.forEach((scene, index) => {
    sceneIdToMapId.set(scene.id, index + 1);
  });

  const charAssetMap = new Map<string, CharacterAsset>();
  for (const ca of assetMapping.characters) {
    charAssetMap.set(ca.characterId, ca);
  }

  // Pre-scan all events to find NPCs that can join the party,
  // and assign actor IDs starting after the protagonist (ID 1).
  const actorIdMap = new Map<string, number>();
  let nextActorId = 2;
  for (const detail of sceneDetails) {
    for (const evt of detail.events) {
      if (evt.addToParty && !actorIdMap.has(evt.addToParty.characterId)) {
        actorIdMap.set(evt.addToParty.characterId, nextActorId++);
      }
    }
  }

  const tilesetFlagsMap = loadAllTilesetFlags(templatePath);

  const maps: ProjectFiles["maps"] = [];
  // Track user-placed event positions per map so reachability relocation skips them
  const userPlacedPositions = new Map<number, Set<string>>();

  for (const sceneMeta of scenePlan.scenes) {
    const mapId = sceneIdToMapId.get(sceneMeta.id)!;
    const sceneAsset = assetMapping.scenes.find((s) => s.sceneId === sceneMeta.id);
    const detail = sceneDetails.find((d) => d.sceneId === sceneMeta.id);
    const dims = SCENE_SIZE_DIMENSIONS[sceneMeta.size] ?? { w: 17, h: 13 };
    const tilesetId = sceneAsset?.tilesetId ?? (sceneMeta.type === "indoor" ? 3 : 1);

    let map: MZ_Map | null = null;
    let exitSlots: { x: number; y: number }[] = [];
    if (sceneAsset?.sampleMapId) {
      const tmpl = loadTemplateMap(sampleMapsPath, sceneAsset.sampleMapId);
      if (tmpl) {
        map = tmpl.map;
        exitSlots = tmpl.exitSlots;
      }
    }
    if (!map) {
      map = createEmptyMap(dims.w, dims.h, tilesetId, sceneMeta.name);
    }
    map.displayName = sceneMeta.name;

    if (sceneAsset?.bgm) {
      setMapBGM(map, audioFile(
        sceneAsset.bgm.name,
        sceneAsset.bgm.volume,
        sceneAsset.bgm.pitch,
        sceneAsset.bgm.pan
      ));
    } else if (detail?.bgmName) {
      setMapBGM(map, audioFile(detail.bgmName, detail.bgmVolume ?? 90));
    }

    const flags = tilesetFlagsMap.get(map.tilesetId);
    const userMarkers = sceneAsset?.markers;

    // If user provided markers, use exit markers as exitSlots override
    if (userMarkers && userMarkers.length > 0) {
      const exitMarkers = userMarkers.filter((m: MapMarker) => m.type === "exit");
      if (exitMarkers.length > 0) {
        exitSlots = exitMarkers.map((m: MapMarker) => ({ x: m.x, y: m.y }));
      }
    }

    const availableExits = [...exitSlots];

    // Build marker position overrides keyed by event type+target for matching
    const markerOverrides = buildMarkerOverrides(userMarkers, sceneIdToMapId);

    // Pre-scan: which events are control transfer targets (need second page to hide when controlled)
    const controlTransferTargets = new Set<string>();
    if (detail) {
      for (const evt of detail.events) {
        for (const choice of evt.dialogue?.choices ?? []) {
          if (choice.controlTransferTarget) {
            controlTransferTargets.add(choice.controlTransferTarget);
          }
        }
      }
    }

    if (detail) {
      const pinnedSet = new Set<string>();
      for (const evt of detail.events) {
        const override = findAndConsumeMarkerOverride(evt, markerOverrides);
        if (override) {
          // User explicitly placed this marker — use the position directly,
          // bypassing all passability/reachability checks.
          const ox = override.x;
          const oy = override.y;
          pinnedSet.add(`${ox},${oy}`);
          switch (evt.type) {
            case "transfer": {
              const slotIdx = availableExits.findIndex(
                (s) => s.x === ox && s.y === oy,
              );
              if (slotIdx >= 0) availableExits.splice(slotIdx, 1);
              placeTransfer(map, evt, ox, oy, sceneIdToMapId);
              break;
            }
            case "npc_dialogue":
              placeNpcDialogue(map, evt, ox, oy, sceneIdToMapId, charAssetMap, actorIdMap, controlTransferTargets);
              break;
            case "autorun_cutscene":
              placeAutorunCutscene(map, evt, ox, oy, charAssetMap);
              break;
            case "area_trigger":
              placeAreaTrigger(map, evt, ox, oy, charAssetMap);
              break;
            default:
              placeEvent(map, evt, sceneIdToMapId, charAssetMap, availableExits, flags, actorIdMap, controlTransferTargets);
              break;
          }
          continue;
        }
        placeEvent(map, evt, sceneIdToMapId, charAssetMap, availableExits, flags, actorIdMap, controlTransferTargets);
      }
      if (pinnedSet.size > 0) {
        userPlacedPositions.set(mapId, pinnedSet);
      }
    }

    // Add player body event for control transfer: original character stays visible at old position
    const BODY_SWITCH_ID = 100;
    if (controlTransferTargets.size > 0) {
      const protagonistId = gameDesign?.protagonistId;
      const protagonistAsset = protagonistId ? charAssetMap.get(protagonistId) : undefined;
      const bodyChar = protagonistAsset?.characterImage ?? "Actor1";
      const bodyIdx = protagonistAsset?.characterIndex ?? 0;
      const bodyCond = defaultConditions();
      bodyCond.switch1Id = BODY_SWITCH_ID;
      bodyCond.switch1Valid = true;
      const bodyPage1 = createEventPage(
        [{ code: 0, indent: 0, parameters: [] }],
        { characterName: "", characterIndex: 0 },
      );
      const bodyPage2 = createEventPage(
        [{ code: 0, indent: 0, parameters: [] }],
        {
          characterName: bodyChar,
          characterIndex: bodyIdx,
          conditions: bodyCond,
        },
      );
      addEventToMap(map, 0, 0, "evt_player_body", [bodyPage1, bodyPage2]);
    }

    maps.push({ id: mapId, data: map });
  }

  fixTransferTargets(maps, tilesetFlagsMap);

  const startSceneMapId = sceneIdToMapId.get(scenePlan.startSceneId) ?? 1;
  const startMap = maps.find((m) => m.id === startSceneMapId)?.data;
  const startFlags = startMap ? tilesetFlagsMap.get(startMap.tilesetId) : undefined;

  // Check for user-defined spawn marker on start scene
  const startSceneAsset = assetMapping.scenes.find(
    (s) => s.sceneId === scenePlan.startSceneId,
  );
  const spawnMarker = startSceneAsset?.markers?.find(
    (m: MapMarker) => m.type === "spawn",
  );
  const startPos = spawnMarker
    ? { x: spawnMarker.x, y: spawnMarker.y }
    : startMap
      ? findOpenPosition(startMap, Math.floor(startMap.width / 2), Math.floor(startMap.height / 2), startFlags)
      : { x: 8, y: 6 };

  ensureAllEventsReachable(maps, startSceneMapId, startPos, tilesetFlagsMap, userPlacedPositions);

  const actors: (null | ReturnType<typeof createActor>)[] = [null];
  const protagonistAsset = charAssetMap.get(gameDesign.protagonistId);
  actors.push(
    createActor(
      1,
      protagonistAsset?.characterName ?? textAnalysis.title,
      protagonistAsset?.characterImage ?? "Actor1",
      protagonistAsset?.characterIndex ?? 0,
      protagonistAsset?.faceImage ?? "Actor1",
      protagonistAsset?.faceIndex ?? 0
    )
  );

  // Create Actor entries for NPCs that can join the party
  for (const [charId, actId] of actorIdMap) {
    const ca = charAssetMap.get(charId);
    // Pad actors array with nulls if there are gaps
    while (actors.length <= actId) actors.push(null);
    actors[actId] = createActor(
      actId,
      ca?.characterName ?? charId,
      ca?.characterImage ?? "Actor1",
      ca?.characterIndex ?? 0,
      ca?.faceImage ?? "Actor1",
      ca?.faceIndex ?? 0,
    );
  }

  const mapInfos: (null | ReturnType<typeof createMapInfo>)[] = [null];
  for (const sceneMeta of scenePlan.scenes) {
    const mapId = sceneIdToMapId.get(sceneMeta.id)!;
    mapInfos.push(createMapInfo(mapId, sceneMeta.name, 0, mapId));
  }

  const system = createDefaultSystem(
    textAnalysis.title,
    startSceneMapId,
    startPos.x,
    startPos.y,
    [1]
  );

  // Enable follower display when any NPC can join the party
  if (actorIdMap.size > 0) {
    system.optFollowers = true;
  }

  const project: ProjectFiles = {
    maps,
    mapInfos,
    actors,
    system,
    commonEvents: [null],
  };

  await buildProject(outputDir, templatePath, project);

  return outputDir;
}

function loadAllTilesetFlags(templatePath: string): Map<number, number[]> {
  const result = new Map<number, number[]>();
  try {
    const tsPath = path.join(templatePath, "data", "Tilesets.json");
    const tilesets: { flags: number[] }[] = JSON.parse(fs.readFileSync(tsPath, "utf-8"));
    for (let i = 0; i < tilesets.length; i++) {
      if (tilesets[i]?.flags) {
        result.set(i, tilesets[i].flags);
      }
    }
  } catch {
    // flags unavailable — passability will use heuristic fallback
  }
  return result;
}

/**
 * Direction offset: given a direction the player is facing (2/4/6/8),
 * return the tile offset that is one step in that direction.
 * Used to place the arrival position one tile "in front of" the exit,
 * so the player appears to have just walked through the door.
 */
const DIR_OFFSETS: Record<number, { dx: number; dy: number }> = {
  [DIR.DOWN]:  { dx: 0, dy: 1 },
  [DIR.LEFT]:  { dx: -1, dy: 0 },
  [DIR.RIGHT]: { dx: 1, dy: 0 },
  [DIR.UP]:    { dx: 0, dy: -1 },
};

function oppositeDirection(dir: number): number {
  switch (dir) {
    case DIR.DOWN:  return DIR.UP;
    case DIR.UP:    return DIR.DOWN;
    case DIR.LEFT:  return DIR.RIGHT;
    case DIR.RIGHT: return DIR.LEFT;
    default:        return DIR.DOWN;
  }
}

/**
 * Find the best arrival position near a return exit.
 * Prefers the tile one step in the opposite direction of the exit's facing,
 * so the player appears to walk out of the door naturally.
 */
function findArrivalNearExit(
  map: MZ_Map,
  exitX: number,
  exitY: number,
  exitDirection: number,
  occupied: Set<string>,
  flags?: number[],
): { x: number; y: number; direction: number } {
  const incomingDir = oppositeDirection(exitDirection);
  const offset = DIR_OFFSETS[incomingDir] ?? { dx: 0, dy: 1 };
  const preferredX = exitX + offset.dx;
  const preferredY = exitY + offset.dy;

  if (
    preferredX >= 0 && preferredX < map.width &&
    preferredY >= 0 && preferredY < map.height &&
    isPassableAt(map, preferredX, preferredY, flags) &&
    !occupied.has(`${preferredX},${preferredY}`)
  ) {
    return { x: preferredX, y: preferredY, direction: incomingDir };
  }

  // Preferred tile blocked — try all four adjacent tiles of the exit
  for (const [dir, off] of Object.entries(DIR_OFFSETS)) {
    const ax = exitX + off.dx;
    const ay = exitY + off.dy;
    if (
      ax >= 0 && ax < map.width &&
      ay >= 0 && ay < map.height &&
      isPassableAt(map, ax, ay, flags) &&
      !occupied.has(`${ax},${ay}`)
    ) {
      return { x: ax, y: ay, direction: Number(dir) };
    }
  }

  // All adjacent blocked — fall back to spiral search from exit position
  const fallback = findNearestPassable(map, exitX, exitY, occupied, flags);
  return { x: fallback.x, y: fallback.y, direction: incomingDir };
}

/**
 * Post-process all maps: for every Transfer Player command,
 * snap the arrival position to the correct tile on the destination map.
 * When a return exit exists, place the player one tile in front of it
 * (opposite direction) so they appear to walk through the door naturally.
 */
function fixTransferTargets(
  maps: ProjectFiles["maps"],
  tilesetFlagsMap: Map<number, number[]>
): void {
  const mapById = new Map(maps.map((m) => [m.id, m.data]));

  for (const { id: srcMapId, data: srcMap } of maps) {
    for (const evt of srcMap.events) {
      if (!evt) continue;
      for (const page of evt.pages) {
        for (const cmd of page.list) {
          if (cmd.code !== CMD.TRANSFER_PLAYER) continue;
          const targetMapId = cmd.parameters[1] as number;
          const destMap = mapById.get(targetMapId);
          if (!destMap) continue;

          const destFlags = tilesetFlagsMap.get(destMap.tilesetId);
          const occupied = new Set(
            destMap.events.filter(Boolean).map(e => `${e!.x},${e!.y}`)
          );

          const returnExit = findReturnExit(destMap, srcMapId);
          if (returnExit) {
            const arrival = findArrivalNearExit(
              destMap, returnExit.x, returnExit.y,
              returnExit.direction, occupied, destFlags
            );
            cmd.parameters[2] = arrival.x;
            cmd.parameters[3] = arrival.y;
            cmd.parameters[4] = arrival.direction;
          } else {
            const targetX = cmd.parameters[2] as number;
            const targetY = cmd.parameters[3] as number;
            const fixed = findNearestPassable(
              destMap, targetX, targetY, occupied, destFlags
            );
            cmd.parameters[2] = fixed.x;
            cmd.parameters[3] = fixed.y;
          }
        }
      }
    }
  }
}

/**
 * Find a transfer event on `map` that leads back to `returnMapId`.
 * Returns the event position and the direction the exit "faces"
 * (inferred from its position relative to the map center/edges).
 */
function findReturnExit(
  map: MZ_Map,
  returnMapId: number
): { x: number; y: number; direction: number } | null {
  for (const evt of map.events) {
    if (!evt) continue;
    for (const page of evt.pages) {
      for (const cmd of page.list) {
        if (cmd.code === CMD.TRANSFER_PLAYER && cmd.parameters[1] === returnMapId) {
          const dir = inferExitDirection(map, evt.x, evt.y);
          return { x: evt.x, y: evt.y, direction: dir };
        }
      }
    }
  }
  return null;
}

/**
 * Infer which direction an exit "faces" based on its position on the map.
 * Exits near the top edge face up, near the bottom face down, etc.
 * This determines which side the player should arrive from.
 */
function inferExitDirection(map: MZ_Map, x: number, y: number): number {
  const distTop = y;
  const distBottom = map.height - 1 - y;
  const distLeft = x;
  const distRight = map.width - 1 - x;

  const minDist = Math.min(distTop, distBottom, distLeft, distRight);

  if (minDist === distTop) return DIR.UP;
  if (minDist === distBottom) return DIR.DOWN;
  if (minDist === distLeft) return DIR.LEFT;
  return DIR.RIGHT;
}

// ---- Marker override helpers ----

interface MarkerOverride {
  x: number;
  y: number;
  type: string;
  targetSceneId?: string;
  characterId?: string;
  eventId?: string; // from prefill_<eventId> marker; enables 1:1 matching
}

function buildMarkerOverrides(
  userMarkers: MapMarker[] | undefined,
  _sceneIdToMapId: Map<string, number>,
): MarkerOverride[] {
  if (!userMarkers || userMarkers.length === 0) return [];
  return userMarkers
    .filter((m) => m.type !== "spawn")
    .map((m) => {
      const prefill = typeof m.id === "string" && m.id.startsWith("prefill_")
        ? m.id.slice(8) // "prefill_".length = 8
        : undefined;
      return {
        x: m.x,
        y: m.y,
        type: m.type,
        targetSceneId: m.targetSceneId,
        characterId: m.characterId,
        eventId: prefill,
      };
    });
}

function findAndConsumeMarkerOverride(
  evt: SceneEvent,
  overrides: MarkerOverride[],
): MarkerOverride | undefined {
  if (overrides.length === 0) return undefined;

  // Prefer exact eventId match for prefill markers (1:1)
  if (evt.id) {
    const idx = overrides.findIndex((o) => o.eventId === evt.id);
    if (idx >= 0) {
      const found = overrides[idx];
      overrides.splice(idx, 1);
      return found;
    }
  }

  if (evt.type === "transfer" && evt.transfer?.targetSceneId) {
    const idx = overrides.findIndex(
      (o) => o.type === "exit" && o.targetSceneId === evt.transfer!.targetSceneId,
    );
    if (idx >= 0) {
      const found = overrides[idx];
      overrides.splice(idx, 1);
      return found;
    }
  }
  if (evt.type === "npc_dialogue" && evt.characterId) {
    const idx = overrides.findIndex(
      (o) => o.type === "npc" && o.characterId === evt.characterId,
    );
    if (idx >= 0) {
      const found = overrides[idx];
      overrides.splice(idx, 1);
      return found;
    }
  }
  if (evt.type === "autorun_cutscene") {
    const idx = overrides.findIndex((o) => o.type === "autorun");
    if (idx >= 0) {
      const found = overrides[idx];
      overrides.splice(idx, 1);
      return found;
    }
  }
  if (evt.type === "area_trigger") {
    const idx = overrides.findIndex((o) => o.type === "area_trigger");
    if (idx >= 0) {
      const found = overrides[idx];
      overrides.splice(idx, 1);
      return found;
    }
  }
  return undefined;
}

const NPC_MIN_SPACING = 2;

function placeEvent(
  map: MZ_Map,
  evt: SceneEvent,
  sceneIdToMapId: Map<string, number>,
  charAssetMap: Map<string, CharacterAsset>,
  availableExits: { x: number; y: number }[],
  flags?: number[],
  actorIdMap?: Map<string, number>,
  controlTransferTargets?: Set<string>,
): void {
  if (evt.type === "transfer") {
    const pos = pickExitSlot(availableExits, evt.x, evt.y, map, flags);
    placeTransfer(map, evt, pos.x, pos.y, sceneIdToMapId);
    return;
  }

  if (evt.type === "npc_dialogue") {
    const exclusion = buildExclusionZone(map, NPC_MIN_SPACING);
    for (const k of collectNarrowPassages(map, flags)) {
      exclusion.add(k);
    }
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        if (hasUpperLayerDecoration(map, tx, ty, flags)) {
          exclusion.add(`${tx},${ty}`);
        }
      }
    }
    const pos = findNearestPassable(map, evt.x, evt.y, exclusion, flags);
    placeNpcDialogue(map, evt, pos.x, pos.y, sceneIdToMapId, charAssetMap, actorIdMap, controlTransferTargets);
    return;
  }

  const clamped = clampToWalkable(map, evt.x, evt.y, false, flags);
  const x = clamped.x;
  const y = clamped.y;

  switch (evt.type) {
    case "autorun_cutscene":
      placeAutorunCutscene(map, evt, x, y, charAssetMap);
      break;
    case "area_trigger":
      placeAreaTrigger(map, evt, x, y, charAssetMap);
      break;
  }
}

/**
 * Build a set of tiles to avoid when placing an NPC.
 * Each existing event gets a buffer zone of `buffer` tiles in every direction,
 * ensuring NPCs are spread across the map rather than clustered.
 */
function buildExclusionZone(map: MZ_Map, buffer: number): Set<string> {
  const occupied = new Set<string>();
  for (const evt of map.events) {
    if (!evt) continue;
    for (let dx = -buffer; dx <= buffer; dx++) {
      for (let dy = -buffer; dy <= buffer; dy++) {
        const x = evt.x + dx;
        const y = evt.y + dy;
        if (x >= 0 && x < map.width && y >= 0 && y < map.height) {
          occupied.add(`${x},${y}`);
        }
      }
    }
  }
  return occupied;
}

function pickExitSlot(
  availableExits: { x: number; y: number }[],
  hintX: number,
  hintY: number,
  map: MZ_Map,
  flags?: number[]
): { x: number; y: number } {
  if (availableExits.length === 0) {
    return clampToWalkable(map, hintX, hintY, false, flags);
  }

  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < availableExits.length; i++) {
    const d = Math.abs(availableExits[i].x - hintX) + Math.abs(availableExits[i].y - hintY);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  const slot = availableExits.splice(bestIdx, 1)[0];

  const occupied = new Set(
    map.events.filter(Boolean).map(e => `${e!.x},${e!.y}`)
  );

  if (isPassableAt(map, slot.x, slot.y, flags) && !occupied.has(`${slot.x},${slot.y}`)) {
    return slot;
  }

  // Exit slot is on an impassable tile (wall) or occupied by decoration —
  // snap to the nearest passable adjacent tile so player_touch can trigger.
  return findNearestPassable(map, slot.x, slot.y, occupied, flags);
}

// Default NPC sprite when characterId is empty or not in asset_mapping
const DEFAULT_NPC_CHAR = "People5";
const DEFAULT_NPC_INDEX = 0;

function placeNpcDialogue(
  map: MZ_Map,
  evt: SceneEvent,
  x: number,
  y: number,
  _sceneIdToMapId: Map<string, number>,
  charAssetMap: Map<string, CharacterAsset>,
  actorIdMap?: Map<string, number>,
  controlTransferTargets?: Set<string>,
): void {
  const builder = new EventBuilder();
  const charAsset = evt.characterId ? charAssetMap.get(evt.characterId) : undefined;
  const spriteChar = charAsset?.characterImage ?? DEFAULT_NPC_CHAR;
  const spriteIndex = charAsset?.characterIndex ?? DEFAULT_NPC_INDEX;
  const faceName = charAsset?.faceImage ?? "";
  const faceIndex = charAsset?.faceIndex ?? 0;

  if (evt.dialogue) {
    for (const line of evt.dialogue.lines) {
      const speakerAsset = charAssetMap.get(line.speakerCharacterId);
      builder.showText(
        speakerAsset?.faceImage ?? faceName,
        speakerAsset?.faceIndex ?? faceIndex,
        line.text ?? "",
        speakerAsset?.characterName ?? ""
      );
    }

    if (evt.dialogue.choices && evt.dialogue.choices.length > 0) {
      const choiceTexts = evt.dialogue.choices.map((c) => String(c?.text ?? ""));
      builder.showChoices(choiceTexts);

      for (let i = 0; i < evt.dialogue.choices.length; i++) {
        const choice = evt.dialogue.choices[i];
        builder.whenChoice(i, (b) => {
          // Control transfer: player controls target NPC, original stays (body event at vars 90-92)
          if (choice.controlTransferTarget) {
            const targetName = JSON.stringify(choice.controlTransferTarget);
            b.script(`
var events = $dataMap.events;
var targetName = ${targetName};
var targetId = -1;
var bodyId = -1;
for (var i = 1; i < events.length; i++) {
  if (events[i]) {
    if (events[i].name === targetName) targetId = i;
    if (events[i].name === 'evt_player_body') bodyId = i;
  }
}
if (targetId >= 0) {
  var te = events[targetId];
  var pg = te.pages[0];
  var tx = te.x;
  var ty = te.y;
  var cname = pg && pg.image ? (pg.image.characterName || 'People5') : 'People5';
  var cidx = pg && pg.image ? (pg.image.characterIndex || 0) : 0;
  $gameVariables.setValue(90, $gamePlayer.x);
  $gameVariables.setValue(91, $gamePlayer.y);
  $gameVariables.setValue(92, $gamePlayer.direction());
  $gameSwitches.setValue(100, true);
  if (bodyId >= 0) {
    $gameMap.event(bodyId).locate($gamePlayer.x, $gamePlayer.y);
    $gameMap.event(bodyId).setDirection($gamePlayer.direction());
  }
  $gamePlayer.locate(tx, ty);
  $gameActors.actor(1).setCharacterImage(cname, cidx);
  $gameActors.actor(1).setFaceImage(cname, cidx);
  $gamePlayer.refresh();
  $gameSelfSwitches.setValue([$gameMap.mapId(), targetId, 'A'], true);
}`);
          }
          for (const line of choice.resultDialogue ?? []) {
            const sa = charAssetMap.get(line.speakerCharacterId);
            b.showText(
              sa?.faceImage ?? "",
              sa?.faceIndex ?? 0,
              line.text ?? "",
              sa?.characterName ?? ""
            );
          }
          if (choice.setSwitchId != null && choice.setSwitchValue != null) {
            b.controlSwitch(choice.setSwitchId, choice.setSwitchId, choice.setSwitchValue);
          }
          if (choice.changeActorImage) {
            const img = choice.changeActorImage;
            const actorId = img.actorId ?? 1;
            b.changeActorImages(
              actorId,
              img.characterImage,
              img.characterIndex,
              img.faceImage ?? img.characterImage,
              img.faceIndex ?? img.characterIndex,
            );
          }
        });
      }
    }
  }

  // If this NPC triggers party join on interaction, add changePartyMember + self-switch
  const hasJoin = evt.addToParty && actorIdMap;
  const joinActorId = hasJoin ? actorIdMap.get(evt.addToParty!.characterId) : undefined;
  if (joinActorId) {
    builder.changePartyMember(joinActorId, true);
    builder.setSelfSwitch("A", true);
  }

  const commands = builder.end().build();
  const moveTypeMap: Record<string, number> = { fixed: 0, random: 1, approach: 2 };
  const mzMoveType = moveTypeMap[evt.moveType ?? "fixed"] ?? 0;

  const isControlTarget = controlTransferTargets?.has(evt.id);
  const pages: MZ_EventPage[] = [];

  if (joinActorId) {
    pages.push(
      createEventPage(commands, {
        characterName: spriteChar,
        characterIndex: spriteIndex,
        trigger: TRIGGER.ACTION_BUTTON,
        priorityType: PRIORITY.SAME_AS_CHARACTERS,
        moveType: mzMoveType,
      }),
      createEmptyPage({ selfSwitchCh: "A", selfSwitchValid: true }),
    );
  } else {
    pages.push(
      createEventPage(commands, {
        characterName: spriteChar,
        characterIndex: spriteIndex,
        trigger: TRIGGER.ACTION_BUTTON,
        priorityType: PRIORITY.SAME_AS_CHARACTERS,
        moveType: mzMoveType,
      }),
    );
    if (isControlTarget) {
      pages.push(createEmptyPage({ selfSwitchCh: "A", selfSwitchValid: true }));
    }
  }

  addEventToMap(map, x, y, evt.id, pages);
}

function placeTransfer(
  map: MZ_Map,
  evt: SceneEvent,
  x: number,
  y: number,
  sceneIdToMapId: Map<string, number>
): void {
  if (!evt.transfer) return;

  const targetMapId = sceneIdToMapId.get(evt.transfer.targetSceneId) ?? 1;
  const commands = buildTransferEvent(
    targetMapId,
    evt.transfer.targetX,
    evt.transfer.targetY,
    evt.transfer.targetDirection ?? DIR.DOWN,
    0
  );

  const page = createEventPage(commands, {
    trigger: TRIGGER.PLAYER_TOUCH,
    priorityType: PRIORITY.BELOW_CHARACTERS,
  });

  addEventToMap(map, x, y, evt.id, [page]);
}

function placeAutorunCutscene(
  map: MZ_Map,
  evt: SceneEvent,
  x: number,
  y: number,
  charAssetMap: Map<string, CharacterAsset>
): void {
  const commands = buildAutorunCutscene((builder) => {
    if (evt.dialogue) {
      for (const line of evt.dialogue.lines) {
        const sa = charAssetMap.get(line.speakerCharacterId);
        builder.showText(
          sa?.faceImage ?? "",
          sa?.faceIndex ?? 0,
          line.text ?? "",
          sa?.characterName ?? ""
        );
      }
    }
  });

  const page1 = createEventPage(commands, {
    trigger: TRIGGER.AUTORUN,
    priorityType: PRIORITY.BELOW_CHARACTERS,
  });

  const page2 = createEmptyPage({
    selfSwitchCh: "A",
    selfSwitchValid: true,
  });

  addEventToMap(map, x, y, evt.id, [page1, page2]);
}

function placeAreaTrigger(
  map: MZ_Map,
  evt: SceneEvent,
  x: number,
  y: number,
  charAssetMap: Map<string, CharacterAsset>
): void {
  const builder = new EventBuilder();

  if (evt.dialogue) {
    for (const line of evt.dialogue.lines) {
      const sa = charAssetMap.get(line.speakerCharacterId);
      builder.showText(
        sa?.faceImage ?? "",
        sa?.faceIndex ?? 0,
        line.text ?? "",
        sa?.characterName ?? ""
      );
    }
  }

  builder.setSelfSwitch("A", true);
  const commands = builder.end().build();

  const page1 = createEventPage(commands, {
    trigger: TRIGGER.PLAYER_TOUCH,
    priorityType: PRIORITY.BELOW_CHARACTERS,
  });

  const page2 = createEmptyPage({
    selfSwitchCh: "A",
    selfSwitchValid: true,
  });

  addEventToMap(map, x, y, evt.id, [page1, page2]);
}

// ---------------------------------------------------------------------------
//  Reachability check — ensure the player can reach every interactive event
// ---------------------------------------------------------------------------

const REACHABILITY_MAX_ITERATIONS = 5;

/**
 * After all events are placed and the player start position is known,
 * run a BFS flood-fill from every entry point on each map and verify
 * that every interactive event (NPC, transfer, area trigger) is reachable.
 * Unreachable events are relocated to the nearest reachable tile.
 */
function ensureAllEventsReachable(
  maps: ProjectFiles["maps"],
  startMapId: number,
  startPos: { x: number; y: number },
  tilesetFlagsMap: Map<number, number[]>,
  pinnedPositions?: Map<number, Set<string>>
): void {
  for (const { id: mapId, data: map } of maps) {
    const flags = tilesetFlagsMap.get(map.tilesetId);
    const entryPoints = collectEntryPoints(maps, mapId, startMapId, startPos);
    if (entryPoints.length === 0) continue;
    const pinned = pinnedPositions?.get(mapId);

    for (let iter = 0; iter < REACHABILITY_MAX_ITERATIONS; iter++) {
      if (!relocateUnreachableEvents(map, entryPoints, flags, pinned)) break;
    }
  }
}

/**
 * Collect every position at which a player may enter a given map:
 *   - the game start position (for the start map)
 *   - arrival coordinates of Transfer Player commands on OTHER maps
 */
function collectEntryPoints(
  maps: ProjectFiles["maps"],
  targetMapId: number,
  startMapId: number,
  startPos: { x: number; y: number }
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];

  if (targetMapId === startMapId) {
    points.push(startPos);
  }

  for (const { id: srcMapId, data: srcMap } of maps) {
    if (srcMapId === targetMapId) continue;
    for (const evt of srcMap.events) {
      if (!evt) continue;
      for (const page of evt.pages) {
        for (const cmd of page.list) {
          if (
            cmd.code === CMD.TRANSFER_PLAYER &&
            cmd.parameters[0] === 0 &&
            cmd.parameters[1] === targetMapId
          ) {
            points.push({
              x: cmd.parameters[2] as number,
              y: cmd.parameters[3] as number,
            });
          }
        }
      }
    }
  }

  return points;
}

/**
 * Single reachability pass:
 *   1. BFS from all entry points (NPC positions are walls)
 *   2. For each interactive event that the player cannot interact with,
 *      relocate it to the nearest reachable, unoccupied tile.
 * Returns true if any event was moved (caller should re-run).
 */
function relocateUnreachableEvents(
  map: MZ_Map,
  entryPoints: { x: number; y: number }[],
  flags?: number[],
  pinnedPositions?: Set<string>
): boolean {
  // 1. Build blocking set — events with SAME_AS_CHARACTERS block walking
  const blocking = new Set<string>();
  for (const evt of map.events) {
    if (!evt) continue;
    if (evt.pages.some(p => p.priorityType === PRIORITY.SAME_AS_CHARACTERS)) {
      blocking.add(`${evt.x},${evt.y}`);
    }
  }

  // 2. BFS from every entry point
  const reachable = new Set<string>();
  for (const entry of entryPoints) {
    for (const k of computeReachable(map, entry.x, entry.y, blocking, flags)) {
      reachable.add(k);
    }
  }

  // 3. Build the set of tiles that may NOT be used as relocation targets:
  //    tiles that are unreachable, or already occupied by an event / entry point
  const reserved = new Set<string>();
  for (const evt of map.events) {
    if (evt) reserved.add(`${evt.x},${evt.y}`);
  }
  for (const entry of entryPoints) {
    reserved.add(`${entry.x},${entry.y}`);
  }

  const exclusion = new Set<string>();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const k = `${x},${y}`;
      if (!reachable.has(k) || reserved.has(k) || hasUpperLayerDecoration(map, x, y, flags)) {
        exclusion.add(k);
      }
    }
  }

  // 4. Check each interactive event and relocate if unreachable or on decoration
  let anyMoved = false;
  for (const evt of map.events) {
    if (!evt) continue;
    if (!needsReachabilityCheck(evt)) continue;
    // Skip events that were explicitly placed by user markers
    if (pinnedPositions?.has(`${evt.x},${evt.y}`)) continue;

    const isSameAsChar = evt.pages.some(
      p => p.priorityType === PRIORITY.SAME_AS_CHARACTERS
    );
    const onDecoration = isSameAsChar && hasUpperLayerDecoration(map, evt.x, evt.y, flags);

    if (!canPlayerInteract(evt, reachable) || onDecoration) {
      const oldKey = `${evt.x},${evt.y}`;
      const newPos = findNearestPassable(map, evt.x, evt.y, exclusion, flags);

      if (newPos.x !== evt.x || newPos.y !== evt.y) {
        reserved.delete(oldKey);
        exclusion.delete(oldKey);

        evt.x = newPos.x;
        evt.y = newPos.y;

        const newKey = `${evt.x},${evt.y}`;
        reserved.add(newKey);
        exclusion.add(newKey);
        anyMoved = true;
      }
    }
  }

  return anyMoved;
}

/**
 * Does the player need to be able to reach this event?
 * Autorun / parallel events fire regardless of position, so skip them.
 * Decoration-only events (empty command list) are also skipped.
 */
function needsReachabilityCheck(
  evt: { pages: { trigger: number; list: { code: number }[] }[] }
): boolean {
  return evt.pages.some(p => {
    if (p.trigger === TRIGGER.AUTORUN || p.trigger === TRIGGER.PARALLEL) {
      return false;
    }
    return p.list.some(c => c.code !== CMD.END);
  });
}

/**
 * Can the player actually interact with this event given the reachable set?
 *
 * SAME_AS_CHARACTERS (NPC): blocks the tile — player needs any
 *   adjacent tile to be reachable (for ACTION_BUTTON) or to walk
 *   towards it (for PLAYER_TOUCH / EVENT_TOUCH).
 *
 * BELOW_CHARACTERS (transfer, area trigger): doesn't block — player
 *   needs to walk onto the exact tile.
 */
function canPlayerInteract(
  evt: { x: number; y: number; pages: { priorityType: number }[] },
  reachable: Set<string>
): boolean {
  const isSameAsChar = evt.pages.some(
    p => p.priorityType === PRIORITY.SAME_AS_CHARACTERS
  );

  if (isSameAsChar) {
    return (
      reachable.has(`${evt.x},${evt.y + 1}`) ||
      reachable.has(`${evt.x},${evt.y - 1}`) ||
      reachable.has(`${evt.x + 1},${evt.y}`) ||
      reachable.has(`${evt.x - 1},${evt.y}`)
    );
  }

  return reachable.has(`${evt.x},${evt.y}`);
}

