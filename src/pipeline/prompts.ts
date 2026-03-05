import { SYSTEM_PROMPT as TEXT_ANALYSIS_PROMPT } from "@/pipeline/text-analyzer";
import { SYSTEM_PROMPT as GAME_DESIGN_PROMPT } from "@/pipeline/game-designer";
import { SYSTEM_PROMPT as SCENE_PLANNING_PROMPT } from "@/pipeline/scene-planner";
import { getSystemPrompt as getAssetMappingPrompt } from "@/pipeline/asset-mapper";

const SCENE_BUILDING_PROMPT = `You are an RPG event scripter for RPG Maker MZ.
The JSON is an array of SceneDetail objects. Each has: sceneId, events[], bgmName?, bgmVolume?, screenTone?.
Each event has: id, type (npc_dialogue|transfer|autorun_cutscene|area_trigger), x, y, trigger, characterId?, dialogue?, transfer?, conditions?.
Preserve this exact structure when making revisions.
All dialogue text, choice text, and any player-facing strings MUST be in Chinese (中文).`;

const RPGMAKER_ADAPTER_PROMPT = `This stage produces RPG Maker MZ project files. The JSON contains { outputPath }. It is not directly editable via annotations.`;

const STATIC_PROMPTS: Record<string, string> = {
  text_analysis: TEXT_ANALYSIS_PROMPT,
  game_design: GAME_DESIGN_PROMPT,
  scene_planning: SCENE_PLANNING_PROMPT,
  scene_building: SCENE_BUILDING_PROMPT,
  rpgmaker_adapter: RPGMAKER_ADAPTER_PROMPT,
};

export function getStagePrompt(stage: string): string {
  if (stage === "asset_mapping") return getAssetMappingPrompt();
  return STATIC_PROMPTS[stage] ?? "Maintain the existing JSON structure.";
}
