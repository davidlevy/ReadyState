---
name: architecture-guardrails-updater
description: Ensures that architectural decisions and technical guardrails are documented in .md files with each new development or significant technical change.
---

# Architecture & Technical Decisions Guardrails Auto-Update

## When to use this skill

- Use this whenever you make a significant technical decision, architectural change, or introduce a new technical pattern/library during a development task.
- This ensures we maintain an up-to-date log of "why" we made certain technical choices and establishes guardrails for future agents.

## How to use it

1. You must proactively document the technical decision or architecture pattern. Do not wait for the user to ask you to document it.
2. If this is a new architectural decision, create a new Markdown file in the `docs/architecture/decisions/` directory (create the directory if it doesn't exist).
3. Use an Architecture Decision Record (ADR) format. The file should be named sequentially or descriptively (e.g., `docs/architecture/decisions/YYYY-MM-DD-short-description.md`).
4. If adding a general technical guardrail or coding standard, update or create `docs/technical-guardrails.md`.

## Required Format for ADRs

When creating an ADR in `docs/architecture/decisions/`, use the following structure:

```markdown
# Title of the Decision

**Status:** Proposed / Accepted / Deprecated
**Date:** YYYY-MM-DD

## Context and Problem Statement
What is the issue that we're seeing that is motivating this decision or change?

## Considered Options
* Option 1
* Option 2

## Decision Outcome
Chosen option: "[option 1]", because [justification].

## Consequences
* Good: [argument]
* Bad: [argument]
```

## Required Format for Guardrails

When adding to `docs/technical-guardrails.md`:

```markdown
### [Topic/Component Name]
- **Rule:** [What must or must not be done]
- **Reason:** [Why this rule exists]
```

## General Policies
- Be concise but complete.
- Always explain *why* a decision was made, not just *what* was done.
- If modifying an existing pattern, update the guardrails document to reflect the new state.
