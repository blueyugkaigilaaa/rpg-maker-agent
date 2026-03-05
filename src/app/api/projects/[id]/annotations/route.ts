import { NextResponse } from "next/server";
import {
  getProject,
  getAnnotations,
  createAnnotation,
} from "@/lib/db";

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
  const stage = url.searchParams.get("stage");
  if (!stage) {
    return NextResponse.json({ error: "stage query param is required" }, { status: 400 });
  }

  const annotations = getAnnotations(id, stage);
  return NextResponse.json(annotations);
}

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
  const { stage, elementPath, content } = body;

  if (!stage || !elementPath || !content) {
    return NextResponse.json(
      { error: "stage, elementPath, and content are required" },
      { status: 400 },
    );
  }

  const annotation = createAnnotation(id, stage, elementPath, content);
  return NextResponse.json(annotation, { status: 201 });
}
