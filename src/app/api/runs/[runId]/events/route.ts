import { getRun, getRunSync, subscribeToRun } from "@/storage/runs";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const run = await getRun(runId);

  if (!run) {
    return new Response("Run not found", { status: 404 });
  }

  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let doneInterval: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const closeStream = (payload?: { status: string; error?: string }) => {
        if (closed) {
          return;
        }

        closed = true;
        if (heartbeat) {
          clearInterval(heartbeat);
        }
        if (doneInterval) {
          clearInterval(doneInterval);
        }
        if (unsubscribe) {
          unsubscribe();
        }

        try {
          if (payload) {
            controller.enqueue(encoder.encode("event: done\n"));
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
            );
          }
          controller.close();
        } catch {
          // Client already disconnected.
        }
      };

      const send = (event: string, data: unknown) => {
        if (closed) {
          return;
        }

        try {
          controller.enqueue(encoder.encode(`event: ${event}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closeStream();
        }
      };

      send("run", run);
      for (const event of run.events) {
        send("event", event);
      }

      if (run.status === "completed" || run.status === "failed") {
        closeStream({ status: run.status, error: run.error });
        return;
      }

      unsubscribe = subscribeToRun(runId, ({ type, data }) => {
        send(type, data);

        if (type === "run") {
          const latest = data as { status?: string; error?: string };
          if (latest.status === "completed" || latest.status === "failed") {
            closeStream({
              status: latest.status,
              error: latest.error,
            });
          }
        }
      });

      heartbeat = setInterval(() => {
        if (closed) {
          return;
        }

        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          closeStream();
        }
      }, 15000);

      doneInterval = setInterval(() => {
        const latest = getRunSync(runId);
        if (latest && (latest.status === "completed" || latest.status === "failed")) {
          closeStream({ status: latest.status, error: latest.error });
        }
      }, 1000);
    },
    cancel() {
      closed = true;
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      if (doneInterval) {
        clearInterval(doneInterval);
      }
      if (unsubscribe) {
        unsubscribe();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
