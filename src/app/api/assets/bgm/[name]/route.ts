import { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;

  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    return new Response("Invalid name", { status: 400 });
  }

  const templatePath = path.resolve(
    process.cwd(),
    "..",
    process.env.RPGMAKER_TEMPLATE_PATH || "newdata",
  );
  const filePath = path.join(templatePath, "audio", "bgm", `${name}.ogg`);

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
      "Content-Type": "audio/ogg",
      "Content-Length": String(stat.size),
      "Cache-Control": "public, no-cache",
      ETag: etag,
      "Accept-Ranges": "bytes",
    },
  });
}
