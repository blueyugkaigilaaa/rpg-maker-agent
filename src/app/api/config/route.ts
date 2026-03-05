import { NextResponse } from "next/server";
import { getAssetCatalog } from "@/rpgmaker/asset-catalog";

export async function GET() {
  const catalog = getAssetCatalog();
  return NextResponse.json({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    reasoningEffort: process.env.REASONING_EFFORT || "none",
    assets: {
      characters: catalog.characters.length,
      faces: catalog.faces.length,
      faceFiles: catalog.faces,
      bgm: catalog.bgm.length,
      bgmFiles: catalog.bgm,
      bgs: catalog.bgs.length,
      bgsFiles: catalog.bgs.map((b) => b.name),
      se: catalog.se.length,
      sampleMaps: catalog.sampleMapCount,
      scannedAt: catalog.scannedAt,
    },
  });
}
