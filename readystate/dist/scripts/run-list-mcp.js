import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
async function main() {
    const transport = new StdioClientTransport({
        command: "npx",
        args: ["tsx", "src/mcp.ts"],
    });
    const client = new Client({ name: "list-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
    console.log("Calling list_recent_capabilities...");
    const result = await client.callTool({
        name: "list_recent_capabilities",
        arguments: { limit: 10 }
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
}
main().catch(console.error);
