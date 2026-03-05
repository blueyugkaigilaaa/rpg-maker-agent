import * as fs from "fs";
import * as path from "path";

interface MapMeta {
  mapId: number;
  tilesetId: number;
  width: number;
  height: number;
  hasThumbnail: boolean;
}

let cachedList: MapMeta[] | null = null;

export async function GET() {
  if (cachedList) {
    return Response.json(cachedList);
  }

  const sampleMapsPath = path.resolve(
    process.cwd(),
    "..",
    process.env.RPGMAKER_SAMPLEMAPS_PATH || "samplemaps",
  );

  const files = fs
    .readdirSync(sampleMapsPath)
    .filter((f) => /^Map\d{3}\.json$/.test(f))
    .sort();

  const list: MapMeta[] = [];

  for (const file of files) {
    const mapId = parseInt(file.slice(3, 6), 10);
    const filePath = path.join(sampleMapsPath, file);
    const pngPath = path.join(sampleMapsPath, file.replace(".json", ".png"));

    try {
      const fd = fs.openSync(filePath, "r");
      const buf = Buffer.alloc(600);
      fs.readSync(fd, buf, 0, 600, 0);
      fs.closeSync(fd);
      const header = buf.toString("utf-8");

      const tilesetId = Number(
        header.match(/"tilesetId":(\d+)/)?.[1] ?? 0,
      );
      const width = Number(header.match(/"width":(\d+)/)?.[1] ?? 0);
      const height = Number(header.match(/"height":(\d+)/)?.[1] ?? 0);

      list.push({
        mapId,
        tilesetId,
        width,
        height,
        hasThumbnail: fs.existsSync(pngPath),
      });
    } catch {
      // skip invalid files
    }
  }

  cachedList = list;
  return Response.json(list);
}
