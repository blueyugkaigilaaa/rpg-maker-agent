import { NextResponse } from "next/server";
import archiver from "archiver";
import { getProject, getStepResult } from "@/lib/db";
import type { TextAnalysis } from "@/pipeline/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = getProject(id);

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (project.status !== "completed" || !project.output_path) {
    return NextResponse.json(
      { error: "Project not ready for download" },
      { status: 400 },
    );
  }

  const archive = archiver("zip", { zlib: { level: 5 } });
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", resolve);
    archive.on("error", reject);

    archive.directory(project.output_path!, false);
    archive.finalize();
  });

  const buffer = Buffer.concat(chunks);

  let title = project.name;
  const analysisRow = getStepResult(id, "text_analysis");
  if (analysisRow) {
    try {
      const analysis = JSON.parse(analysisRow.result_json) as TextAnalysis;
      title = analysis.title || title;
    } catch { /* use project name */ }
  }
  const safeName = title.replace(/[^a-zA-Z0-9_\u4e00-\u9fff-]/g, "_").slice(0, 60);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}.zip"`,
    },
  });
}
