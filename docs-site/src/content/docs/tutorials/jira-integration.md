---
title: Connect to Jira
description: Extend a flow to create Jira tickets from its output
---

## What You'll Build

Extend the story estimation flow to automatically create estimated stories in your Jira backlog with confidence levels and risk factors.

## Prerequisites

- A Jira MCP server configured (if using MCP tools)
- The `story-estimation.flow.yaml` installed in `.github/flows/`

## Step 1: Enhance the Flow

```
@flow /enhance story-estimation.flow.yaml --add-jira-integration
```

The AI reads the existing flow, understands the Estimator + Splitter role's output format, and adds:

- Jira tool access (`jira_create_issue` or equivalent)
- A new "Jira Publisher" role that creates tickets from estimation output
- Updated tool lists to include Jira tools

## Step 2: Review the Enhanced Flow

Open `.github/flows/story-estimation.flow.yaml` and verify:

1. The Estimator + Splitter role's output format includes Jira-compatible fields (summary, description, story points, labels)
2. The new Jira Publisher role maps estimation output to Jira ticket structure
3. Tool configuration includes Jira-related tools

## Step 3: Run the Enhanced Flow

```
@flow #file:.github/flows/story-estimation.flow.yaml

Story: Add user authentication with JWT tokens
- Login endpoint with email/password
- Token validation middleware
- Refresh token rotation
- Logout functionality
```

The virtual scrum team estimates the story, then the Jira Publisher creates a ticket with the estimate, confidence level, and risk factors.

<a href="vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2Fstory-estimation.flow.yaml%0A%0AStory%3A%20Add%20user%20authentication%20with%20JWT">🚀 Run in Copilot</a>

## What You Got

- Multi-role estimation (Product Owner, Dev Lead, QA Lead, Senior Dev, Senior QA, Dev, QA)
- Jira ticket auto-creation with estimates, confidence levels, and risk factors
- Zero manual data entry between estimation and ticket creation

## Customize Further

- **Slack notification**: Add a `send_to_terminal` or webhook role that posts a summary to Slack
- **GitHub Issues**: Replace Jira tools with GitHub Issues API (same pattern, different tool)
- **Estimation history**: Add a context file that tracks past estimates for velocity calibration

## Next Steps

Add [staged iteration](/tutorials/staged-iteration/) so the team can loop until consensus on tricky stories.
