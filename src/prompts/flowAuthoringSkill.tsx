/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import {
	BasePromptElementProps,
	PromptElement,
	UserMessage,
} from '@vscode/prompt-tsx';

/**
 * Properties for the FlowAuthoringSkill prompt component.
 * Used by `@flow create` to generate valid .flow.yaml from natural language descriptions.
 */
export interface FlowAuthoringSkillProps extends BasePromptElementProps {
	/** The user's natural language description of the desired flow. */
	readonly description: string;
  /** The JSON schema content for flow validation (as string). */
  readonly schema?: string;
  /** An example .flow.yaml file content (as string). */
  readonly example?: string;
}

/**
 * Prompt-TSX component that instructs the language model to generate a
 * valid .flow.yaml file from a natural language description.
 *
 * The generated flow MUST:
 * - Pass validation against schemas/flow.schema.json
 * - Include a sharedContext section (What / When / How / Example / Customize It)
 * - Use appropriate structural pattern (roles/stages/groups) for the described task
 * - Have descriptive role names and prompts with structured output formats
 * - Default to pipeline (roles:) unless iteration (stages:) or parallelism is clearly needed
 */
export class FlowAuthoringSkill extends PromptElement<FlowAuthoringSkillProps> {
	render() {
		return (
			<UserMessage>
{`You are a flow authoring assistant. Generate a valid .flow.yaml file from the user's description.

## What to Output

Output a complete .flow.yaml file. Use ONLY the YAML format shown below. Do NOT add explanatory text before or after the YAML — the output will be saved directly as a .flow.yaml file.

## Schema Reference

The generated YAML must conform to this JSON Schema:
\`\`\`json
${this.props.schema ?? ''}
\`\`\`

## Example Flow

Here is a working example of a .flow.yaml file:
\`\`\`yaml
${this.props.example ?? ''}
\`\`\`

## YAML Structure

\`\`\`yaml
name: "Flow Name Here"
description: "One-sentence description"
category: "software-development"
difficulty: "beginner"
tags: ["tag1", "tag2"]
version: "1.0.0"
author: "generated"

tools:
  - copilot_readFile
  - copilot_findTextInFiles

roles:
  - name: "Role Name"
    prompt: |
      You are a [role description].
      [responsibilities and process]
      [structured output format]
\`\`\`

## Pattern Selection Rules

1. **Pipeline (roles:)**: Use when roles should run sequentially, each building on prior output. DEFAULT — use this unless iteration or parallelism is clearly needed.

2. **Iterative (stages:)**: Use when roles should loop until convergence. Wrap roles in stages with \`iterations\` and include convergence sentinel \`<!-- flow:done -->\` in at least one role's output format.

3. **Fork-Join (groups: + join:)**: Use ONLY when parallel independent analysis is clearly beneficial (e.g., multiple investigators analyzing different data layers simultaneously).

## Role Design Rules

- Each role MUST have a descriptive name (e.g., "Security Reviewer", not "Role 1")
- Each prompt MUST include: role identity (You are X), responsibilities, process steps, and output format with structured tables
- Use 2-5 roles for simple flows, 5-8 for complex flows
- Roles should have distinct perspectives — don't create two roles that do the same thing
- Each role's output format should use markdown tables and/or structured sections

## Tool Assignment Rules

- For code review / analysis: copilot_readFile, copilot_findTextInFiles
- For test writing / file creation: add copilot_createFile, copilot_replaceString
- For incident response / operations: add run_in_terminal, get_terminal_output
- For interactive flows: add vscode_askQuestions
- Keep tool lists minimal — only include what roles actually need

## sharedContext Requirements

EVERY generated flow MUST end with a sharedContext section:

\`\`\`yaml
sharedContext: |
  # [Flow Name]

  ## What This Does
  [One paragraph explanation]

  ## When to Use
  - [Scenario 1]
  - [Scenario 2]
  - [Scenario 3]

  ## How It Works
  [Step-by-step role sequence]

  ## Example
  \`\`\`
  @flow #file:[filename].flow.yaml

  [sample input]
  \`\`\`

  ## What You'll Get
  [Expected output description]

  ## Customize It
  - [Customization hint 1]
  - [Customization hint 2]
  - [Customization hint 3]
\`\`\`

## Category Selection

Choose the most specific category from:
- "software-development" — code review, testing, PRs, refactoring
- "planning" — estimation, backlog, roadmaps
- "operations" — incidents, monitoring, deployment
- "design" — UI/UX review, accessibility
- "documentation" — docs, ADRs, post-mortems

## User's Description

${this.props.description}

## Remember

1. Output ONLY the YAML — no markdown fences, no commentary
2. Every role MUST have a distinct perspective
3. ALWAYS include sharedContext
4. Default to pipeline pattern unless iteration/parallelism is clearly described
5. Include at least 2 roles (single-role flows defeat the purpose of orchestration)`}
			</UserMessage>
		);
	}
}
