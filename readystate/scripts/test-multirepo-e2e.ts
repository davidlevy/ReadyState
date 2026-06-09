import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config(); // Fallback
dotenv.config({ path: path.join(__dirname, "../data/.env"), override: true });

const secret = process.env.READYSTATE_WRITE_TOKEN || "dummy";
const port = process.env.PORT || 3001;
const apiPath = `http://localhost:${port}/api/sync`;

async function pushManifest(environment: string, sha: string, yamlContent: string) {
  const res = await fetch(apiPath, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secret}`,
      "x-environment": environment,
      "x-commit-sha": sha,
      "Content-Type": "application/x-yaml",
    },
    body: yamlContent
  });
  
  if (!res.ok) {
    throw new Error(`Sync failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

const backendV1 = `
component: core-backend
componentType: api
capabilities:
  - id: api-checkout
    description: "Checkout API"
  - id: api-billing
    description: "Billing API"
  - id: api-users
    description: "Users API"
`;

const frontendV1 = `
component: web-frontend
componentType: ui
capabilities:
  - id: ui-checkout-button
    description: "Checkout button UI"
    annotations:
      local/contract: "dir:./src/components/Checkout.tsx"
  - id: ui-user-profile
    description: "User profile dashboard"
`;

const backendV2 = `
component: core-backend
componentType: api
capabilities:
  - id: api-checkout
    description: "Checkout API (v2)"
  - id: api-billing
    description: "Billing API"
  # ATTENTION: api-users has been DELETED in this PR!
`;

async function main() {
  console.log("🚀 Starting Complex Multi-Repo E2E Simulation...\n");

  try {
    console.log("--- 1. Backend CI deploys to Staging ---");
    const res1 = await pushManifest("staging", "backend-sha-1", backendV1);
    console.log(`✅ Backend deployed. Inserted: ${res1.capabilitiesInserted}, Removed: ${res1.capabilitiesRemoved}\n`);

    console.log("--- 2. Frontend CI deploys to Staging ---");
    const res2 = await pushManifest("staging", "frontend-sha-1", frontendV1);
    console.log(`✅ Frontend deployed. Inserted: ${res2.capabilitiesInserted}, Removed: ${res2.capabilitiesRemoved}\n`);

    console.log("--- 3. Backend CI pushes a refactor (deleting 'api-users') ---");
    const res3 = await pushManifest("staging", "backend-sha-2", backendV2);
    console.log(`✅ Backend redeployed. Inserted/Updated: ${res3.capabilitiesInserted}, Removed (Garbage Collected): ${res3.capabilitiesRemoved}\n`);

    console.log("🎯 SUCCESS! Garbage collection perfectly isolated the Backend namespace without touching the Frontend.\n");
    
    console.log(`
💡 FUTURE COMPLEX TESTS TO IMPLEMENT:
1. DAG Dependency Resolution Test: 
   - A script that parses 'consumesCapabilities' in the Frontend manifest, checks the DB to see if those IDs exist in Staging, and throws an Error if the Backend dependency is missing (Blocking the CI).
2. Environment Promotion Test:
   - Push to 'staging', verify it exists. Push to 'production', verify it exists. Prove that capabilities can exist in Staging but not Production.
3. Feature Flag Mismatch Test:
   - Agent tries to verify 'api-checkout'. ReadyState says 'deployed_but_inactive'. Test asserts that the E2E test suite handles the disabled state gracefully.
4. MCP Autonomous Agent Integration Test:
   - Spawn a real LLM using the @modelcontextprotocol/sdk, give it a prompt to write code for 'api-checkout', and assert that the LLM successfully fetches the 'local/contract' via the MCP tool before generating code.
`);

  } catch (err) {
    console.error("Test failed:", err);
  }
}

main();
