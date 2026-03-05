import { NextResponse } from "next/server";
import { getProject, updateProject, deleteProject, getAllStepResults, getStepTimestamps } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const steps = getAllStepResults(id);
  const stepMap: Record<string, unknown> = {};
  for (const s of steps) {
    try {
      stepMap[s.stage] = JSON.parse(s.result_json);
    } catch {
      stepMap[s.stage] = s.result_json;
    }
  }

  const stepTimestamps = getStepTimestamps(id);
  return NextResponse.json({ ...project, steps: stepMap, stepTimestamps });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const updates: Parameters<typeof updateProject>[1] = {};

  if (body.name !== undefined) updates.name = body.name;

  updateProject(id, updates);
  return NextResponse.json(getProject(id));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  deleteProject(id);
  return NextResponse.json({ ok: true });
}
