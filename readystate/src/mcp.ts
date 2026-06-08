import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const originalLog = console.log;
console.log = () => {};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Load main .env (containing DATABASE_URL)
let mainEnvPath = path.resolve('.env');
if (!fs.existsSync(mainEnvPath)) {
  const possibleMainPaths = [
    path.join(__dirname, '../../.env'), // for dist/src/mcp.js
    path.join(__dirname, '../.env'),    // for src/mcp.ts
  ];
  for (const p of possibleMainPaths) {
    if (fs.existsSync(p)) {
      mainEnvPath = p;
      break;
    }
  }
}
dotenv.config({ path: mainEnvPath });

// 2. Load tokens .env (containing READYSTATE_READ_TOKEN, etc.)
let tokensEnvPath = '/app/data/.env';
if (!fs.existsSync(tokensEnvPath)) {
  const possibleTokenPaths = [
    path.join(__dirname, '../../data/.env'), // for dist/src/mcp.js
    path.join(__dirname, '../data/.env'),    // for src/mcp.ts
    path.resolve('data/.env'),
  ];
  for (const p of possibleTokenPaths) {
    if (fs.existsSync(p)) {
      tokensEnvPath = p;
      break;
    }
  }
}
dotenv.config({ path: tokensEnvPath });

console.log = originalLog;

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
import { normalizeEnvironment } from "./utils/envMapper.js";

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
            environment: { type: "string" },
            capabilityId: { type: "string" },
            annotationKey: { type: "string" },
            annotationValue: { type: "string" },
          },
          required: ["environment"],
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
            annotations: { type: "object", additionalProperties: { type: "string" } },
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
    const args = request.params.arguments as { capabilityId?: string; environment: string; annotationKey?: string; annotationValue?: string; };
    const capabilityId = args.capabilityId;
    const environment = normalizeEnvironment(args.environment);
    const annotationKey = args.annotationKey;
    const annotationValue = args.annotationValue;

    let capability = null;

    if (capabilityId) {
      capability = await prisma.capability.findFirst({
        where: { capabilityId, environmentName: environment },
      });
    } else if (annotationKey && annotationValue) {
      // Find capability where annotations string contains the key and value.
      // SQLite JSON functions aren't easily exposed in basic Prisma, so we do a contains search.
      const searchString = `"${annotationKey}":"${annotationValue}"`;
      capability = await prisma.capability.findFirst({
        where: { 
          environmentName: environment,
          annotations: { contains: searchString }
        },
      });
    } else {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "Must provide either capabilityId OR (annotationKey and annotationValue)" }) }],
      };
    }

    if (!capability) {
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

    let parsedAnnotations = null;
    if (capability.annotations) {
      try { parsedAnnotations = JSON.parse(capability.annotations); } catch (e) {}
    }

    return {
      content: [{ type: "text", text: JSON.stringify({ status: "fully_released", reason: "Code deployed and flag active. Ready for use.", annotations: parsedAnnotations }) }],
    };
  } else if (request.params.name === "list_recent_capabilities") {
    const args = request.params.arguments || {};
    const limit = typeof args.limit === "number" ? args.limit : 10;
    const environment = typeof args.environment === "string" ? normalizeEnvironment(args.environment) : undefined;

    const capabilities = await prisma.capability.findMany({
      where: environment ? { environmentName: environment } : undefined,
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    const formattedCapabilities = capabilities.map(cap => {
      let parsedAnnotations = null;
      if (cap.annotations) {
        try { parsedAnnotations = JSON.parse(cap.annotations); } catch (e) {}
      }
      return { ...cap, annotations: parsedAnnotations };
    });

    return {
      content: [{ type: "text", text: JSON.stringify(formattedCapabilities) }],
    };
  } else if (request.params.name === "upsert_capability") {
    const args = request.params.arguments as { capabilityId: string; environment: string; description: string; requiredFlag?: string; annotations?: Record<string, string>; author: string };
    const capabilityId = args.capabilityId;
    const environment = normalizeEnvironment(args.environment);
    const description = args.description;
    const requiredFlag = args.requiredFlag;
    const annotations = args.annotations;
    const author = args.author;

    const annotationsStr = annotations ? JSON.stringify(annotations) : null;

    const capability = await prisma.capability.upsert({
      where: { capabilityId_environmentName: { capabilityId, environmentName: environment } },
      update: {
        description,
        requiredFlag: requiredFlag || null,
        annotations: annotationsStr,
        updatedBy: author,
      },
      create: {
        capabilityId,
        description,
        requiredFlag: requiredFlag || null,
        annotations: annotationsStr,
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
