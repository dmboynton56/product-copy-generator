import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchUrl } from "../../../src/tools/fetch-url";
import { searchWeb } from "../../../src/tools/search-web";
import { extractKhaiteCollection } from "../../../src/tools/extract-khaite-collection";
import { extractKhaiteProduct } from "../../../src/tools/extract-khaite-product";
import { writeReport } from "../../../src/tools/write-report";

const server = new McpServer({
  name: "catalog-server",
  version: "0.1.0",
});

server.registerTool(
  "search_web",
  {
    description: "Find relevant public KHAITE pages for a brand, category, or product query.",
    inputSchema: {
      query: z.string(),
      allowed_domains: z.array(z.string()).optional(),
    },
  },
  async (input) => ({
    content: [{ type: "text", text: JSON.stringify(await searchWeb(input), null, 2) }],
  }),
);

server.registerTool(
  "fetch_url",
  {
    description: "Fetch a public page and return normalized HTML with metadata.",
    inputSchema: {
      url: z.string(),
    },
  },
  async (input) => {
    const result = await fetchUrl(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ...result,
              html: `[omitted ${result.html.length} chars]`,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.registerTool(
  "extract_khaite_collection",
  {
    description: "Parse a KHAITE collection page and return product cards with URLs.",
    inputSchema: {
      collection_url: z.string(),
      limit: z.number().optional(),
    },
  },
  async (input) => ({
    content: [{ type: "text", text: JSON.stringify(await extractKhaiteCollection(input), null, 2) }],
  }),
);

server.registerTool(
  "extract_khaite_product",
  {
    description: "Parse a KHAITE product page into normalized catalog fields.",
    inputSchema: {
      url: z.string(),
    },
  },
  async (input) => ({
    content: [{ type: "text", text: JSON.stringify(await extractKhaiteProduct(input), null, 2) }],
  }),
);

server.registerTool(
  "write_catalog_report",
  {
    description: "Produce a final Markdown and JSON catalog automation report.",
    inputSchema: {
      runId: z.string(),
      task: z.string(),
      collectionUrl: z.string().optional(),
      products: z.array(z.record(z.string(), z.unknown())),
      generatedItems: z.array(z.record(z.string(), z.unknown())),
      validation: z.record(z.string(), z.unknown()),
      review: z.record(z.string(), z.unknown()),
      finalSummary: z.string().optional(),
    },
  },
  async (input) => ({
    content: [{ type: "text", text: JSON.stringify(await writeReport(input), null, 2) }],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
