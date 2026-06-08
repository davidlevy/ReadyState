import * as dotenv from 'dotenv';
dotenv.config({ path: '/app/data/.env' });

if (!process.env.READYSTATE_READ_TOKEN || !process.env.READYSTATE_WRITE_TOKEN) {
  console.error("FATAL: READYSTATE_READ_TOKEN and READYSTATE_WRITE_TOKEN must be set in environment.");
  process.exit(1);
}

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { PrismaClient } from "@prisma/client";
import { isFlagActive } from "./services/flagService.js";

const prisma = new PrismaClient();
const server = new Server(
  { name: "ReadyState", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_capability_status",
        description: "Get the deployment and feature flag status of a capability",
        inputSchema: {
          type: "object",
          properties: {
            capabilityId: { type: "string" },
            environment: { type: "string" },
          },
          required: ["capabilityId", "environment"],
        },
      },
      {
        "name": "list_recent_capabilities",
        "description": "Exposes the latest modified capabilities. STRICT DIRECTIVE FOR THE AI: Never return raw JSON to the user. Always format the results as a clear Markdown table, with columns: ID, Description, Feature Flag, Author, and Date (human-readable format).",
        "inputSchema": {
          "type": "object",
          "properties": {
            "limit": { "type": "integer", "description": "Maximum number of results to return (default 10)" },
            "environment": { "type": "string", "description": "Filter by specific environment (optional)" }
          }
        }
      },
      {
        name: "upsert_capability",
        description: "Adds or updates a capability. The agent MUST provide its identifier in the author field.",
        inputSchema: {
          type: "object",
          properties: {
            capabilityId: { type: "string" },
            environment: { type: "string" },
            description: { type: "string" },
            requiredFlag: { type: "string" },
            author: { type: "string", description: "Identifier of the agent or user performing the action." }
          },
          required: ["capabilityId", "environment", "description", "author"]
        }
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_capability_status") {
    const { capabilityId, environment } = request.params.arguments as { capabilityId: string; environment: string };

    const capability = await prisma.capability.findUnique({
      where: { id: capabilityId },
    });

    if (!capability || capability.environmentName !== environment) {
      return {
        content: [{ type: "text", text: JSON.stringify({ status: "not_deployed", reason: "Missing from the currently deployed SHA" }) }],
      };
    }

    if (capability.requiredFlag) {
      const isActive = await isFlagActive(capability.requiredFlag, environment);
      if (!isActive) {
        return {
          content: [{ type: "text", text: JSON.stringify({ status: "deployed_but_inactive", reason: "The code is present but the feature flag is disabled" }) }],
        };
      }
    }

    return {
      content: [{ type: "text", text: JSON.stringify({ status: "fully_released", reason: "Code deployed and flag active. Ready for use." }) }],
    };
  } else if (request.params.name === "list_recent_capabilities") {
    const args = request.params.arguments || {};
    const limit = typeof args.limit === "number" ? args.limit : 10;
    const environment = typeof args.environment === "string" ? args.environment : undefined;

    const capabilities = await prisma.capability.findMany({
      where: environment ? { environmentName: environment } : undefined,
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return {
      content: [{ type: "text", text: JSON.stringify(capabilities) }],
    };
  } else if (request.params.name === "upsert_capability") {
    const { capabilityId, environment, description, requiredFlag, author } = request.params.arguments as { capabilityId: string; environment: string; description: string; requiredFlag?: string; author: string };

    const capability = await prisma.capability.upsert({
      where: { id: capabilityId },
      update: {
        description,
        requiredFlag: requiredFlag || null,
        environmentName: environment,
        updatedBy: author,
      },
      create: {
        id: capabilityId,
        description,
        requiredFlag: requiredFlag || null,
        environmentName: environment,
        createdBy: author,
        updatedBy: author,
      },
    });

    return {
      content: [{ type: "text", text: JSON.stringify(capability) }],
    };
  }

  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ReadyState MCP Server running on STDIO");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
