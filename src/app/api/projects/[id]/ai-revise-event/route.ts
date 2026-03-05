import { getProject } from "@/lib/db";
import { chatCompletion } from "@/llm/client";
import type { SceneEvent } from "@/pipeline/types";

const SYSTEM_PROMPT = `You are an RPG event editor for RPG Maker MZ.
You will receive a single scene event JSON object and a user instruction.
Modify the event according to the instruction while preserving:
- The event structure (id, type, x, y, trigger, conditions)
- All fields not mentioned in the instruction

The event types are: npc_dialogue, transfer, autorun_cutscene, area_trigger.
For npc_dialogue events, you may edit: dialogue lines, choices, moveType (fixed/random/approach), characterId.
Control transfer: add "controlTransferTarget": "<eventId>" on a choice to make the player control that NPC when selected (original stays in place).
For autorun_cutscene / area_trigger events, you may edit: dialogue lines, conditions.

Protagonist costume change (e.g. "将玩家形象切换为 People5[1]"): add changeActorImage on the CHOICE that triggers it:
  "changeActorImage": {
    "characterImage": "People5",
    "characterIndex": 1,
    "faceImage": "People5",
    "faceIndex": 1
  }
- actorId is optional (defaults to 1 = protagonist).
- Use asset names from the project (e.g. People5, Actor1). Index is 0-based in the file.
- Do NOT use preActions, change_player_appearance, add_party_members, or other custom structures.

All dialogue text and player-facing strings MUST be in Chinese (中文).
Return ONLY the complete revised event JSON object — no explanations.`;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const event = body.event as SceneEvent | undefined;
  const instruction = body.instruction as string | undefined;

  if (!event || !instruction) {
    return Response.json(
      { error: "event and instruction are required" },
      { status: 400 },
    );
  }

  try {
    const userPrompt = `## Current Event:\n${JSON.stringify(event, null, 2)}\n\n## Instruction:\n${instruction}`;

    const revised = await chatCompletion<SceneEvent>(
      SYSTEM_PROMPT,
      userPrompt,
      { projectId: id, stage: "ai_revise_event" },
      { temperature: 0.3, maxTokens: 8000 },
    );

    return Response.json({ event: revised });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
