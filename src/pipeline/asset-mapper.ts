import { chatCompletionStream, type LlmCallContext } from "@/llm/client";
import { TextAnalysis, ScenePlan, AssetMapping } from "@/pipeline/types";
import { getAssetCatalog, type ScannedCharacter, type ScannedBGM } from "@/rpgmaker/asset-catalog";

function buildCharacterSection(sprites: ScannedCharacter[]): string {
  if (sprites.length === 0) return "No character sprites found.";
  const lines: string[] = [];
  for (const s of sprites) {
    const indexes = s.isSingle
      ? "single character (index 0 only)"
      : "indexes 0-7";
    const face = s.hasFace
      ? ", has matching face image"
      : ", NO face image available";
    lines.push(`- ${s.file} (${indexes}${face}): ${s.category}`);
  }
  return lines.join("\n");
}

function buildBGMSection(bgms: ScannedBGM[]): string {
  if (bgms.length === 0) return "No BGM files found.";
  const grouped = new Map<string, string[]>();
  for (const b of bgms) {
    const list = grouped.get(b.category) ?? [];
    list.push(b.name);
    grouped.set(b.category, list);
  }
  const lines: string[] = [];
  for (const [category, names] of grouped) {
    lines.push(`- ${names.join(", ")}: ${category}`);
  }
  return lines.join("\n");
}

function buildBGSSection(bgsNames: string[]): string {
  if (bgsNames.length === 0) return "No BGS files found.";
  return bgsNames.map((n) => `- ${n}`).join("\n");
}

function buildSystemPrompt(): string {
  const catalog = getAssetCatalog();
  const { characters, bgm, bgs, sampleMapCount } = catalog;

  const charSection = buildCharacterSection(characters);
  const faceNames = characters.filter((s) => s.hasFace).map((s) => s.file);
  const faceNote =
    faceNames.length > 0
      ? `Face images are available for: ${faceNames.join(", ")}. Use the SAME filename and index for both characterImage and faceImage.`
      : "No face images available.";

  const bgmSection = buildBGMSection(bgm);
  const bgsSection = buildBGSSection(bgs.map((b) => b.name));
  const maxSampleMap = sampleMapCount || 291;

  return `You are an RPG Maker MZ asset specialist. Map characters and scenes to built-in RPG Maker MZ assets.

You MUST output characterName (the character's display name) in Chinese (中文). Asset filenames (characterImage, faceImage, bgm name, etc.) remain in English as they refer to built-in RPG Maker MZ files.

Available CHARACTER sprite/face images:
${charSection}

${faceNote}
For characters without a matching face image, use the closest available face file or reuse one from the list above.

Available BGM (background music):
${bgmSection}

Available BGS (background sounds / ambient):
${bgsSection}

Tileset IDs:
- 1 = Outside (towns, fields, forests)
- 2 = World map
- 3 = Inside (buildings, rooms)
- 4 = Dungeon (caves, dark areas)

For sampleMapId: suggest a map number 1-${maxSampleMap} from the built-in sample maps.
- Indoor scenes: maps in the 100-200 range tend to be interiors
- Outdoor scenes: maps in the 1-100 range tend to be exteriors

Output JSON:
{
  "characters": [
    {
      "characterId": "string - matching the character ID from analysis",
      "characterName": "string - character's display name",
      "characterImage": "string - sprite filename from the available list above",
      "characterIndex": "number - 0-7 index within the sprite sheet (0 for single-character files)",
      "faceImage": "string - face image filename (same as characterImage when available)",
      "faceIndex": "number - 0-7 index (same as characterIndex)"
    }
  ],
  "scenes": [
    {
      "sceneId": "string - matching scene ID from scene plan",
      "tilesetId": "number - 1, 2, 3, or 4",
      "sampleMapId": "number - 1-${maxSampleMap}",
      "bgm": {"name": "string", "volume": 90, "pitch": 100, "pan": 0},
      "bgs": {"name": "string", "volume": 90, "pitch": 100, "pan": 0} (optional, for ambient sounds)
    }
  ]
}

Assign distinct character images to each character. The protagonist should use an Actor sprite. Supporting/minor characters should use People sprites. Villains can use Evil sprites. Match the BGM to each scene's atmosphere.`;
}

/** Lazy-evaluated and exported for use by prompts.ts (ai-revise) */
export function getSystemPrompt(): string {
  return buildSystemPrompt();
}

export async function mapAssets(
  analysis: TextAnalysis,
  plan: ScenePlan,
  ctx: LlmCallContext,
): Promise<AssetMapping> {
  const prompt = buildSystemPrompt();
  const userPrompt = JSON.stringify(
    { characters: analysis.characters, scenes: plan.scenes },
    null,
    2,
  );
  return chatCompletionStream<AssetMapping>(prompt, userPrompt, ctx, {
    temperature: 0.3,
  });
}
