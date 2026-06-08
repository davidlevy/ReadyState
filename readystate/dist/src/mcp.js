import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from "@modelcontextprotocol/sdk/types.js";
import { PrismaClient } from "@prisma/client";
import { isFlagActive } from "./services/flagService.js";
const prisma = new PrismaClient();
const server = new Server({ name: "ReadyState", version: "1.0.0" }, { capabilities: { tools: {} } });
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
        ],
    };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "get_capability_status") {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }
    const { capabilityId, environment } = request.params.arguments;
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
