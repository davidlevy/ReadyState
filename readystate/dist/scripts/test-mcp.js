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
    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
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
    }
    catch (err) {
        console.error("Webhook test failed (is Hono server running on 3000?):", err.message, "\n");
    }
    console.log("Calling upsert_capability for api-checkout-v3 on staging...");
    const upsertResult1 = await client.callTool({
        name: "upsert_capability",
        arguments: {
            capabilityId: "api-checkout-v3",
            environment: "staging",
            description: "Test description for v3",
            requiredFlag: "test_flag_v3",
            author: "agent_test_runner"
        }
    });
    console.log("Upsert Result Staging:", JSON.stringify(upsertResult1, null, 2));
    console.log("\nCalling upsert_capability for api-checkout-v3 on production...");
    const upsertResult2 = await client.callTool({
        name: "upsert_capability",
        arguments: {
            capabilityId: "api-checkout-v3",
            environment: "production",
            description: "Test description for v3",
            requiredFlag: "test_flag_v3",
            author: "agent_test_runner"
        }
    });
    console.log("Upsert Result Production:", JSON.stringify(upsertResult2, null, 2));
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const count = await prisma.capability.count();
    console.log(`Total capabilities in DB: ${count}`);
    const v3Count = await prisma.capability.count({ where: { capabilityId: "api-checkout-v3" } });
    console.log(`Total capabilities for 'api-checkout-v3': ${v3Count}`);
    process.exit(0);
}
main().catch(console.error);
