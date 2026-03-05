/**
 * Dynamic asset catalog that scans RPG Maker MZ template directories on startup.
 * Results are cached per Node.js process lifetime — restart the server to rescan.
 */

import * as fs from "fs";
import * as path from "path";

// ─── Types ───────────────────────────────────────────────────────────

export interface ScannedCharacter {
  file: string;
  isSingle: boolean;
  hasFace: boolean;
  category: string;
}

export interface ScannedBGM {
  name: string;
  category: string;
}

export interface ScannedBGS {
  name: string;
}

export interface ScannedSE {
  name: string;
}

export interface AssetCatalog {
  characters: ScannedCharacter[];
  faces: string[];
  bgm: ScannedBGM[];
  bgs: ScannedBGS[];
  se: ScannedSE[];
  sampleMapCount: number;
  scannedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const CHAR_EXCLUDED_PREFIXES = [
  "!", "Damage", "Vehicle", "Nature",
  "SF_Damage", "SF_Vehicle", "$BigMonster",
];

function categorizeCharacter(name: string): string {
  const clean = name.replace(/^SF_/, "").toLowerCase();
  if (clean.startsWith("actor")) return "Hero/protagonist characters";
  if (clean.startsWith("people")) return "Townspeople and NPCs";
  if (clean.startsWith("evil")) return "Villains and antagonists";
  if (clean.startsWith("monster")) return "Monsters and creatures";
  return "Characters";
}

function categorizeBGM(name: string): string {
  if (/^Battle/i.test(name)) return "battle";
  if (/^Castle/i.test(name)) return "castle";
  if (/^Dungeon/i.test(name)) return "dungeon";
  if (/^Field/i.test(name)) return "field";
  if (/^Scene/i.test(name)) return "scene/cutscene";
  if (/^Ship/i.test(name)) return "ship/sailing";
  if (/^Theme/i.test(name)) return "title/theme";
  if (/^Town/i.test(name)) return "town";
  return "other";
}

function listFiles(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => f.replace(new RegExp(`\\${ext}$`), ""))
    .sort();
}

// ─── Core scan ───────────────────────────────────────────────────────

function getTemplateBase(): string {
  const rel = process.env.RPGMAKER_TEMPLATE_PATH || "newdata";
  return path.resolve(process.cwd(), "..", rel);
}

function getSampleMapsBase(): string {
  const rel = process.env.RPGMAKER_SAMPLEMAPS_PATH || "samplemaps";
  return path.resolve(process.cwd(), "..", rel);
}

function performScan(): AssetCatalog {
  const base = getTemplateBase();

  // Faces
  const faces = listFiles(path.join(base, "img", "faces"), ".png");
  const faceSet = new Set(faces);

  // Characters (filter out objects / doors / vehicles / damage)
  const allChars = listFiles(path.join(base, "img", "characters"), ".png");
  const characters: ScannedCharacter[] = [];
  for (const raw of allChars) {
    if (CHAR_EXCLUDED_PREFIXES.some((p) => raw.startsWith(p))) continue;
    const isSingle = raw.startsWith("$");
    const clean = isSingle ? raw.slice(1) : raw;
    characters.push({
      file: clean,
      isSingle,
      hasFace: faceSet.has(clean) || faceSet.has(raw),
      category: categorizeCharacter(clean),
    });
  }

  // BGM
  const bgm = listFiles(path.join(base, "audio", "bgm"), ".ogg").map(
    (name) => ({ name, category: categorizeBGM(name) }),
  );

  // BGS
  const bgs = listFiles(path.join(base, "audio", "bgs"), ".ogg").map(
    (name) => ({ name }),
  );

  // SE
  const se = listFiles(path.join(base, "audio", "se"), ".ogg").map(
    (name) => ({ name }),
  );

  // Sample maps
  const sampleDir = getSampleMapsBase();
  let sampleMapCount = 0;
  if (fs.existsSync(sampleDir)) {
    sampleMapCount = fs
      .readdirSync(sampleDir)
      .filter((f) => f.endsWith(".json")).length;
  }

  const catalog: AssetCatalog = {
    characters,
    faces,
    bgm,
    bgs,
    se,
    sampleMapCount,
    scannedAt: new Date().toISOString(),
  };

  console.log(
    `[AssetCatalog] Scanned: ${characters.length} characters, ${faces.length} faces, ` +
      `${bgm.length} BGM, ${bgs.length} BGS, ${se.length} SE, ${sampleMapCount} sample maps`,
  );

  return catalog;
}

// ─── Cached singleton ────────────────────────────────────────────────

let cached: AssetCatalog | null = null;

export function getAssetCatalog(): AssetCatalog {
  if (!cached) cached = performScan();
  return cached;
}

export function refreshAssetCatalog(): AssetCatalog {
  cached = performScan();
  return cached;
}

// ─── Engine constants (not file-dependent) ───────────────────────────

export const TILESET_TYPES = {
  OUTSIDE: { id: 1, name: "Outside", description: "Outdoor town/field tiles" },
  WORLD: { id: 2, name: "World", description: "World map tiles" },
  INSIDE: { id: 3, name: "Inside", description: "Indoor/building interior tiles" },
  DUNGEON: { id: 4, name: "Dungeon", description: "Cave/dungeon tiles" },
} as const;
