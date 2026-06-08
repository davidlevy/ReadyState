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
        "description": "Expose les dernières capacités modifiées ou déployées sur le système, triées par ordre chronologique inverse.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "limit": { "type": "integer", "description": "Nombre maximum de résultats à retourner (par défaut 10)" },
            "environment": { "type": "string", "description": "Filtrer par environnement spécifique (optionnel)" }
          }
        }
      },
      {
        name: "upsert_capability",
        description: "Ajoute une nouvelle capacité ou met à jour une capacité existante sur un environnement spécifique (comportement d'upsert).",
        inputSchema: {
          type: "object",
          properties: {
            capabilityId: { type: "string", description: "L'ID unique de la capacité (ex: api-checkout-v3)" },
            environment: { type: "string", description: "L'environnement cible (ex: local, staging)" },
            description: { type: "string", description: "La description de ce que fait cette capacité" },
            requiredFlag: { type: "string", description: "Le nom du feature flag requis (optionnel)" }
          },
          required: ["capabilityId", "environment", "description"]
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
        content: [{ type: "text", text: JSON.stringify({ status: "not_deployed", reason: "Absent du SHA actuel déployé" }) }],
      };
    }

    if (capability.requiredFlag) {
      const isActive = await isFlagActive(capability.requiredFlag, environment);
      if (!isActive) {
        return {
          content: [{ type: "text", text: JSON.stringify({ status: "deployed_but_inactive", reason: "Le code est présent mais le feature flag est désactivé" }) }],
        };
      }
    }

    return {
      content: [{ type: "text", text: JSON.stringify({ status: "fully_released", reason: "Code déployé et flag actif. Prêt à l'usage." }) }],
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
    const { capabilityId, environment, description, requiredFlag } = request.params.arguments as { capabilityId: string; environment: string; description: string; requiredFlag?: string };

    const capability = await prisma.capability.upsert({
      where: { id: capabilityId },
      update: {
        description,
        requiredFlag: requiredFlag || null,
        environmentName: environment,
      },
      create: {
        id: capabilityId,
        description,
        requiredFlag: requiredFlag || null,
        environmentName: environment,
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
