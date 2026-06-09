# ReadyState

ReadyState is an AI-native Service Registry that acts as the absolute source of truth for the "Ready State" of your infrastructure. It perfectly bridges the gap between what is written in your code (the Manifest) and what is actually deployed in your environments.

## Architecture Overview

At the heart of ReadyState is the **Declarative Sync** architecture. It decouples the CI/CD pipelines from the AI Agents, ensuring that AI Agents never hallucinate an integration with a service that isn't fully deployed yet.

```mermaid
graph TD
    subgraph "CI/CD (Monorepo or Polyrepo)"
        CI1[Frontend Pipeline]
        CI2[Backend Pipeline]
        CI3[AI Worker Pipeline]
    end

    subgraph "ReadyState Infrastructure"
        API[Hono API (POST /api/sync)]
        DB[(SQLite Database)]
        MCP[MCP Server Interface]
        
        API -->|Upserts & Garbage Collects| DB
        MCP -->|Reads true deployment state| DB
    end

    subgraph "Autonomous AI Agents"
        A1[Agent Frontend]
        A2[Agent Backend]
    end

    CI1 -- "curl POST Manifest" --> API
    CI2 -- "curl POST Manifest" --> API
    CI3 -- "curl POST Manifest" --> API
    
    A1 -- "Is the Backend API deployed?" --> MCP
    A2 -- "List all Web Components" --> MCP
```

### The 3 Pillars of ReadyState:
1. **The Manifest (YAML):** Developers or AI agents maintain a `readystate-manifest.yml` file alongside their code. It describes the public capabilities of the component.
2. **The Sync API:** When a CI pipeline deploys the component to an environment (e.g., `production`), it POSTs the YAML to `/api/sync`. ReadyState updates the SQLite database and **Garbage Collects** any obsolete capabilities.
3. **The MCP Server:** AI agents use the Model Context Protocol to ask ReadyState if a capability is actually deployed before they start writing code that depends on it.

---

## Deployment Guide

Deploying ReadyState is extremely simple as it is fully containerized.

### 1. Initial Setup
The application requires secure tokens to authorize CI pipelines (Write) and AI agents (Read).
ReadyState automatically generates these on the first boot via its Docker Entrypoint.

### 2. Running with Docker Compose
To build and start the service in the background:
```bash
docker compose up -d --build
```
*Note: The `--build` flag is crucial after pulling new code to ensure the Hono API and MCP Server use the latest TypeScript compilation.*

### 3. Extracting your Security Tokens
Once the container is running, the entrypoint will have generated your secure tokens in the `data/` volume.
Read them with:
```bash
cat data/.env
```
You will see:
```env
READYSTATE_READ_TOKEN=rs_read_...
READYSTATE_WRITE_TOKEN=rs_write_...
```

### 4. Configuring your CI/CD (GitHub Actions, GitLab, etc.)
To notify ReadyState of a successful deployment, add this simple `curl` command at the very end of your CI pipeline.

**Required Secrets in your CI:**
- `READYSTATE_SYNC_URL`: e.g., `https://readystate.yourdomain.com/api/sync`
- `READYSTATE_WRITE_TOKEN`: The `rs_write_...` token from step 3.

**The Pipeline Script:**
```bash
# Push the desired state to ReadyState
curl -f -X POST "$READYSTATE_SYNC_URL" \
  -H "Authorization: Bearer $READYSTATE_WRITE_TOKEN" \
  -H "x-environment: production" \
  -H "x-commit-sha: $GITHUB_SHA" \
  -H "Content-Type: application/x-yaml" \
  --data-binary @readystate-manifest.yml
```

### 5. DevOps Monitoring
You can monitor the health of your ReadyState instance using its built-in DevOps routes:
- **`GET /health`** : Returns 200 OK and verifies the SQLite connection.
- **`GET /metrics`** : Returns the active environment count, capability count, and server uptime.

### 6. Integrating with AI Agents (MCP Server)

You can connect your favorite AI assistants (Claude Code, Gemini, Cursor, Claude Desktop, etc.) to ReadyState so they can query deployment status locally before making code changes.

To integrate the MCP Server, add the following configuration to your agent's MCP configuration file (e.g., `~/.gemini/config/mcp_config.json`, `~/.claude.json`, or Cursor's MCP settings):

```json
{
  "mcpServers": {
    "readystate": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v", "/absolute/path/to/ReadyState/data:/app/data",
        "readystate",
        "node",
        "dist/src/mcp.js"
      ]
    }
  }
}
```
*Note: Make sure to replace `/absolute/path/to/ReadyState/data` with the actual path to your local `data` directory, so the MCP server can access the SQLite database.*