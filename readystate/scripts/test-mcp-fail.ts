import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  console.log("Tentative de connexion au serveur MCP SANS les tokens...");
  
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "src/mcp.ts"],
    env: {
      // Nous omettons volontairement les tokens !
      PATH: process.env.PATH || ""
    }
  });

  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    console.log("❌ ÉCHEC DU TEST : La connexion a réussi alors qu'elle aurait dû être refusée !");
  } catch (error: any) {
    console.log("✅ SUCCÈS DU TEST : La connexion a été rejetée par le serveur.");
    console.log("Raison :", error.message);
  }
  
  process.exit(0);
}

main().catch(console.error);
