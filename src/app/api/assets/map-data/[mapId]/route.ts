import { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET(
  _req: NextRequest,
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
  const templatePath = path.resolve(
    process.cwd(),
    "..",
    process.env.RPGMAKER_TEMPLATE_PATH || "newdata",
  );

  const mapFilename = `Map${String(id).padStart(3, "0")}.json`;
  let mapFilePath = path.join(sampleMapsPath, mapFilename);
  if (!fs.existsSync(mapFilePath)) {
    mapFilePath = path.join(sampleMapsPath, "data", mapFilename);
  }
  if (!fs.existsSync(mapFilePath)) {
    return new Response("Map not found", { status: 404 });
  }

  const mapData = JSON.parse(fs.readFileSync(mapFilePath, "utf-8"));

  const tilesetId = mapData.tilesetId ?? 1;
  const tilesetsPath = path.join(templatePath, "data", "Tilesets.json");
  let tilesetNames: string[] = [];
  let flags: number[] = [];

  if (fs.existsSync(tilesetsPath)) {
    const tilesets = JSON.parse(fs.readFileSync(tilesetsPath, "utf-8"));
    const ts = tilesets[tilesetId];
    if (ts) {
      tilesetNames = ts.tilesetNames ?? [];
      flags = ts.flags ?? [];
    }
  }

  return Response.json({
    map: mapData,
    tilesetId,
    tilesetNames,
    flags,
  });
}
