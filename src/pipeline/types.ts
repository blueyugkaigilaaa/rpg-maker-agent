// ============================================================
// Intermediate data types for the generation pipeline
// Module 1 → 2 → 3 → 4 → 5 → 6
// ============================================================

// ---- Module 1: Text Analyzer Output ----

export interface Character {
  id: string;
  name: string;
  role: "protagonist" | "supporting" | "minor" | "group";
  description: string;
  personality: string;
  appearance: string;
  speechStyle: string;
  relationToProtagonist: string;
}

export interface TimelineEvent {
  id: string;
  order: number;
  description: string;
  characterIds: string[];
  locationId: string;
  emotionalTone: string;
  significance: "major" | "minor";
}

export interface Location {
  id: string;
  name: string;
  description: string;
  type: "indoor" | "outdoor" | "transition";
  atmosphere: string;
}

export interface EmotionalBeat {
  phase: string;
  emotion: string;
  intensity: number;
}

export interface TextAnalysis {
  title: string;
  author: string;
  summary: string;
  theme: string;
  characters: Character[];
  timeline: TimelineEvent[];
  locations: Location[];
  emotionalArc: EmotionalBeat[];
}

// ---- Module 2: Game Designer Output ----

export interface AnchorEvent {
  id: string;
  timelineEventId: string;
  description: string;
  locationId: string;
}

export interface ChoiceOption {
  id: string;
  text: string;
  consequence: string;
  nextNodeId: string;
}

export interface DecisionNode {
  id: string;
  locationId: string;
  triggerDescription: string;
  promptText: string;
  options: ChoiceOption[];
}

export interface GameFlowNode {
  id: string;
  type: "anchor" | "decision" | "transition" | "ending";
  description: string;
  locationId: string;
  nextNodeIds: string[];
}

export interface GameDesign {
  protagonistId: string;
  anchorEvents: AnchorEvent[];
  decisionNodes: DecisionNode[];
  gameFlow: GameFlowNode[];
  estimatedPlaytimeMinutes: number;
}

// ---- Module 3: Scene Planner Output ----

export interface SceneConnection {
  fromSceneId: string;
  toSceneId: string;
  transitionType: "door" | "walk" | "teleport" | "cutscene";
  description: string;
}

export interface SceneMeta {
  id: string;
  name: string;
  description: string;
  type: "indoor" | "outdoor";
  size: "small" | "medium" | "large";
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  atmosphere: string;
  mapTemplateHint: string;
  visitCount: number;
}

export interface ScenePlan {
  scenes: SceneMeta[];
  connections: SceneConnection[];
  startSceneId: string;
}

// ---- Module 4: Scene Builder Output ----

export interface DialogueLine {
  speakerCharacterId: string;
  text: string;
}

export interface ChangeActorImage {
  actorId?: number;
  characterImage: string;
  characterIndex: number;
  faceImage?: string;
  faceIndex?: number;
}

export interface DialogueChoice {
  text: string;
  resultDialogue: DialogueLine[];
  setSwitchId?: number;
  setSwitchValue?: boolean;
  changeActorImage?: ChangeActorImage;
  /** When set, selecting this choice triggers control transfer to the target NPC. Player controls target, original stays in place. */
  controlTransferTarget?: string; // SceneEvent id of the NPC to control
}

export interface DialogueSequence {
  id: string;
  lines: DialogueLine[];
  choices?: DialogueChoice[];
}

export interface NPCPlacement {
  characterId: string;
  x: number;
  y: number;
  direction: 2 | 4 | 6 | 8; // RPG Maker: 2=down, 4=left, 6=right, 8=up
}

export interface TransferEvent {
  targetSceneId: string;
  targetX: number;
  targetY: number;
  targetDirection: 2 | 4 | 6 | 8;
}

export interface SceneEvent {
  id: string;
  type: "npc_dialogue" | "transfer" | "autorun_cutscene" | "area_trigger";
  x: number;
  y: number;
  trigger: "action" | "player_touch" | "autorun" | "parallel";
  characterId?: string;
  moveType?: "fixed" | "random" | "approach";
  dialogue?: DialogueSequence;
  transfer?: TransferEvent;
  conditions?: {
    switchId?: number;
    switchValue?: boolean;
  };
  addToParty?: {
    characterId: string;
  };
}

export interface SceneDetail {
  sceneId: string;
  events: SceneEvent[];
  bgmName?: string;
  bgmVolume?: number;
  screenTone?: [number, number, number, number];
}

// ---- Module 5: Asset Mapper Output ----

export interface CharacterAsset {
  characterId: string;
  characterName: string;
  characterImage: string;
  characterIndex: number;
  faceImage: string;
  faceIndex: number;
}

export interface MapMarker {
  id: string;
  type: "exit" | "spawn" | "npc" | "area_trigger" | "autorun";
  x: number;
  y: number;
  label?: string;
  targetSceneId?: string;
  characterId?: string;
  direction?: 2 | 4 | 6 | 8;
}

export interface SceneAsset {
  sceneId: string;
  tilesetId: number;
  sampleMapId?: number;
  bgm: { name: string; volume: number; pitch: number; pan: number };
  bgs?: { name: string; volume: number; pitch: number; pan: number };
  markers?: MapMarker[];
}

export interface AssetMapping {
  characters: CharacterAsset[];
  scenes: SceneAsset[];
}

// ---- Pipeline State ----

export type PipelineStage =
  | "text_analysis"
  | "game_design"
  | "scene_planning"
  | "scene_building"
  | "asset_mapping"
  | "rpgmaker_adapter"
  | "complete"
  | "error";

export const PIPELINE_STAGES: PipelineStage[] = [
  "text_analysis",
  "game_design",
  "scene_planning",
  "scene_building",
  "asset_mapping",
  "rpgmaker_adapter",
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  text_analysis: "文本分析",
  game_design: "游戏设计",
  scene_planning: "场景规划",
  scene_building: "场景构建",
  asset_mapping: "素材映射",
  rpgmaker_adapter: "工程生成",
  complete: "完成",
  error: "出错",
};
