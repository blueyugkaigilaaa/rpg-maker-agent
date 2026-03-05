import { NextResponse } from "next/server";
import { getProject, getLlmLogs } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const stage = url.searchParams.get("stage") ?? undefined;
  const logs = getLlmLogs(id, stage);
  return NextResponse.json(logs);
}
