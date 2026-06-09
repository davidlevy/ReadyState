# Universal Sync API and Monorepo Support

**Status:** Accepted
**Date:** 2026-06-09

## Context and Problem Statement
ReadyState initially relied on a passive GitHub webhook (`/webhooks/github`) to fetch the `readystate-manifest.yml` file from the root of the repository. This approach presented three major flaws:
1. **Tight Coupling:** It only worked with GitHub's proprietary `deployment_status` payloads and signatures.
2. **Monorepo Incompatibility:** Reading a single static file from the root of a repository is not suitable for monorepos, where different microservices (e.g., API, frontend) have independent deployment lifecycles and manifests.
3. **Ghost Data:** Reading static manifest updates did not allow for "Garbage Collection" of deleted capabilities without full state knowledge.

## Considered Options
* **Option 1: Enhance the Webhook with Monorepo Logic.** Support multiple paths or subdirectories from GitHub webhook payloads. (Rejected: Too complex, still coupled to GitHub).
* **Option 2: Universal Declarative Sync API.** Expose a `POST /api/sync` endpoint that accepts the raw YAML file from ANY CI/CD pipeline, and implements Declarative Sync with automated Garbage Collection.

## Decision Outcome
Chosen option: **Option 2**, because it decouples ReadyState from specific Git providers, naturally supports monorepos (each microservice CI can push its own manifest), and guarantees zero hallucinations for AI agents by perfectly mirroring the desired state.

## Consequences
* **Good:** Fully CI-agnostic (works with GitLab, Jenkins, GitHub Actions via simple `curl`).
* **Good:** Automated Garbage Collection (self-healing state).
* **Good:** Introduces a strong `component` and `componentType` namespace for AI semantic search.
* **Bad:** Requires developers to manually configure their CI/CD to send a `curl` request to ReadyState, rather than simply ticking a "Webhook" box in their Git provider.
