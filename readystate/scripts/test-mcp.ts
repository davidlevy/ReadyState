import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "src/mcp.ts"],
  });

  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);

  console.log("Calling upsert_capability for api-checkout-v3 on staging...");
  const upsertResult = await client.callTool({
    name: "upsert_capability",
    arguments: {
      capabilityId: "api-checkout-v3",
      environment: "staging",
      description: "Test description for v3",
      requiredFlag: "test_flag_v3"
    }
  });
  console.log("Upsert Result:", JSON.stringify(upsertResult, null, 2));

  console.log("\nCalling get_capability_status for api-checkout-v3 on staging...");
  const result = await client.callTool({
    name: "get_capability_status",
    arguments: {
      capabilityId: "api-checkout-v3",
      environment: "staging"
    }
  });

  console.log("Result:", JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(console.error);
