import { NextResponse } from "next/server";
import { getProject, clearStepsFrom } from "@/lib/db";
import type { PipelineStage } from "@/pipeline/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const stage = body.stage as PipelineStage;
  if (!stage) {
    return NextResponse.json({ error: "stage is required" }, { status: 400 });
  }

  clearStepsFrom(id, stage);
  return NextResponse.json({ ok: true, current_stage: stage });
}
