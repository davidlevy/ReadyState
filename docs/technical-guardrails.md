# Technical Guardrails

This document outlines the strict architectural rules and development standards for the ReadyState codebase.

### Capability Ingestion Architecture
- **Rule:** Manifests must be ingested via the Universal Push API (`POST /api/sync`), NOT by relying on specific Git Provider webhooks pulling static files.
- **Reason:** Ensuring compatibility with any CI/CD platform and providing native support for Monorepo architectures. The Declarative Sync approach guarantees proper Garbage Collection of obsolete capabilities.

### Capability Namespacing
- **Rule:** Every capability must belong to a strictly defined `component` (e.g., `core-backend`) and ideally have a `componentType` (e.g., `api`, `llm`, `worker`).
- **Reason:** Prevents naming collisions between microservices and allows AI agents to semantically filter capabilities by architecture type.

### Annotations & Metadata Standards
- **Rule:** When adding metadata to a capability's `annotations`, you MUST use domain-based URI namespaces (for external tools) or the `local/` namespace (for repository files) to ensure agnostic interoperability.
- **Reason:** Prevents context bloat for AI agents while maintaining a strict Single Source of Truth (SSOT). Do not duplicate technical specs in the YAML description; instead, point to them.
- **Standard Keys:**
  - **Internal (Local):**
    - `local/contract`: Pointer to the strict technical contract (OpenAPI, GraphQL, Protobuf). E.g., `dir:./docs/api.yaml`.
    - `local/docs`: Pointer to general documentation or ADRs.
  - **Source Control:**
    - `github.com/pull-request` or `github.com/issue`: Pointer to GitHub contexts.
    - `gitlab.com/merge-request` or `gitlab.com/issue`: Pointer to GitLab contexts.
  - **Project Management:**
    - `linear.app/issue`: Pointer to Linear tasks.
    - `jira.com/ticket`: Pointer to Jira issues.
    - `notion.so/page`: Pointer to Notion PRDs or specs.
  - **Operations:**
    - `pagerduty.com/incident`: Pointer to active or past incidents.
    - `sentry.io/issue`: Pointer to error tracking.
