export const DEFAULT_COPY_MODEL = "claude-sonnet-4-6";
export const DEFAULT_AGENT_MODEL = "claude-haiku-4-5";

export function getCopyModel(): string {
  return process.env.ANTHROPIC_COPY_MODEL ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_COPY_MODEL;
}

export function getAgentModel(): string {
  return process.env.ANTHROPIC_AGENT_MODEL ?? DEFAULT_AGENT_MODEL;
}
