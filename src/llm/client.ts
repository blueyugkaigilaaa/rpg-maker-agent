import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import { insertLlmLog } from "@/lib/db";

const globalForClient = globalThis as unknown as { __openaiClient?: OpenAI };

function getClient(): OpenAI {
  if (!globalForClient.__openaiClient) {
    globalForClient.__openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    });
  }
  return globalForClient.__openaiClient;
}

function getModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4o";
}

export function extractJSON(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  const bracketStart = text.indexOf("[");
  const bracketEnd = text.lastIndexOf("]");

  const hasObject = braceStart !== -1 && braceEnd > braceStart;
  const hasArray = bracketStart !== -1 && bracketEnd > bracketStart;

  if (hasObject && hasArray) {
    if (bracketStart < braceStart) {
      return text.slice(bracketStart, bracketEnd + 1);
    }
    return text.slice(braceStart, braceEnd + 1);
  }

  if (hasObject) return text.slice(braceStart, braceEnd + 1);
  if (hasArray) return text.slice(bracketStart, bracketEnd + 1);

  return text.trim();
}

/**
 * Attempt to fix common LLM JSON mistakes:
 * - Stray quote after numeric values: "y":10" → "y":10
 * - Trailing commas before } or ]
 * - Single quotes instead of double quotes (outside string values)
 */
export function repairJSON(raw: string): string {
  let text = raw;

  // Fix stray quote after numeric values: `:123"` → `:123`
  // Matches `: <digits> "` followed by , or } or ]
  text = text.replace(/(:\s*)(\d+)"(\s*[,\}\]])/g, "$1$2$3");

  // Fix trailing commas: `,}` → `}` and `,]` → `]`
  text = text.replace(/,(\s*[}\]])/g, "$1");

  return text;
}

function parseJSONSafe<T>(raw: string): T {
  const extracted = extractJSON(raw);

  // Layer 1: direct parse
  try {
    return JSON.parse(extracted) as T;
  } catch {
    // continue to repair layers
  }

  // Layer 2: lightweight regex repair
  const regexRepaired = repairJSON(extracted);
  try {
    const parsed = JSON.parse(regexRepaired) as T;
    console.warn("[LLM] JSON parse succeeded after regex auto-repair");
    return parsed;
  } catch {
    // continue to jsonrepair
  }

  // Layer 3: jsonrepair (handles missing brackets, stray characters, etc.)
  try {
    const deepRepaired = jsonrepair(extracted);
    const parsed = JSON.parse(deepRepaired) as T;
    console.warn("[LLM] JSON parse succeeded after jsonrepair");
    return parsed;
  } catch (finalErr) {
    throw new Error(
      `Failed to parse LLM JSON response (${extracted.length} chars) even after jsonrepair: ${finalErr instanceof Error ? finalErr.message : finalErr}`,
    );
  }
}

export interface LlmCallContext {
  projectId: string;
  stage: string;
  onToken?: (token: string) => void;
}

const JSON_SUFFIX =
  "\n\nIMPORTANT: Reply with ONLY the JSON object. No explanations, no markdown fences, no extra text." +
  "\n\nLANGUAGE REQUIREMENT: All human-readable text values in the JSON (names, descriptions, dialogue, summaries, atmosphere, personality, etc.) MUST be written in Chinese (中文). Only JSON keys and technical identifiers (IDs, asset filenames, etc.) should remain in English.";

export async function chatCompletionStream<T>(
  systemPrompt: string,
  userPrompt: string,
  ctx: LlmCallContext,
  options?: { temperature?: number; maxTokens?: number },
): Promise<T> {
  const client = getClient();
  const fullSystem = systemPrompt + JSON_SUFFIX;
  const start = Date.now();

  console.log(
    `[LLM] ${ctx.stage} | project=${ctx.projectId.slice(0, 8)} | streaming start`,
  );

  let fullContent = "";
  let tokenCount = 0;

  try {
    const stream = await client.chat.completions.create({
      model: getModel(),
      messages: [
        { role: "system", content: fullSystem },
        { role: "user", content: userPrompt },
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 32000,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        tokenCount++;
        ctx.onToken?.(delta);
      }
    }

    const durationMs = Date.now() - start;
    console.log(
      `[LLM] ${ctx.stage} | project=${ctx.projectId.slice(0, 8)} | done in ${durationMs}ms | ${tokenCount} chunks`,
    );

    insertLlmLog({
      project_id: ctx.projectId,
      stage: ctx.stage,
      system_prompt: fullSystem,
      user_prompt: userPrompt,
      response_text: fullContent,
      duration_ms: durationMs,
      token_count: tokenCount,
      error: null,
    });

    const parsed = parseJSONSafe<T>(fullContent);
    return parsed;
  } catch (err) {
    const durationMs = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);

    console.error(`[LLM] ${ctx.stage} | ERROR: ${errMsg}`);

    insertLlmLog({
      project_id: ctx.projectId,
      stage: ctx.stage,
      system_prompt: fullSystem,
      user_prompt: userPrompt,
      response_text: fullContent || null,
      duration_ms: durationMs,
      token_count: tokenCount,
      error: errMsg,
    });

    if (fullContent && !errMsg.includes("Failed to parse")) {
      try {
        return parseJSONSafe<T>(fullContent);
      } catch {
        throw new Error(
          `Failed to parse LLM JSON response (${fullContent.length} chars): ${fullContent.slice(0, 500)}`,
        );
      }
    }
    throw err;
  }
}

export async function chatCompletion<T>(
  systemPrompt: string,
  userPrompt: string,
  ctx: LlmCallContext,
  options?: { temperature?: number; maxTokens?: number },
): Promise<T> {
  const client = getClient();
  const fullSystem = systemPrompt + JSON_SUFFIX;
  const start = Date.now();

  console.log(
    `[LLM] ${ctx.stage} | project=${ctx.projectId.slice(0, 8)} | non-stream start`,
  );

  try {
    const response = await client.chat.completions.create({
      model: getModel(),
      messages: [
        { role: "system", content: fullSystem },
        { role: "user", content: userPrompt },
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 32000,
    });

    const content = response.choices[0]?.message?.content;
    const durationMs = Date.now() - start;

    console.log(
      `[LLM] ${ctx.stage} | project=${ctx.projectId.slice(0, 8)} | done in ${durationMs}ms`,
    );

    insertLlmLog({
      project_id: ctx.projectId,
      stage: ctx.stage,
      system_prompt: fullSystem,
      user_prompt: userPrompt,
      response_text: content || null,
      duration_ms: durationMs,
      token_count: null,
      error: null,
    });

    if (!content) throw new Error("LLM returned empty response");

    return parseJSONSafe<T>(content);
  } catch (err) {
    const durationMs = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[LLM] ${ctx.stage} | ERROR: ${errMsg}`);

    insertLlmLog({
      project_id: ctx.projectId,
      stage: ctx.stage,
      system_prompt: fullSystem,
      user_prompt: userPrompt,
      response_text: null,
      duration_ms: durationMs,
      token_count: null,
      error: errMsg,
    });

    throw err;
  }
}

