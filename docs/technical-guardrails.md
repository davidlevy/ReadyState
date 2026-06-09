# Technical Guardrails

This document outlines the strict architectural rules and development standards for the ReadyState codebase.

### Capability Ingestion Architecture
- **Rule:** Manifests must be ingested via the Universal Push API (`POST /api/sync`), NOT by relying on specific Git Provider webhooks pulling static files.
- **Reason:** Ensuring compatibility with any CI/CD platform and providing native support for Monorepo architectures. The Declarative Sync approach guarantees proper Garbage Collection of obsolete capabilities.

### Capability Namespacing
- **Rule:** Every capability must belong to a strictly defined `component` (e.g., `core-backend`) and ideally have a `componentType` (e.g., `api`, `llm`, `worker`).
- **Reason:** Prevents naming collisions between microservices and allows AI agents to semantically filter capabilities by architecture type.
