---
name: readystate-updater
description: Ensures that the readystate-manifest.yml file is always kept in sync with the actual capabilities developed in the project. Use when you add new features.
---

# ReadyState Manifest Auto-Update

## When to use this skill

- Use this whenever you implement a new feature, capability, integration, or tool in the project.
- This is helpful for keeping our capability registry up-to-date and enabling dogfooding of the ReadyState platform.

## How to use it

1. You must automatically declare the new feature in the `readystate-manifest.yml` file located at the root of the project.
2. Do not wait for the user to ask you to update the manifest. Do it proactively as part of your implementation task.
3. The format of the `readystate-manifest.yml` file must include a top-level `component` string and a `capabilities` list:
   ```yaml
   component: my-service-name
   componentType: api
   capabilities:
   - id: kebab-case-name-of-the-feature
     description: A clear, concise description of what the feature does (in English or match the existing language).
     requiredFlag: optional_feature_flag_name # Omit this line completely if there is no flag
     annotations: # REQUIRED: Use domain namespaces for external references, and local/ for repository files
       # Examples of valid namespaces:
       local/contract: "dir:./docs/api.yaml"
       local/docs: "dir:./docs/architecture.md"
       linear.app/issue: "LIN-123"
       jira.com/ticket: "PROJ-456"
       github.com/pull-request: "42"
       gitlab.com/merge-request: "99"
       pagerduty.com/incident: "PD1234"
       sentry.io/issue: "SEN-42"
   ```
4. Only append to the `capabilities` list in the YAML file. Ensure the file remains valid YAML.
5. If the user mentions a specific ticket (e.g. Jira or Linear) in their initial request, YOU MUST include it in the `annotations` block using the format shown above.

## General Policies
- Always prioritize working solutions.
- If you create a new webhook, tool, or major component, verify if it should be tracked as a capability in the manifest before ending your task.
