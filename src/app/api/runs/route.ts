import { NextResponse } from "next/server";
import { runAgentLoop } from "@/agent/loop";
import { createRun, listRunSummaries } from "@/storage/runs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { task?: string };
  const task = body.task?.trim();

  if (!task) {
    return NextResponse.json({ error: "Task is required." }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is missing. Add it to .env and restart the dev server.",
      },
      { status: 400 },
    );
  }

  const run = createRun(task);

  void runAgentLoop(run).catch((error) => {
    console.error("Agent loop failed", error);
  });

  return NextResponse.json({
    runId: run.id,
    status: run.status,
    run,
  });
}

export async function GET() {
  const runs = await listRunSummaries();
  return NextResponse.json({ runs });
}
