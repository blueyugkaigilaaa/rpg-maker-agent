import { NextResponse } from "next/server";
import { getProject, getStepResult, saveStepResult } from "@/lib/db";
import type { PipelineStage } from "@/pipeline/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; stage: string }> },
) {
  const { id, stage } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const row = getStepResult(id, stage as PipelineStage);
  if (!row) {
    return NextResponse.json({ error: "Step result not found" }, { status: 404 });
  }

  try {
    return NextResponse.json(JSON.parse(row.result_json));
  } catch {
    return NextResponse.json({ raw: row.result_json });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; stage: string }> },
) {
  const { id, stage } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json();
  const resultJson = typeof body === "string" ? body : JSON.stringify(body);

  try {
    JSON.parse(resultJson);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  saveStepResult(id, stage as PipelineStage, resultJson);
  return NextResponse.json({ ok: true });
}
