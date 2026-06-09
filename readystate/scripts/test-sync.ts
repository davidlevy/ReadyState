import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.join(__dirname, "../data/.env"), override: true });

async function main() {
  const secret = process.env.READYSTATE_WRITE_TOKEN || "dummy";
  const manifestPath = path.join(__dirname, "../../readystate-manifest.yml");
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');

  console.log("--- 1. Testing POST /api/sync (Initial Push) ---");
  try {
    const res = await fetch("http://localhost:3001/api/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-yaml",
        "Authorization": `Bearer ${secret}`,
        "x-environment": "staging",
        "x-commit-sha": "test-sync-12345"
      },
      body: manifestContent
    });
    console.log("Status:", res.status);
    console.log("Body:", JSON.stringify(await res.json(), null, 2));
  } catch (err: any) {
    console.error("Test failed:", err.message);
  }

  console.log("\n--- 2. Testing Garbage Collection (Removing one capability) ---");
  // We simulate removing the 'mcp-agent-interface' capability from the file
  const lines = manifestContent.split('\n');
  const filteredLines = lines.filter(line => !line.includes('mcp-agent-interface') && !line.includes('mcp_enabled') && !line.includes('auth tokens'));
  const modifiedManifest = filteredLines.join('\n');
  
  try {
    const resGC = await fetch("http://localhost:3001/api/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-yaml",
        "Authorization": `Bearer ${secret}`,
        "x-environment": "staging",
        "x-commit-sha": "test-sync-gc"
      },
      body: modifiedManifest
    });
    console.log("Status:", resGC.status);
    console.log("Body:", JSON.stringify(await resGC.json(), null, 2));
  } catch (err: any) {
    console.error("Test GC failed:", err.message);
  }

  process.exit(0);
}

main();
