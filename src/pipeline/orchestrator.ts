import type {
  PipelineStage,
  TextAnalysis,
  GameDesign,
  ScenePlan,
  SceneDetail,
  AssetMapping,
} from "@/pipeline/types";
import { analyzeText } from "@/pipeline/text-analyzer";
import { designGame } from "@/pipeline/game-designer";
import { planScenes } from "@/pipeline/scene-planner";
import { buildScenes } from "@/pipeline/scene-builder";
import { mapAssets } from "@/pipeline/asset-mapper";
import { adaptToRPGMaker } from "@/pipeline/rpgmaker-adapter";
import { getStagePrompt } from "@/pipeline/prompts";
import {
  getProject,
  getStepResult,
  saveStepResult,
  updateProject,
  STAGE_ORDER,
} from "@/lib/db";
import type { LlmCallContext } from "@/llm/client";
import { chatCompletionStream } from "@/llm/client";

function nextStage(stage: PipelineStage): PipelineStage {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return "complete";
  return STAGE_ORDER[idx + 1];
}

function loadStepJson<T>(projectId: string, stage: PipelineStage): T {
  const row = getStepResult(projectId, stage);
  if (!row) throw new Error(`Missing prerequisite step result: ${stage}`);
  return JSON.parse(row.result_json) as T;
}

