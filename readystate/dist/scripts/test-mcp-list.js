import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
async function main() {
    const transport = new StdioClientTransport({
        command: "npx",
        args: ["tsx", "src/mcp.ts"],
    });
    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
    console.log("Calling list_recent_capabilities...");
    try {
        const result = await client.callTool({
            name: "list_recent_capabilities",
            arguments: {
                limit: 5,
                environment: "staging"
            },
        });
        console.log("Result:");
        console.log(JSON.stringify(result, null, 2));
    }
    catch (error) {
        console.error("Error calling tool:", error);
    }
    finally {
        await transport.close();
    }
}
main().catch(console.error);
