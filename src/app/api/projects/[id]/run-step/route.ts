import { getProject } from "@/lib/db";
import { runStep } from "@/pipeline/orchestrator";
import type { PipelineStage } from "@/pipeline/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const stage = (body.stage as PipelineStage) || project.current_stage;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }

      sendEvent("stage_update", { stage, status: "running" });

      try {
        const result = await runStep(id, stage, (token: string) => {
          sendEvent("token", { token });
        });

        sendEvent("result", { stage, result });
        sendEvent("stage_update", { stage, status: "done" });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        sendEvent("error", { stage, error: errMsg });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
