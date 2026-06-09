import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const envArg = process.argv[2];

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "src/mcp.ts"],
    env: {
      ...process.env,
      READYSTATE_READ_TOKEN: process.env.READYSTATE_READ_TOKEN || "token",
      READYSTATE_WRITE_TOKEN: process.env.READYSTATE_WRITE_TOKEN || "token"
    }
  });

  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);

  console.log(`Calling list_recent_capabilities via MCP${envArg ? ` for environment: ${envArg}` : ''}...`);
  const result = await client.callTool({
    name: "list_recent_capabilities",
    arguments: { limit: 10, ...(envArg ? { environment: envArg } : {}) }
  });

  const content: any = result.content;
  console.log(content[0].text);
  process.exit(0);
}

main().catch(console.error);
