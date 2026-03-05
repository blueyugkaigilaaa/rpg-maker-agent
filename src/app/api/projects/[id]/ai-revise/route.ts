import {
  getProject,
  getStepResult,
  getAnnotations,
  saveStepResult,
  archiveActiveAnnotations,
  updateProject,
  STAGE_ORDER,
} from "@/lib/db";
import type { AnnotationRow } from "@/lib/db";
import { chatCompletionStream } from "@/llm/client";
import { getStagePrompt } from "@/pipeline/prompts";
import type { PipelineStage } from "@/pipeline/types";

function buildRevisePrompts(
  originalPrompt: string,
  resultJson: string,
  annotations: AnnotationRow[],
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are an assistant that revises JSON data based on user annotations.

The JSON must follow this exact schema and format requirements:
${originalPrompt}

Below you will receive the current JSON data and a list of user annotations.
Each annotation targets a specific element (identified by its JSON path) and contains the user's feedback/request.

Revise the JSON according to ALL annotations while:
- Preserving the overall structure and schema
- Keeping all unchanged fields intact
- Only modifying what the annotations request

All human-readable text values (names, descriptions, dialogue, etc.) MUST be in Chinese (中文). Only IDs and technical fields stay in English.

Return ONLY the complete revised JSON object.`;

  const annotationLines = annotations
    .map((a, i) => `${i + 1}. Path: ${a.element_path} — "${a.content}"`)
    .join("\n");

  const userPrompt = `## Current JSON:\n${resultJson}\n\n## Annotations:\n${annotationLines}`;

  return { systemPrompt, userPrompt };
}

/**
 * For scene_building (an array of scenes), group annotations by scene index
 * and revise only the scenes that have annotations, one at a time.
 */
function groupAnnotationsBySceneIndex(
  annotations: AnnotationRow[],
): Map<number, AnnotationRow[]> {
  const groups = new Map<number, AnnotationRow[]>();
  for (const ann of annotations) {
    const match = ann.element_path.match(/^\[(\d+)\]/);
    if (match) {
      const idx = parseInt(match[1], 10);
      const list = groups.get(idx) ?? [];
      list.push({
        ...ann,
        element_path: ann.element_path.replace(/^\[\d+\]/, ""),
      });
      groups.set(idx, list);
    } else {
      const list = groups.get(-1) ?? [];
      list.push(ann);
      groups.set(-1, list);
    }
  }
  return groups;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const stage = body.stage as string;
  if (!stage) {
    return new Response(JSON.stringify({ error: "stage is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stepResult = getStepResult(id, stage as PipelineStage);
  if (!stepResult) {
    return new Response(JSON.stringify({ error: "No step result to revise" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const annotations = getAnnotations(id, stage).filter((a) => a.status === "active");
  if (annotations.length === 0) {
    return new Response(JSON.stringify({ error: "No active annotations" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const originalPrompt = getStagePrompt(stage);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }

      sendEvent("stage_update", { stage, status: "revising" });

      try {
        let finalResult: unknown;

        if (stage === "scene_building") {
          finalResult = await reviseSceneBuildingPerScene(
            id, stepResult.result_json, annotations, originalPrompt, sendEvent,
          );
        } else {
          const { systemPrompt, userPrompt } = buildRevisePrompts(
            originalPrompt, stepResult.result_json, annotations,
          );
          finalResult = await chatCompletionStream<unknown>(
            systemPrompt, userPrompt,
            {
              projectId: id,
              stage: `ai_revise:${stage}`,
              onToken: (token) => sendEvent("token", { token }),
            },
            { temperature: 0.3 },
          );
        }

        const revisedJson = JSON.stringify(finalResult);
        saveStepResult(id, stage as PipelineStage, revisedJson);
        archiveActiveAnnotations(id, stage);

        const stageIdx = STAGE_ORDER.indexOf(stage as PipelineStage);
        const nextStage: PipelineStage = stageIdx >= 0 && stageIdx < STAGE_ORDER.length - 1
          ? STAGE_ORDER[stageIdx + 1]
          : stage as PipelineStage;
        updateProject(id, { current_stage: nextStage, status: "idle" });

        sendEvent("result", { stage, result: finalResult });
        sendEvent("stage_update", { stage, status: "done" });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        sendEvent("error", { stage, error: errMsg });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function reviseSceneBuildingPerScene(
  projectId: string,
  resultJson: string,
  annotations: AnnotationRow[],
  originalPrompt: string,
  sendEvent: (event: string, data: unknown) => void,
): Promise<unknown[]> {
  const scenes = JSON.parse(resultJson) as Record<string, unknown>[];
  const groups = groupAnnotationsBySceneIndex(annotations);
  const sortedIndices = [...groups.keys()].sort((a, b) => a - b);

  const singleScenePrompt = originalPrompt.replace(
    /The JSON is an array of SceneDetail objects\./,
    "The JSON is a single SceneDetail object.",
  );

  for (const sceneIdx of sortedIndices) {
    const sceneAnns = groups.get(sceneIdx)!;

    if (sceneIdx === -1 || sceneIdx >= scenes.length) {
      console.warn(`[ai_revise] Skipping annotations with unmapped index: ${sceneIdx}`);
      continue;
    }

    const scene = scenes[sceneIdx];
    const sceneId = String(scene.sceneId ?? sceneIdx);
    sendEvent("token", { token: `\n--- Revising scene ${sceneIdx}: ${sceneId} (${sceneAnns.length} annotations) ---\n` });

    const { systemPrompt, userPrompt } = buildRevisePrompts(
      singleScenePrompt,
      JSON.stringify(scene),
      sceneAnns,
    );

    const revised = await chatCompletionStream<Record<string, unknown>>(
      systemPrompt, userPrompt,
      {
        projectId,
        stage: `ai_revise:scene_building[${sceneIdx}]`,
        onToken: (token) => sendEvent("token", { token }),
      },
      { temperature: 0.3 },
    );

    scenes[sceneIdx] = revised;
    sendEvent("token", { token: `\n--- Scene ${sceneId} done ---\n` });
  }

  return scenes;
}
