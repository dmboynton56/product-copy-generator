import fs from "node:fs/promises";
import path from "node:path";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { PATHS } from "@/lib/paths";
import type { AutomationRun, ToolEvent, RunSummary } from "@/agent/types";

type RunRecord = AutomationRun & {
  events: ToolEvent[];
  products: Record<string, unknown>[];
  generatedItems: Record<string, unknown>[];
  validation?: Record<string, unknown>;
  review?: Record<string, unknown>;
  report?: Record<string, unknown>;
  feedbackDataset?: Record<string, unknown>;
  feedbackAnalysis?: Record<string, unknown>;
};

export type { RunRecord, RunSummary };

declare global {
  var __catalogRuns: Map<string, RunRecord> | undefined;
  var __catalogEmitters: Map<string, EventEmitter> | undefined;
}

const runs = globalThis.__catalogRuns ?? new Map<string, RunRecord>();
const emitters = globalThis.__catalogEmitters ?? new Map<string, EventEmitter>();
globalThis.__catalogRuns = runs;
globalThis.__catalogEmitters = emitters;

function runFilePath(runId: string): string {
  return path.join(PATHS.automationRuns, runId, "run.json");
}

function indexFilePath(): string {
  return path.join(PATHS.automationRuns, "index.json");
}

function getEmitter(runId: string): EventEmitter {
  if (!emitters.has(runId)) {
    emitters.set(runId, new EventEmitter());
  }
  return emitters.get(runId)!;
}

function safeEmit(emitter: EventEmitter, event: string, data: unknown): void {
  try {
    emitter.emit(event, data);
  } catch (error) {
    console.error(`Run listener failed for ${event}:`, error);
  }
}

export function toRunSummary(run: RunRecord): RunSummary {
  return {
    id: run.id,
    task: run.task,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    productCount: run.products.length,
    eventCount: run.events.length,
    error: run.error,
  };
}

async function updateRunIndex(run: RunRecord): Promise<void> {
  const summaries = await listRunSummaries();
  const next = [toRunSummary(run), ...summaries.filter((item) => item.id !== run.id)].slice(0, 50);
  await fs.mkdir(PATHS.automationRuns, { recursive: true });
  await fs.writeFile(indexFilePath(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

export async function loadRunFromDisk(runId: string): Promise<RunRecord | undefined> {
  try {
    const raw = await fs.readFile(runFilePath(runId), "utf8");
    const run = JSON.parse(raw) as RunRecord;
    runs.set(runId, run);
    getEmitter(runId);
    return run;
  } catch {
    return undefined;
  }
}

export async function listRunSummaries(): Promise<RunSummary[]> {
  try {
    const raw = await fs.readFile(indexFilePath(), "utf8");
    const parsed = JSON.parse(raw) as RunSummary[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return rebuildRunIndexFromDisk();
  }
}

export async function rebuildRunIndexFromDisk(): Promise<RunSummary[]> {
  await fs.mkdir(PATHS.automationRuns, { recursive: true });

  let entries: string[] = [];
  try {
    entries = await fs.readdir(PATHS.automationRuns);
  } catch {
    return [];
  }

  const summaries: RunSummary[] = [];

  for (const entry of entries) {
    if (entry === "index.json") {
      continue;
    }

    const run = await loadRunFromDisk(entry);
    if (run) {
      summaries.push(toRunSummary(run));
    }
  }

  summaries.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  await fs.writeFile(indexFilePath(), `${JSON.stringify(summaries, null, 2)}\n`, "utf8");
  return summaries;
}

export function getRunSync(runId: string): RunRecord | undefined {
  return runs.get(runId);
}

export async function getRun(runId: string): Promise<RunRecord | undefined> {
  return runs.get(runId) ?? loadRunFromDisk(runId);
}

export function createRun(task: string): RunRecord {
  const run: RunRecord = {
    id: randomUUID(),
    task,
    status: "queued",
    startedAt: new Date().toISOString(),
    events: [],
    products: [],
    generatedItems: [],
  };

  runs.set(run.id, run);
  getEmitter(run.id);
  void persistRun(run.id);
  return run;
}

export function updateRun(runId: string, patch: Partial<RunRecord>): RunRecord {
  const current = runs.get(runId);
  if (!current) {
    throw new Error(`Run not found: ${runId}`);
  }

  const updated = { ...current, ...patch };
  runs.set(runId, updated);
  safeEmit(getEmitter(runId), "run", updated);
  void persistRun(runId);
  return updated;
}

export async function appendToolEvent(
  runId: string,
  event: Omit<ToolEvent, "id" | "runId" | "sequence"> & { id?: string },
): Promise<ToolEvent> {
  const run = runs.get(runId);
  if (!run) {
    throw new Error(`Run not found: ${runId}`);
  }

  const fullEvent: ToolEvent = {
    id: event.id ?? randomUUID(),
    runId,
    sequence: run.events.length + 1,
    toolName: event.toolName,
    status: event.status,
    input: event.input,
    output: event.output,
    error: event.error,
    startedAt: event.startedAt,
    completedAt: event.completedAt,
  };

  run.events.push(fullEvent);
  safeEmit(getEmitter(runId), "event", fullEvent);
  safeEmit(getEmitter(runId), "run", run);
  void persistRun(runId);
  return fullEvent;
}

export function subscribeToRun(
  runId: string,
  listener: (payload: { type: "run" | "event"; data: unknown }) => void,
): () => void {
  const emitter = getEmitter(runId);
  const onRun = (data: unknown) => listener({ type: "run", data });
  const onEvent = (data: unknown) => listener({ type: "event", data });
  emitter.on("run", onRun);
  emitter.on("event", onEvent);
  return () => {
    emitter.off("run", onRun);
    emitter.off("event", onEvent);
  };
}

export async function persistRun(runId: string): Promise<void> {
  const run = runs.get(runId);
  if (!run) {
    return;
  }

  const runDir = path.join(PATHS.automationRuns, runId);
  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(runFilePath(runId), `${JSON.stringify(run, null, 2)}\n`, "utf8");
  await updateRunIndex(run);
}

export function setRunArtifacts(
  runId: string,
  artifacts: Partial<
    Pick<
      RunRecord,
      "products" | "generatedItems" | "validation" | "review" | "report" | "feedbackDataset" | "feedbackAnalysis"
    >
  >,
): void {
  const run = runs.get(runId);
  if (!run) {
    return;
  }

  Object.assign(run, artifacts);
  safeEmit(getEmitter(runId), "run", run);
  void persistRun(runId);
}
