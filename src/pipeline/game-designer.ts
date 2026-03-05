import { chatCompletionStream, type LlmCallContext } from "@/llm/client";
import { TextAnalysis, GameDesign } from "@/pipeline/types";

export const SYSTEM_PROMPT = `You are an expert RPG game designer. Convert a literary analysis into an interactive RPG game design where the player IS the protagonist (first-person perspective).

You MUST output all human-readable text values in Chinese (中文), including descriptions, choice text, prompt text, consequences, etc. Only IDs and technical fields stay in English.

Design:
- Anchor events: immutable story beats that must occur regardless of player choices. These correspond to major timeline events.
- Decision nodes: points where the player makes meaningful choices (2-4 options each). All choices eventually converge back at the next anchor event, preserving the overall narrative while giving agency.
- A game flow graph connecting anchors, decisions, transitions, and endings.

Constraints:
- 3-6 decision nodes total
- Target 10-20 minutes of playtime
- Every decision node must eventually lead back to an anchor event or ending

Output a JSON object:
{
  "protagonistId": "string - character ID of the protagonist from the analysis",
  "anchorEvents": [
    {
      "id": "string - unique ID like 'anchor_01'",
      "timelineEventId": "string - corresponding timeline event ID from analysis",
      "description": "string - what happens at this story beat",
      "locationId": "string - location ID from analysis"
    }
  ],
  "decisionNodes": [
    {
      "id": "string - unique ID like 'decision_01'",
      "locationId": "string - location ID",
      "triggerDescription": "string - what situation triggers this choice",
      "promptText": "string - the question/situation presented to the player",
      "options": [
        {
          "id": "string - unique ID like 'choice_01a'",
          "text": "string - the choice text shown to the player",
          "consequence": "string - what happens if player picks this",
          "nextNodeId": "string - ID of the next game flow node"
        }
      ]
    }
  ],
  "gameFlow": [
    {
      "id": "string - matches an anchor/decision/transition/ending ID",
      "type": "anchor" | "decision" | "transition" | "ending",
      "description": "string - what this node represents",
      "locationId": "string - location ID",
      "nextNodeIds": ["string - IDs of nodes that follow this one"]
    }
  ],
  "estimatedPlaytimeMinutes": "number - estimated playtime"
}

Use the character IDs, location IDs, and timeline event IDs from the provided analysis.`;

export async function designGame(
  analysis: TextAnalysis,
  ctx: LlmCallContext,
): Promise<GameDesign> {
  const userPrompt = JSON.stringify(analysis, null, 2);
  return chatCompletionStream<GameDesign>(SYSTEM_PROMPT, userPrompt, ctx, {
    temperature: 0.7,
  });
}
