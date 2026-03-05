import { chatCompletionStream, type LlmCallContext } from "@/llm/client";
import {
  TextAnalysis,
  GameDesign,
  ScenePlan,
  SceneMeta,
  SceneDetail,
} from "@/pipeline/types";

const SCENE_SIZE_DIMENSIONS: Record<string, { w: number; h: number }> = {
  small: { w: 17, h: 13 },
  medium: { w: 25, h: 19 },
  large: { w: 33, h: 25 },
};

function buildSystemPrompt(scene: SceneMeta, isFirstScene: boolean): string {
  const dims = SCENE_SIZE_DIMENSIONS[scene.size] ?? { w: 17, h: 13 };

  return `You are an RPG event scripter for RPG Maker MZ. Create detailed events for the scene "${scene.name}" (${scene.description}).

CRITICAL: All dialogue text, choice text, and any player-facing strings MUST be written in Chinese (中文). This is an RPG game for Chinese-speaking players.

Map dimensions: ${dims.w}x${dims.h} tiles. Place events within these bounds (x: 1 to ${dims.w - 2}, y: 1 to ${dims.h - 2}). Avoid placing events on the edges (row/column 0 or max).

Create events of these types:
- "npc_dialogue": An NPC the player can talk to. Set trigger to "action". Include characterId and a dialogue sequence with lines. If this NPC is at a decision node, include choices. Also set "moveType" to control how this NPC moves autonomously on the map:
  - "fixed": NPC stays in place (use for shopkeepers, guards, seated characters, etc.)
  - "random": NPC wanders randomly (use for townspeople, wandering merchants, patrolling soldiers, animals, children playing, etc.)
  - "approach": NPC walks toward the player (use sparingly, only for NPCs that actively seek the player's attention)
  Choose the moveType that best fits each NPC's role and personality. Most background/ambient NPCs should use "random" to make the scene feel alive. Important story NPCs who the player needs to find easily can use "fixed".
- "transfer": A door or exit point that moves the player to another scene. Set trigger to "player_touch". Include transfer data with targetSceneId, targetX, targetY, targetDirection (2=down, 4=left, 6=right, 8=up).
- "autorun_cutscene": A cutscene that plays automatically when the player enters. Set trigger to "autorun". ${isFirstScene ? "This is the FIRST scene - include an opening autorun_cutscene that introduces the story." : "Only add autorun events if there is a story beat that triggers on entry."}
- "area_trigger": A trigger zone that activates when stepped on. Set trigger to "player_touch".

For dialogue choices (at decision nodes), include a "choices" array in the dialogue sequence:
{
  "text": "choice text shown to player",
  "resultDialogue": [{"speakerCharacterId": "...", "text": "..."}],
  "setSwitchId": number (optional, to track this choice),
  "setSwitchValue": true,
  "changeActorImage": { "characterImage": "People5", "characterIndex": 0, "faceImage": "People5", "faceIndex": 0 } (optional - changes the protagonist's sprite when this choice is picked; use for costume changes or transformations),
  "controlTransferTarget": "evt_xxx" (optional - event ID of another NPC on the same scene; when this choice is picked, the player controls that NPC while the original character stays in place)
}

SPECIAL EVENT CAPABILITIES:

1. Character image change (changeActorImage in a choice):
   When a dialogue choice should change the protagonist's appearance (e.g. costume change, transformation), add a "changeActorImage" field. The actorId defaults to 1 (protagonist) if not specified.

2. Control transfer (controlTransferTarget in a choice):
   When the player should take control of another character (e.g. possess an NPC, swap bodies), add "controlTransferTarget": "<eventId>" where eventId is the id of the target npc_dialogue event on the same scene. The original character stays visible at their position; the player moves as the target.

3. NPC joins party (addToParty on npc_dialogue event):
   When an NPC should join the player's party as a follower after interaction, add "addToParty": { "characterId": "<the NPC's characterId>" } to the event. The NPC will become a party member, walking behind the protagonist. After joining, the event's second page makes the NPC disappear from the map (since they now follow the player).

Keep dialogue concise - max 3-4 lines per NPC, max 2 lines per choice result. This ensures the output stays within size limits.

Output JSON:
{
  "sceneId": "${scene.id}",
  "events": [
    {
      "id": "string - unique event ID",
      "type": "npc_dialogue" | "transfer" | "autorun_cutscene" | "area_trigger",
      "x": "number",
      "y": "number",
      "trigger": "action" | "player_touch" | "autorun" | "parallel",
      "characterId": "string (optional - character ID for NPCs)",
      "moveType": "fixed" | "random" | "approach" (optional, for npc_dialogue only),
      "dialogue": {
        "id": "string",
        "lines": [{"speakerCharacterId": "string", "text": "string"}],
        "choices": [{"text": "string", "resultDialogue": [...], "setSwitchId": number, "setSwitchValue": boolean, "changeActorImage": {...}, "controlTransferTarget": "evt_xxx" }]
      },
      "transfer": {
        "targetSceneId": "string",
        "targetX": "number",
        "targetY": "number",
        "targetDirection": 2 | 4 | 6 | 8
      },
      "addToParty": { "characterId": "string" } (optional - NPC joins party),
      "conditions": {"switchId": number, "switchValue": boolean}
    }
  ],
  "bgmName": "string (optional - background music name)",
  "bgmVolume": "number (optional, default 90)",
  "screenTone": [r, g, b, gray] (optional - for atmosphere, e.g. [-34, -34, 0, 68] for evening)
}

PLACEMENT RULES:
- NPCs must be spread across the map. Keep at least 3 tiles of Manhattan distance between any two NPCs. Distribute them in different areas/quadrants of the room.
- Transfer events (doors/exits) must be placed on WALKABLE floor tiles adjacent to walls or map edges — never directly on a wall tile or on a decoration like a fireplace. Good spots: tiles right in front of a door frame, stairway, or corridor opening.
- Never place a transfer event at the same position as a fireplace, candle, or other decoration object.

IMPORTANT - One NPC per event: Each npc_dialogue event represents exactly ONE character on the map. If the story has two swindlers, create TWO separate npc_dialogue events (one per swindler), each with their own characterId, position, and dialogue. NEVER combine multiple characters into a single event. Every character present in a scene should have their own distinct npc_dialogue event.`;
}

