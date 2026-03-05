import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import type { PipelineStage } from "@/pipeline/types";

const STAGE_ORDER: PipelineStage[] = [
  "text_analysis",
  "game_design",
  "scene_planning",
  "scene_building",
  "asset_mapping",
  "rpgmaker_adapter",
];

function stageIndex(stage: PipelineStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export type ProjectStatus = "idle" | "running" | "paused" | "completed" | "error";

export interface ProjectRow {
  id: string;
  name: string;
  article_text: string;
  current_stage: PipelineStage;
  status: ProjectStatus;
  output_path: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface StepResultRow {
  id: number;
  project_id: string;
  stage: PipelineStage;
  result_json: string;
  created_at: string;
}

export interface LlmLogRow {
  id: number;
  project_id: string;
  stage: string;
  system_prompt: string;
  user_prompt: string;
  response_text: string | null;
  duration_ms: number | null;
  token_count: number | null;
  error: string | null;
  created_at: string;
}

const globalForDb = globalThis as unknown as {
  __rpgmakerDb?: Database.Database;
};

function getDb(): Database.Database {
  if (globalForDb.__rpgmakerDb) return globalForDb.__rpgmakerDb;

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, "rpgmaker.db");
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      article_text TEXT NOT NULL,
      current_stage TEXT NOT NULL DEFAULT 'text_analysis',
      status TEXT NOT NULL DEFAULT 'idle',
      output_path TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS step_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(project_id, stage)
    );

    CREATE TABLE IF NOT EXISTS llm_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      user_prompt TEXT NOT NULL,
      response_text TEXT,
      duration_ms INTEGER,
      token_count INTEGER,
      error TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      element_path TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  globalForDb.__rpgmakerDb = db;
  return db;
}

// ---- Projects CRUD ----

export function createProject(id: string, name: string, articleText: string): ProjectRow {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO projects (id, name, article_text, current_stage, status, created_at, updated_at)
    VALUES (?, ?, ?, 'text_analysis', 'idle', ?, ?)
  `).run(id, name, articleText, now, now);
  return getProject(id)!;
}

export function getProject(id: string): ProjectRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
}

export function listProjects(): ProjectRow[] {
  const db = getDb();
  return db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all() as ProjectRow[];
}

export function updateProject(
  id: string,
  fields: Partial<Pick<ProjectRow, "name" | "current_stage" | "status" | "output_path" | "error">>
): void {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined) {
      sets.push(`${key} = ?`);
      values.push(val);
    }
  }

  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);

  db.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteProject(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
}

// ---- Step Results ----

export function saveStepResult(projectId: string, stage: PipelineStage, resultJson: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO step_results (project_id, stage, result_json, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(project_id, stage) DO UPDATE SET result_json = excluded.result_json, created_at = excluded.created_at
  `).run(projectId, stage, resultJson, now);
}

export function getStepResult(projectId: string, stage: PipelineStage): StepResultRow | undefined {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM step_results WHERE project_id = ? AND stage = ?"
  ).get(projectId, stage) as StepResultRow | undefined;
}

export function getAllStepResults(projectId: string): StepResultRow[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM step_results WHERE project_id = ? ORDER BY created_at ASC"
  ).all(projectId) as StepResultRow[];
}

export function getStepTimestamps(projectId: string): Record<string, string> {
  const db = getDb();
  const rows = db.prepare(
    "SELECT stage, created_at FROM step_results WHERE project_id = ?"
  ).all(projectId) as { stage: string; created_at: string }[];
  const result: Record<string, string> = {};
  for (const r of rows) result[r.stage] = r.created_at;
  return result;
}

export function clearStepsFrom(projectId: string, stage: PipelineStage): void {
  const db = getDb();
  const idx = stageIndex(stage);
  if (idx < 0) return;

  const stagesToClear = STAGE_ORDER.slice(idx);
  const placeholders = stagesToClear.map(() => "?").join(", ");
  db.prepare(
    `DELETE FROM step_results WHERE project_id = ? AND stage IN (${placeholders})`
  ).run(projectId, ...stagesToClear);

  updateProject(projectId, {
    current_stage: stage,
    status: "idle",
    output_path: null,
    error: null,
  });
}

export function clearDownstreamResults(projectId: string, afterStage: PipelineStage): void {
  const db = getDb();
  const idx = stageIndex(afterStage);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return;
  const stagesToClear = STAGE_ORDER.slice(idx + 1);
  const placeholders = stagesToClear.map(() => "?").join(", ");
  db.prepare(
    `DELETE FROM step_results WHERE project_id = ? AND stage IN (${placeholders})`
  ).run(projectId, ...stagesToClear);
}

// ---- LLM Logs ----

export function insertLlmLog(log: Omit<LlmLogRow, "id" | "created_at">): number {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO llm_logs (project_id, stage, system_prompt, user_prompt, response_text, duration_ms, token_count, error, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    log.project_id,
    log.stage,
    log.system_prompt,
    log.user_prompt,
    log.response_text,
    log.duration_ms,
    log.token_count,
    log.error,
    now,
  );
  return Number(result.lastInsertRowid);
}

export function getLlmLogs(projectId: string, stage?: string): LlmLogRow[] {
  const db = getDb();
  if (stage) {
    return db.prepare(
      "SELECT * FROM llm_logs WHERE project_id = ? AND stage = ? ORDER BY created_at ASC"
    ).all(projectId, stage) as LlmLogRow[];
  }
  return db.prepare(
    "SELECT * FROM llm_logs WHERE project_id = ? ORDER BY created_at ASC"
  ).all(projectId) as LlmLogRow[];
}

// ---- Annotations ----

export type AnnotationStatus = "active" | "archived";

export interface AnnotationRow {
  id: number;
  project_id: string;
  stage: string;
  element_path: string;
  content: string;
  status: AnnotationStatus;
  created_at: string;
  updated_at: string;
}

export function createAnnotation(
  projectId: string,
  stage: string,
  elementPath: string,
  content: string,
): AnnotationRow {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO annotations (project_id, stage, element_path, content, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
  `).run(projectId, stage, elementPath, content, now, now);
  return db.prepare("SELECT * FROM annotations WHERE id = ?").get(
    Number(result.lastInsertRowid),
  ) as AnnotationRow;
}

export function getAnnotation(id: number): AnnotationRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM annotations WHERE id = ?").get(id) as AnnotationRow | undefined;
}

export function getAnnotations(projectId: string, stage: string): AnnotationRow[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM annotations WHERE project_id = ? AND stage = ? ORDER BY created_at ASC",
  ).all(projectId, stage) as AnnotationRow[];
}

export function updateAnnotation(
  id: number,
  fields: Partial<Pick<AnnotationRow, "content" | "status">>,
): void {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined) {
      sets.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);

  db.prepare(`UPDATE annotations SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteAnnotation(id: number): void {
  const db = getDb();
  db.prepare("DELETE FROM annotations WHERE id = ?").run(id);
}

export function archiveActiveAnnotations(projectId: string, stage: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE annotations SET status = 'archived', updated_at = ? WHERE project_id = ? AND stage = ? AND status = 'active'",
  ).run(now, projectId, stage);
}

export { STAGE_ORDER, stageIndex };