export async function runStep(
  projectId: string,
  stage: PipelineStage,
  onToken?: (token: string) => void,
): Promise<unknown> {
  const project = getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  updateProject(projectId, { status: "running", current_stage: stage, error: null });

  const ctx: LlmCallContext = { projectId, stage, onToken };

  console.log(`[Pipeline] Running step: ${stage} for project ${projectId.slice(0, 8)}`);
  const start = Date.now();

  try {
    let result: unknown;

    switch (stage) {
      case "text_analysis": {
        result = await analyzeText(project.article_text, ctx);
        break;
      }
      case "game_design": {
        const analysis = loadStepJson<TextAnalysis>(projectId, "text_analysis");
        result = await designGame(analysis, ctx);
        break;
      }
      case "scene_planning": {
        const analysis = loadStepJson<TextAnalysis>(projectId, "text_analysis");
        const design = loadStepJson<GameDesign>(projectId, "game_design");
        result = await planScenes(analysis, design, ctx);
        break;
      }
      case "scene_building": {
        const analysis = loadStepJson<TextAnalysis>(projectId, "text_analysis");
        const design = loadStepJson<GameDesign>(projectId, "game_design");
        const plan = loadStepJson<ScenePlan>(projectId, "scene_planning");
        result = await buildScenes(analysis, design, plan, ctx);
        break;
      }
      case "asset_mapping": {
        const analysis = loadStepJson<TextAnalysis>(projectId, "text_analysis");
        const plan = loadStepJson<ScenePlan>(projectId, "scene_planning");
        result = await mapAssets(analysis, plan, ctx);
        break;
      }
      case "rpgmaker_adapter": {
        const textAnalysis = loadStepJson<TextAnalysis>(projectId, "text_analysis");
        const gameDesign = loadStepJson<GameDesign>(projectId, "game_design");
        const scenePlan = loadStepJson<ScenePlan>(projectId, "scene_planning");
        const sceneDetails = loadStepJson<SceneDetail[]>(projectId, "scene_building");
        const assetMapping = loadStepJson<AssetMapping>(projectId, "asset_mapping");

        onToken?.("\nGenerating RPG Maker MZ project files...\n");
        const outputPath = await adaptToRPGMaker({
          textAnalysis,
          gameDesign,
          scenePlan,
          sceneDetails,
          assetMapping,
        });
        result = { outputPath };
        updateProject(projectId, { output_path: outputPath });
        break;
      }
      default:
        throw new Error(`Unknown stage: ${stage}`);
    }

    saveStepResult(projectId, stage, JSON.stringify(result));

    const next = nextStage(stage);
    updateProject(projectId, {
      current_stage: next,
      status: next === "complete" ? "completed" : "idle",
    });

    const elapsed = Date.now() - start;
    console.log(`[Pipeline] Step ${stage} completed in ${elapsed}ms`);

    return result;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Pipeline] Step ${stage} failed: ${errMsg}`);
    updateProject(projectId, { status: "error", error: errMsg });
    throw err;
  }
}

// Upstream dependencies for each stage
const STAGE_DEPS: Record<string, PipelineStage[]> = {
  text_analysis: [],
  game_design: ["text_analysis"],
  scene_planning: ["text_analysis", "game_design"],
  scene_building: ["text_analysis", "game_design", "scene_planning"],
  asset_mapping: ["text_analysis", "scene_planning"],
  rpgmaker_adapter: ["text_analysis", "game_design", "scene_planning", "scene_building", "asset_mapping"],
};

const STAGE_LABELS: Record<string, string> = {
  text_analysis: "文本分析",
  game_design: "游戏设计",
  scene_planning: "场景规划",
  scene_building: "场景构建",
  asset_mapping: "素材映射",
  rpgmaker_adapter: "工程生成",
};

/**
 * Incremental sync: use the previous result + new upstream data to produce
 * an adjusted result via LLM, preserving manual edits where possible.
 *
 * For deterministic stages (rpgmaker_adapter), falls back to full re-run.
 * For text_analysis (no upstream), also falls back to full re-run.
 */
export async function syncStep(
  projectId: string,
  stage: PipelineStage,
  onToken?: (token: string) => void,
): Promise<unknown> {
  // Deterministic or no-upstream stages: just re-run
  if (stage === "rpgmaker_adapter" || stage === "text_analysis") {
    return runStep(projectId, stage, onToken);
  }

  const project = getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const currentResult = getStepResult(projectId, stage);
  if (!currentResult) {
    return runStep(projectId, stage, onToken);
  }

  updateProject(projectId, { status: "running", current_stage: stage, error: null });

  console.log(`[Pipeline] Syncing step: ${stage} for project ${projectId.slice(0, 8)}`);
  const start = Date.now();

  try {
    const deps = STAGE_DEPS[stage] || [];
    const upstreamSections = deps.map((dep) => {
      const row = getStepResult(projectId, dep);
      const label = STAGE_LABELS[dep] || dep;
      return `### ${label} (${dep}):\n${row?.result_json ?? "(missing)"}`;
    }).join("\n\n");

    const originalPrompt = getStagePrompt(stage);

    const systemPrompt = `You are an assistant that incrementally updates a pipeline step result after upstream data has changed.

The JSON must follow this exact schema and format requirements:
${originalPrompt}

Your task: The upstream steps have been modified. You have the PREVIOUS result for this step and the NEW upstream data.
Revise the result to be consistent with the new upstream data while:
- Preserving all user-edited fields and customizations (e.g. manually set IDs, labels, positions, markers)
- Only changing what's necessary to maintain consistency with upstream changes
- If upstream added new items (characters, scenes, etc.), add corresponding entries
- If upstream removed items, remove corresponding entries
- If upstream renamed items, update references accordingly
- Keep the overall structure and schema intact

All human-readable text values (names, descriptions, dialogue, etc.) MUST be in Chinese (中文). Only IDs and technical fields stay in English.

Return ONLY the complete revised JSON object.`;

    const userPrompt = `## Previous Result (this step):\n${currentResult.result_json}\n\n## New Upstream Data:\n${upstreamSections}`;

    const result = await chatCompletionStream<unknown>(
      systemPrompt,
      userPrompt,
      {
        projectId,
        stage: `sync:${stage}`,
        onToken,
      },
      { temperature: 0.3 },
    );

    const resultJson = JSON.stringify(result);
    saveStepResult(projectId, stage, resultJson);

    updateProject(projectId, { status: "idle", error: null });

    const elapsed = Date.now() - start;
    console.log(`[Pipeline] Sync ${stage} completed in ${elapsed}ms`);

    return result;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Pipeline] Sync ${stage} failed: ${errMsg}`);
    updateProject(projectId, { status: "error", error: errMsg });
    throw err;
  }
}
