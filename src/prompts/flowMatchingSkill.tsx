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
 * Properties for the FlowMatchingSkill prompt component.
 * Used by `@flow` to match a freeform user prompt to the best workspace flow.
 */
export interface FlowMatchingSkillProps extends BasePromptElementProps {
	/** The user's natural language request (full prompt). */
	readonly prompt: string;
	/** JSON array of available workspace flows with id, name, description, tags, category, orchestration. */
	readonly flows: string;
}

/**
 * Prompt-TSX component that instructs the language model to match a user's
 * natural language request to the most relevant workspace flow(s).
 *
 * The model MUST return a JSON array of match objects, each with:
 * - `id`: the flow id
 * - `score`: 0.0–1.0 confidence
 * - `reasoning`: one sentence explaining why
 *
 * High scores (≥ 0.8) mean the flow is a strong match for the request.
 * Low scores (< 0.5) mean it's only loosely related.
 * If no flow is relevant at all, return an empty array `[]`.
 */
export class FlowMatchingSkill extends PromptElement<FlowMatchingSkillProps> {
	render() {
		return (
			<UserMessage>
{`You are a flow matching assistant. Match the user's request to the most relevant flow(s) from the list below.

## Instructions

1. Read the user's request carefully — what task do they want to accomplish?
2. Compare it against every flow's **sharedContext** (the MOST important signal — it describes what the flow does, when to use it, how it works, and expected output), name, description, tags, category, and orchestration pattern.
3. Give the highest weight to \`sharedContext\` — if the user's request aligns with the flow's documented purpose and use cases, score it highly even if the name or tags don't directly match.
4. Assign a confidence score (0.0–1.0) for each flow:
   - 0.9–1.0: The flow was literally built for this exact task (name/description strongly aligns)
   - 0.7–0.89: The flow covers a related domain and could likely handle this request
   - 0.5–0.69: The flow is tangentially related but may not be ideal
   - 0.0–0.49: The flow is unrelated or only matches a minor keyword
4. Return matches sorted by score descending. Only include flows with score ≥ 0.5.
5. If NO flow is even remotely relevant, return an empty array [].

## Output Format

Return ONLY a JSON array — no markdown fences, no commentary, no other text:

[
  {"id": "flow-id-1", "score": 0.9, "reasoning": "This flow is specifically designed for code review with security and style lenses."},
  {"id": "flow-id-2", "score": 0.6, "reasoning": "This flow handles general code quality but lacks the security focus requested."}
]

## Available Flows

${this.props.flows}

## User's Request

${this.props.prompt}

## Remember

- Output ONLY the JSON array — no markdown fences, no commentary
- Return valid JSON (double quotes, no trailing commas)
- Sort by score descending
- Only include flows with score ≥ 0.5
- If nothing matches, output []`}
			</UserMessage>
		);
	}
}