export async function buildScenes(
  analysis: TextAnalysis,
  design: GameDesign,
  plan: ScenePlan,
  ctx: LlmCallContext,
): Promise<SceneDetail[]> {
  const results: SceneDetail[] = [];

  for (let i = 0; i < plan.scenes.length; i++) {
    const scene = plan.scenes[i];
    const isFirstScene = scene.id === plan.startSceneId;

    const relevantConnections = plan.connections.filter(
      (c) => c.fromSceneId === scene.id || c.toSceneId === scene.id,
    );

    const relevantAnchors = design.anchorEvents.filter(
      (a) =>
        a.locationId === scene.id ||
        findLocationScene(a.locationId, plan) === scene.id,
    );

    const relevantDecisions = design.decisionNodes.filter(
      (d) =>
        d.locationId === scene.id ||
        findLocationScene(d.locationId, plan) === scene.id,
    );

    const context = {
      scene,
      isFirstScene,
      connections: relevantConnections,
      anchors: relevantAnchors,
      decisions: relevantDecisions,
      characters: analysis.characters,
      allSceneIds: plan.scenes.map((s) => s.id),
    };

    const systemPrompt = buildSystemPrompt(scene, isFirstScene);
    const userPrompt = JSON.stringify(context, null, 2);

    ctx.onToken?.(`\n--- Building scene ${i + 1}/${plan.scenes.length}: ${scene.name} ---\n`);

    const detail = await chatCompletionStream<SceneDetail>(
      systemPrompt,
      userPrompt,
      { ...ctx, stage: `${ctx.stage}:${scene.id}` },
      { temperature: 0.7 },
    );

    results.push(detail);
  }

  return results;
}

function findLocationScene(
  locationId: string,
  plan: ScenePlan,
): string | undefined {
  const scene = plan.scenes.find(
    (s) =>
      s.id === locationId ||
      s.name.toLowerCase().includes(locationId.toLowerCase()),
  );
  return scene?.id;
}
