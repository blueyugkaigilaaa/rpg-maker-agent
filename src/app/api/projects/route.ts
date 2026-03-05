import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createProject, listProjects } from "@/lib/db";

export async function GET() {
  const projects = listProjects();
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const body = await request.json();
  const name: string | undefined = body.name;
  const articleText: string | undefined = body.articleText;

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!articleText || articleText.trim().length === 0) {
    return NextResponse.json({ error: "articleText is required" }, { status: 400 });
  }

  const id = uuidv4();
  const project = createProject(id, name.trim(), articleText);
  return NextResponse.json(project, { status: 201 });
}
