import { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mapId: string }> },
) {
  const { mapId } = await params;
  const id = parseInt(mapId, 10);
  if (isNaN(id) || id < 1) {
    return new Response("Invalid map ID", { status: 400 });
  }

  const sampleMapsPath = path.resolve(
    process.cwd(),
    "..",
    process.env.RPGMAKER_SAMPLEMAPS_PATH || "samplemaps",
  );
  const filename = `Map${String(id).padStart(3, "0")}.png`;
  const filePath = path.join(sampleMapsPath, filename);

  if (!fs.existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const etag = `"${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}"`;

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304 });
  }

  const buffer = fs.readFileSync(filePath);
  return new Response(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, no-cache",
      ETag: etag,
    },
  });
}
