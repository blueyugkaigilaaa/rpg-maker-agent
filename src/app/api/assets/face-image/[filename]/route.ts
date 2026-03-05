import { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  const templatePath = path.resolve(
    process.cwd(),
    "..",
    process.env.RPGMAKER_TEMPLATE_PATH || "newdata",
  );
  const filePath = path.join(templatePath, "img", "faces", `${filename}.png`);

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
