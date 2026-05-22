/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * Shared document types for *.flow.yaml files.
 *
 * This module has NO VS Code, React, or Node.js imports — it describes only
 * the serialised document shape and can be safely imported by both the
 * extension host (src/) and the webview (webview-src/).
 */

// ---------------------------------------------------------------------------
// Primitive enumerations
// ---------------------------------------------------------------------------

export type OrchestrationStrategy = 'sequence' | 'cli';
export type IsolationMode = 'workspace' | 'worktree';
export type CliMode = 'supervised' | 'autonomous';
export type SubFlowPattern = 'sequence' | 'research-edit-review' | 'plan-execute-test-fix';

// ---------------------------------------------------------------------------
// Reference types
// ---------------------------------------------------------------------------

/** Skill reference: bare name resolved at runtime, or explicit relative path. */
export type ISkillRef = string | { readonly path: string };

/** Agent reference: bare name resolved at runtime, or explicit relative path. */
export type IAgentRef = string | { readonly path: string };

/**
 * Context file reference — a path (relative to the flow file or workspace root)
 * whose full contents are injected into the model as additional context.
 * Suitable for design guides, architectural principles, security guardrails, etc.
 */
export type IContextRef = string | { readonly path: string };

// ---------------------------------------------------------------------------
// Document structure
// ---------------------------------------------------------------------------

/** A role as defined in the YAML document. */
export interface IFlowRole {
	/** Display name (e.g. "Developer", "QA Engineer") */
	readonly name: string;
	/**
	 * System prompt defining the role's perspective and responsibilities.
	 * Optional when `agent` is set — the agent file body is used instead.
	 * When both are provided, `prompt` is prepended as additional context.
	 */
	readonly prompt?: string;
	/** Reference to an agent file whose body becomes (or augments) the prompt. */
	readonly agent?: IAgentRef;
	/** Static arguments substituted into `$ARGUMENTS` in the agent/skill body. */
	readonly args?: string;
	/** LLM model override for this role. */
	readonly model?: string;
	/** Skills injected into this role's prompt at execution time. */
	readonly skills?: ReadonlyArray<ISkillRef>;
	/** Context files injected into this role's prompt (merged with flow- and stage-level contexts). */
	readonly contexts?: ReadonlyArray<IContextRef>;
}

/** A stage as defined in the YAML document. */
export interface IFlowStage {
	/** Display name shown in the chat stream. */
	readonly name: string;
	/** Sub-flow execution pattern (`sequence`, `research-edit-review`, `plan-execute-test-fix`). */
	readonly subFlow: SubFlowPattern;
	/** Maximum iterations (≥ 1). When `doneWord` is also set, the stage exits early as soon
	 *  as the last role's response contains that string. If `doneWord` is not set, all
	 *  iterations always run (no early-exit). */
	readonly iterations: number;
	/**
	 * Optional stop-word / convergence sentinel. When the last role's response contains this
	 * exact string the stage exits early, regardless of how many iterations remain.
	 * Example values: `"<!-- flow:done -->"`, `"[DONE]"`, `"CONVERGED"`.
	 * If omitted, the stage always runs for the full `iterations` count.
	 */
	readonly doneWord?: string;
	/** Roles that participate in this stage. */
	readonly roles: ReadonlyArray<IFlowRole>;
	/** Skills merged with flow-level skills and injected into every role in this stage. */
	readonly skills?: ReadonlyArray<ISkillRef>;
	/** Context files merged with flow-level contexts and injected into every role in this stage. */
	readonly contexts?: ReadonlyArray<IContextRef>;
}

/** Metadata fields present in every flow document. */
export interface IFlowMetadata {
	readonly name: string;
	readonly description?: string;
	readonly category?: string;
	readonly subcategory?: string;
	readonly tags?: readonly string[];
	readonly difficulty?: 'beginner' | 'intermediate' | 'advanced';
	readonly version?: string;
	readonly author?: string;
}

/**
 * The full shape of a serialised *.flow.yaml document.
 * No VS Code, React, or Node.js dependencies.
 */
export interface IFlowDocument extends IFlowMetadata {
	readonly orchestration: OrchestrationStrategy;
	/** Flat role list (simple flows). Ignored when `stages` is present. */
	readonly roles?: ReadonlyArray<IFlowRole>;
	/** Stage-based execution. When present, top-level `roles` is ignored. */
	readonly stages?: ReadonlyArray<IFlowStage>;
	/** Skills applied to every role across the entire flow. */
	readonly skills?: ReadonlyArray<ISkillRef>;
	/** Context files applied to every role across the entire flow. */
	readonly contexts?: ReadonlyArray<IContextRef>;
	/** Global tools available to all roles (sequence mode only). */
	readonly tools?: ReadonlyArray<string>;
	/** Flow-level model selection. */
	readonly model?: string;
	// CLI-specific
	readonly isolation?: IsolationMode;
	readonly cliMode?: CliMode;
	readonly customAgent?: string;
	/** Shared context body appended below the YAML. */
	readonly sharedContext?: string;
}
