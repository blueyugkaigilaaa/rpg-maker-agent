import { chatCompletionStream, type LlmCallContext } from "@/llm/client";
import { TextAnalysis, GameDesign, ScenePlan } from "@/pipeline/types";

export const SYSTEM_PROMPT = `You are an RPG scene planner. Plan the map scenes for an RPG Maker MZ game based on the literary analysis and game design.

You MUST output all human-readable text values in Chinese (中文), including scene names, descriptions, atmosphere, mapTemplateHint, connection descriptions, etc. Only IDs and technical fields stay in English.

Create 5-10 map scenes. Each scene is a distinct map the player can visit.

For each scene provide:
- id: unique scene ID like "scene_01"
- name: display name for the map
- description: what this place is
- type: "indoor" or "outdoor"
- size: "small" (17x13), "medium" (25x19), or "large" (33x25)
- timeOfDay: "morning", "afternoon", "evening", or "night"
- atmosphere: the mood/feeling of this scene
- mapTemplateHint: describe what kind of map template to use, e.g. "tavern interior", "town street", "forest clearing", "mansion room", "castle hall", "village square", "cave entrance"
- visitCount: how many times the player is expected to visit (usually 1)

Define connections between scenes specifying how the player moves between them.

Output JSON:
{
  "scenes": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "type": "indoor" | "outdoor",
      "size": "small" | "medium" | "large",
      "timeOfDay": "morning" | "afternoon" | "evening" | "night",
      "atmosphere": "string",
      "mapTemplateHint": "string",
      "visitCount": "number"
    }
  ],
  "connections": [
    {
      "fromSceneId": "string",
      "toSceneId": "string",
      "transitionType": "door" | "walk" | "teleport" | "cutscene",
      "description": "string - e.g. 'Exit door to the south', 'Path leading north'"
    }
  ],
  "startSceneId": "string - the scene where the game begins"
}

Ensure the start scene matches where the first anchor event takes place.
Every scene must be reachable from the start scene through connections.
Connections should be bidirectional where appropriate (add two entries).`;

export async function planScenes(
  analysis: TextAnalysis,
  design: GameDesign,
  ctx: LlmCallContext,
): Promise<ScenePlan> {
  const userPrompt = JSON.stringify({ analysis, design }, null, 2);
  return chatCompletionStream<ScenePlan>(SYSTEM_PROMPT, userPrompt, ctx, {
    temperature: 0.7,
  });
}
