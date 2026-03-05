import { NextResponse } from "next/server";
import {
  getAnnotation,
  updateAnnotation,
  deleteAnnotation,
} from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; annotationId: string }> },
) {
  const { annotationId } = await params;
  const annId = Number(annotationId);

  const existing = getAnnotation(annId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const fields: { content?: string; status?: "active" | "archived" } = {};
  if (body.content !== undefined) fields.content = body.content;
  if (body.status !== undefined) fields.status = body.status;

  updateAnnotation(annId, fields);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; annotationId: string }> },
) {
  const { annotationId } = await params;
  deleteAnnotation(Number(annotationId));
  return NextResponse.json({ ok: true });
}
