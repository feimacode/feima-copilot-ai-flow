---
title: Tool Integration
description: MCP setup patterns, Jira/GitHub integration examples, and tool inheritance
---

## Tool Configuration

Tools are declared at the flow level (available to all roles) or per-role:

```yaml
# Flow-level — every role can use these
tools:
  - copilot_readFile
  - copilot_findTextInFiles

roles:
  - name: Code Writer
    tools:
      - copilot_createFile     # only this role can create files
      - copilot_replaceString  # only this role can edit files
```

Use `"*"` to grant all available VS Code tools.

## Common Integration Patterns

### Jira / Issue Tracker

```yaml
tools:
  - copilot_readFile
  - jira_get_issue
  - jira_create_issue
  - jira_search_issues

roles:
  - name: Estimator
    prompt: |
      After synthesizing estimates, format the output for Jira ticket creation.
      Include: summary, description, story points, labels, confidence level.
  - name: Jira Publisher
    prompt: |
      Create Jira tickets from the estimation output.
      For each story, create a ticket with the estimate and rationale.
```

### GitHub / GitLab

```yaml
tools:
  - copilot_readFile
  - gh_pr_create
  - gh_pr_comment

roles:
  - name: PR Writer
    prompt: |
      After composing the PR description, create the PR with:
      - Title from the description
      - Body from the full markdown
      - Labels based on change type (bug, feature, refactor)
```

### Slack / Notifications

Use `run_in_terminal` or a webhook tool to post summaries:

```yaml
tools:
  - run_in_terminal

roles:
  - name: Notifier
    prompt: |
      After the review completes, post a summary to Slack:
      
      curl -X POST https://hooks.slack.com/services/... \
        -H 'Content-Type: application/json' \
        -d '{"text": "Code review complete: 3 critical, 5 high, 2 medium issues found"}'
```

## Tool Inheritance

Tools declared at the flow level are inherited by all roles. Role-level tools are additive:

```yaml
tools:
  - copilot_readFile          # all roles can read files

roles:
  - name: Analyst
    # inherits copilot_readFile only

  - name: Implementer
    tools:
      - copilot_createFile    # inherits copilot_readFile + gets createFile
```

## MCP Servers

Configure MCP servers in VS Code settings, then reference their tools in flows:

```json
// .vscode/settings.json
{
  "mcp.servers": {
    "jira": {
      "command": "npx",
      "args": ["-y", "@anthropic/jira-mcp-server"]
    }
  }
}
```

Tools from configured MCP servers become available in the flow's tool list.
