import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as crypto from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

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

  console.log("Testing GitHub Webhook with HMAC signature...");
  const payload = JSON.stringify({ state: "success", environment: "staging", sha: "def456_hmac_test", repository: { full_name: "davidlevy/ReadyState" } });
  const secret = process.env.READYSTATE_WRITE_TOKEN || "dummy_secret_if_not_set";
  const signature = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;

  try {
    const res = await fetch("http://localhost:3000/webhooks/github", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": signature
      },
      body: payload
    });
    console.log("Webhook Response:", res.status, await res.text(), "\n");
  } catch (err: any) {
    console.error("Webhook test failed (is Hono server running on 3000?):", err.message, "\n");
  }

  console.log("Calling upsert_capability for api-checkout-v3 on staging...");
  const upsertResult = await client.callTool({
    name: "upsert_capability",
    arguments: {
      capabilityId: "api-checkout-v3",
      environment: "staging",
      description: "Test description for v3",
      requiredFlag: "test_flag_v3",
      author: "agent_test_runner"
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
