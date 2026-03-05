// RPG Maker MZ JSON data structure types
// Based on rmmz_managers.js DataManager._databaseFiles

export interface MZ_AudioFile {
  name: string;
  volume: number;
  pitch: number;
  pan: number;
}

// ---- Actors.json ----

export interface MZ_Actor {
  id: number;
  name: string;
  nickname: string;
  classId: number;
  battlerName: string;
  characterIndex: number;
  characterName: string;
  faceIndex: number;
  faceName: string;
  equips: number[];
  initialLevel: number;
  maxLevel: number;
  traits: MZ_Trait[];
  note: string;
  profile: string;
}

export interface MZ_Trait {
  code: number;
  dataId: number;
  value: number;
}

// ---- Map*.json ----

export interface MZ_Map {
  displayName: string;
  tilesetId: number;
  width: number;
  height: number;
  data: number[];
  events: (MZ_Event | null)[];
  autoplayBgm: boolean;
  bgm: MZ_AudioFile;
  autoplayBgs: boolean;
  bgs: MZ_AudioFile;
  battleback1Name: string;
  battleback2Name: string;
  disableDashing: boolean;
  encounterList: MZ_EncounterEntry[];
  encounterStep: number;
  note: string;
  parallaxLoopX: boolean;
  parallaxLoopY: boolean;
  parallaxName: string;
  parallaxShow: boolean;
  parallaxSx: number;
  parallaxSy: number;
  scrollType: number;
  specifyBattleback: boolean;
}

export interface MZ_EncounterEntry {
  troopId: number;
  weight: number;
  regionSet: number[];
}

export interface MZ_Event {
  id: number;
  name: string;
  note: string;
  x: number;
  y: number;
  pages: MZ_EventPage[];
}

export interface MZ_EventPage {
  conditions: MZ_EventConditions;
  directionFix: boolean;
  image: MZ_EventImage;
  list: MZ_EventCommand[];
  moveFrequency: number;
  moveRoute: MZ_MoveRoute;
  moveSpeed: number;
  moveType: number;
  priorityType: number;
  stepAnime: boolean;
  through: boolean;
  trigger: number; // 0=Action, 1=PlayerTouch, 2=EventTouch, 3=Autorun, 4=Parallel
  walkAnime: boolean;
}

export interface MZ_EventConditions {
  actorId: number;
  actorValid: boolean;
  itemId: number;
  itemValid: boolean;
  selfSwitchCh: string;
  selfSwitchValid: boolean;
  switch1Id: number;
  switch1Valid: boolean;
  switch2Id: number;
  switch2Valid: boolean;
  variableId: number;
  variableValid: boolean;
  variableValue: number;
}

export interface MZ_EventImage {
  characterIndex: number;
  characterName: string;
  direction: number;
  pattern: number;
  tileId: number;
}

export interface MZ_EventCommand {
  code: number;
  indent: number;
  parameters: unknown[];
}

export interface MZ_MoveRoute {
  list: MZ_MoveCommand[];
  repeat: boolean;
  skippable: boolean;
  wait: boolean;
}

export interface MZ_MoveCommand {
  code: number;
  parameters?: unknown[];
}

// ---- System.json ----

export interface MZ_System {
  advanced: MZ_SystemAdvanced;
  airship: MZ_Vehicle;
  armorTypes: string[];
  attackMotions: MZ_AttackMotion[];
  battleBgm: MZ_AudioFile;
  battleback1Name: string;
  battleback2Name: string;
  battlerHue: number;
  battlerName: string;
  battleSystem: number;
  boat: MZ_Vehicle;
  currencyUnit: string;
  defeatMe: MZ_AudioFile;
  editMapId: number;
  elements: string[];
  equipTypes: string[];
  gameTitle: string;
  gameoverMe: MZ_AudioFile;
  locale: string;
  magicSkills: number[];
  menuCommands: boolean[];
  optAutosave: boolean;
  optDisplayTp: boolean;
  optDrawTitle: boolean;
  optExtraExp: boolean;
  optFloorDeath: boolean;
  optFollowers: boolean;
  optKeyItemsNumber: boolean;
  optSideView: boolean;
  optSlipDeath: boolean;
  optTransparent: boolean;
  partyMembers: number[];
  ship: MZ_Vehicle;
  skillTypes: string[];
  sounds: MZ_AudioFile[];
  startMapId: number;
  startX: number;
  startY: number;
  switches: string[];
  terms: MZ_Terms;
  testBattlers: MZ_TestBattler[];
  testTroopId: number;
  title1Name: string;
  title2Name: string;
  titleBgm: MZ_AudioFile;
  titleCommandWindow: MZ_TitleCommandWindow;
  variables: string[];
  versionId: number;
  victoryMe: MZ_AudioFile;
  weaponTypes: string[];
  windowTone: number[];
}

export interface MZ_SystemAdvanced {
  gameId: number;
  screenWidth: number;
  screenHeight: number;
  uiAreaWidth: number;
  uiAreaHeight: number;
  numberFontFilename: string;
  fallbackFonts: string;
  fontSize: number;
  mainFontFilename: string;
  windowOpacity: number;
}

export interface MZ_Vehicle {
  bgm: MZ_AudioFile;
  characterIndex: number;
  characterName: string;
  startMapId: number;
  startX: number;
  startY: number;
}

export interface MZ_AttackMotion {
  type: number;
  weaponImageId: number;
}

export interface MZ_Terms {
  basic: string[];
  commands: (string | null)[];
  params: string[];
  messages: Record<string, string>;
}

export interface MZ_TestBattler {
  actorId: number;
  equips: number[];
  level: number;
}

export interface MZ_TitleCommandWindow {
  background: number;
  offsetX: number;
  offsetY: number;
}

// ---- MapInfos.json ----

export interface MZ_MapInfo {
  id: number;
  expanded: boolean;
  name: string;
  order: number;
  parentId: number;
  scrollX: number;
  scrollY: number;
}

// ---- CommonEvents.json ----

export interface MZ_CommonEvent {
  id: number;
  list: MZ_EventCommand[];
  name: string;
  switchId: number;
  trigger: number;
}

// ---- Tilesets.json ----

export interface MZ_Tileset {
  id: number;
  flags: number[];
  mode: number;
  name: string;
  note: string;
  tilesetNames: string[];
}

// ---- Classes.json ----

export interface MZ_Class {
  id: number;
  name: string;
  expParams: number[];
  traits: MZ_Trait[];
  learnings: MZ_Learning[];
  note: string;
  params: number[][];
}

export interface MZ_Learning {
  level: number;
  note: string;
  skillId: number;
}
