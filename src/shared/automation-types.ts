export type RunStatus = "queued" | "running" | "completed" | "failed";

export type ToolEvent = {
  id: string;
  runId: string;
  sequence: number;
  toolName: string;
  status: "requested" | "running" | "completed" | "failed";
  input: unknown;
  output?: unknown;
  error?: string;
  startedAt: string;
  completedAt?: string;
};

export type RunSummary = {
  id: string;
  task: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  productCount: number;
  eventCount: number;
  error?: string;
};
