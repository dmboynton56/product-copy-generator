const MAX_AGENT_JSON_CHARS = 12_000;
const HTML_PREVIEW_CHARS = 400;

export function sanitizeToolResultForAgent(toolName: string, output: unknown): unknown {
  if (!output || typeof output !== "object") {
    return output;
  }

  if (toolName === "fetch_url") {
    const record = output as Record<string, unknown>;
    const html = typeof record.html === "string" ? record.html : "";

    return {
      url: record.url,
      status: record.status,
      content_type: record.content_type,
      fetched_at: record.fetched_at,
      html_length: html.length,
      html_preview: html.slice(0, HTML_PREVIEW_CHARS).replace(/\s+/g, " ").trim(),
      note:
        "Full HTML omitted from agent context. Use extract_khaite_collection or extract_khaite_product instead of fetch_url.",
    };
  }

  if (toolName === "validate_copy") {
    const record = output as Record<string, unknown>;
    const reportMarkdown =
      typeof record.reportMarkdown === "string" ? record.reportMarkdown : undefined;

    return {
      issueCount: record.issueCount,
      issues: record.issues,
      bannedCliches: record.bannedCliches,
      reportMarkdown: reportMarkdown
        ? `[${reportMarkdown.length} character markdown report omitted — use issueCount/issues]`
        : undefined,
    };
  }

  if (toolName === "load_feedback_dataset") {
    const record = output as Record<string, unknown>;

    return {
      dataset: record.dataset,
      summary: record.summary,
      note: "Pass this dataset object into analyze_buyer_feedback.",
    };
  }

  if (toolName === "write_report" || toolName === "write_feedback_report") {
    const record = output as Record<string, unknown>;
    return {
      runId: record.runId,
      markdownPath: record.markdownPath,
      jsonPath: record.jsonPath,
      note: "Final report written to disk.",
    };
  }

  const serialized = JSON.stringify(output);
  if (serialized.length > MAX_AGENT_JSON_CHARS) {
    return {
      note: "Tool output truncated for agent context.",
      preview: `${serialized.slice(0, 4000)}...`,
      original_length: serialized.length,
    };
  }

  return output;
}

export function serializeToolResultForAgent(toolName: string, output: unknown): string {
  return JSON.stringify(sanitizeToolResultForAgent(toolName, output));
}
