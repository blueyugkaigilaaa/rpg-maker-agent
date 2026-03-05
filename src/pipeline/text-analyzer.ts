import { chatCompletionStream, type LlmCallContext } from "@/llm/client";
import { TextAnalysis } from "@/pipeline/types";

export const SYSTEM_PROMPT = `You are an expert literary analyst. Analyze the given article and extract structured narrative data.

You MUST output all human-readable text values in Chinese (中文), including character names, descriptions, personality, appearance, speechStyle, location names, emotional tones, summaries, themes, etc. Only IDs and technical fields stay in English.

Output a JSON object with the following structure:
{
  "title": "string - the title of the work",
  "author": "string - the author if identifiable, otherwise 'Unknown'",
  "summary": "string - a concise 2-3 sentence summary",
  "theme": "string - the central theme or message",
  "characters": [
    {
      "id": "string - unique identifier like 'char_01'",
      "name": "string - character name",
      "role": "protagonist" | "supporting" | "minor" | "group",
      "description": "string - who this character is in the story",
      "personality": "string - key personality traits",
      "appearance": "string - physical description if available, otherwise infer from context",
      "speechStyle": "string - how this character speaks (formal, casual, poetic, etc.)",
      "relationToProtagonist": "string - relationship to the main character"
    }
  ],
  "timeline": [
    {
      "id": "string - unique identifier like 'evt_01'",
      "order": "number - chronological order starting from 1",
      "description": "string - what happens in this event",
      "characterIds": ["string - IDs of characters involved"],
      "locationId": "string - ID of the location where this happens",
      "emotionalTone": "string - the emotional quality of this moment",
      "significance": "major" | "minor"
    }
  ],
  "locations": [
    {
      "id": "string - unique identifier like 'loc_01'",
      "name": "string - name of the place",
      "description": "string - what this place looks and feels like",
      "type": "indoor" | "outdoor" | "transition",
      "atmosphere": "string - the mood and ambiance"
    }
  ],
  "emotionalArc": [
    {
      "phase": "string - narrative phase name (e.g. 'introduction', 'rising action', 'climax')",
      "emotion": "string - dominant emotion",
      "intensity": "number - 1 to 10"
    }
  ]
}

Ensure every timeline event references valid character IDs and location IDs from the arrays you define.
There must be exactly one character with role "protagonist".
Identify at least 3 locations and 5 timeline events.

CRITICAL - Character Splitting Rules:
When the text mentions a group of characters (e.g. "two swindlers", "three soldiers", "the townspeople and attendants"), you MUST split them into INDIVIDUAL characters, one entry per person. Do NOT merge multiple individuals into a single character entry.
- "Two swindlers/两个骗子" → create TWO separate characters: "Swindler A" and "Swindler B" (or give them distinct names)
- "Townspeople and attendants/百姓与随员" → create at least 2-3 representative individuals, e.g. "Townsman", "Attendant A", "Attendant B"
- "Three brothers" → create THREE separate characters
- Even when the text treats a group as a unit, each person who could appear as a distinct NPC on a game map should be a separate character entry
- Use role "group" ONLY for large unnamed crowds that are referenced collectively but never act individually. For any group of 2-5 named or described individuals, create separate entries for each person.
This is essential because each character becomes a separate NPC on the RPG map. Merging multiple people into one character would result in a single sprite representing multiple people, which looks wrong in-game.`;

export async function analyzeText(
  articleText: string,
  ctx: LlmCallContext,
): Promise<TextAnalysis> {
  return chatCompletionStream<TextAnalysis>(SYSTEM_PROMPT, articleText, ctx, {
    temperature: 0.3,
  });
}
