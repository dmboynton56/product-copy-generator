import Anthropic from "@anthropic-ai/sdk";
import { AGENT_SYSTEM_PROMPT } from "@/agent/prompts";
import { executeTool, TOOL_DEFINITIONS, type ToolName } from "@/agent/tools";
import { getAgentModel } from "@/lib/models";
import { serializeToolResultForAgent } from "@/lib/tool-result-summary";
import { formatApiError } from "@/lib/utils";
import {
  appendToolEvent,
  getRunSync,
  persistRun,
  setRunArtifacts,
  updateRun,
  type RunRecord,
} from "@/storage/runs";

const AGENT_MODEL = getAgentModel();
const MAX_TOOL_CALLS = 30;
const MAX_PRODUCT_PAGES = 12;
const RUN_TIMEOUT_MS = 10 * 60 * 1000;

type Message = Anthropic.Messages.MessageParam;

function isToolName(name: string): name is ToolName {
  return TOOL_DEFINITIONS.some((tool) => tool.name === name);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function prepareToolInput(runId: string, task: string, toolName: ToolName, input: unknown): unknown {
  if (!isRecord(input)) {
    return input;
  }

  if (toolName !== "write_report" && toolName !== "write_feedback_report") {
    return input;
  }

  const next: Record<string, unknown> = {
    ...input,
    runId,
    task,
  };

  if (toolName === "write_feedback_report") {
    const current = getRunSync(runId);
    if (current?.feedbackDataset) {
      next.dataset = current.feedbackDataset;
    }
    if (current?.feedbackAnalysis) {
      next.analysis = current.feedbackAnalysis;
    }
  }

  return next;
}

function trackArtifacts(runId: string, toolName: ToolName, output: unknown) {
  if (toolName === "load_feedback_dataset" && output && typeof output === "object") {
    const dataset = (output as { dataset?: { products?: Record<string, unknown>[] } }).dataset;
    const products =
      dataset?.products?.map((product) => ({
        name: product.productName,
        url: product.url,
        category: product.category,
        feedbackSignals:
          ((product.reviews as unknown[] | undefined)?.length ?? 0) +
          ((product.returnReasons as unknown[] | undefined)?.length ?? 0) +
          ((product.fitFeedback as unknown[] | undefined)?.length ?? 0),
      })) ?? [];
    setRunArtifacts(runId, { feedbackDataset: dataset as Record<string, unknown> | undefined, products });
  }

  if (toolName === "analyze_buyer_feedback" && output && typeof output === "object") {
    setRunArtifacts(runId, { feedbackAnalysis: output as Record<string, unknown> });
  }

  if (toolName === "extract_khaite_collection" && output && typeof output === "object") {
    const products = (output as { products?: Record<string, unknown>[] }).products ?? [];
    setRunArtifacts(runId, { products });
  }

  if (toolName === "extract_khaite_product" && output && typeof output === "object") {
    const current = getRunSync(runId);
    if (!current) {
      return;
    }
    const products = [...current.products];
    const record = output as Record<string, unknown>;
    const index = products.findIndex((item) => item.url === record.url);
    if (index >= 0) {
      products[index] = record;
    } else {
      products.push(record);
    }
    setRunArtifacts(runId, { products });
  }

  if (toolName === "generate_copy" && output && typeof output === "object") {
    const current = getRunSync(runId);
    if (!current) {
      return;
    }
    setRunArtifacts(runId, {
      generatedItems: [...current.generatedItems, output as Record<string, unknown>],
    });
  }

  if (toolName === "validate_copy" && output && typeof output === "object") {
    setRunArtifacts(runId, { validation: output as Record<string, unknown> });
  }

  if (toolName === "review_copy" && output && typeof output === "object") {
    setRunArtifacts(runId, { review: output as Record<string, unknown> });
  }

  if (
    (toolName === "write_report" || toolName === "write_feedback_report") &&
    output &&
    typeof output === "object"
  ) {
    setRunArtifacts(runId, { report: output as Record<string, unknown> });
  }
}

export async function runAgentLoop(run: RunRecord): Promise<RunRecord> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is missing.");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const startedAt = Date.now();
  let toolCalls = 0;
  let productPages = 0;

  updateRun(run.id, { status: "running" });

  const messages: Message[] = [{ role: "user", content: run.task }];

  try {
    while (toolCalls < MAX_TOOL_CALLS && Date.now() - startedAt < RUN_TIMEOUT_MS) {
      const response = await client.messages.create({
        model: AGENT_MODEL,
        max_tokens: 1500,
        system: AGENT_SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      const toolUses = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use",
      );

      if (toolUses.length === 0) {
        const finalText = response.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n")
          .trim();

        const completed = updateRun(run.id, {
          status: "completed",
          completedAt: new Date().toISOString(),
          finalSummary: finalText || "Automation run completed.",
        });
        await persistRun(run.id);
        return completed;
      }

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const toolUse of toolUses) {
        toolCalls += 1;
        if (toolUse.name === "extract_khaite_product") {
          productPages += 1;
        }

        if (productPages > MAX_PRODUCT_PAGES) {
          throw new Error(`Exceeded maximum product pages per run (${MAX_PRODUCT_PAGES}).`);
        }

        const toolInput = isToolName(toolUse.name)
          ? prepareToolInput(run.id, run.task, toolUse.name, toolUse.input)
          : toolUse.input;
        const startedEventAt = new Date().toISOString();
        await appendToolEvent(run.id, {
          toolName: toolUse.name,
          status: "running",
          input: toolInput,
          startedAt: startedEventAt,
        });

        try {
          if (!isToolName(toolUse.name)) {
            throw new Error(`Unknown tool requested: ${toolUse.name}`);
          }

          const output = await executeTool(toolUse.name, toolInput);
          trackArtifacts(run.id, toolUse.name, output);
          const agentOutput = serializeToolResultForAgent(toolUse.name, output);

          await appendToolEvent(run.id, {
            toolName: toolUse.name,
            status: "completed",
            input: toolInput,
            output: JSON.parse(agentOutput),
            startedAt: startedEventAt,
            completedAt: new Date().toISOString(),
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: agentOutput,
          });
        } catch (error) {
          const message = formatApiError(error);
          await appendToolEvent(run.id, {
            toolName: toolUse.name,
            status: "failed",
            input: toolInput,
            error: message,
            startedAt: startedEventAt,
            completedAt: new Date().toISOString(),
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: message,
            is_error: true,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
    }

    throw new Error("Agent loop stopped due to safety limits.");
  } catch (error) {
    const failed = updateRun(run.id, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error: formatApiError(error),
    });
    await persistRun(run.id);
    return failed;
  }
}
