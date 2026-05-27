/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
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

export type IsolationMode = 'workspace' | 'worktree';

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

/**
 * Prompt reference — can be:
 * - Inline string (embedded prompt text)
 * - URI object: `{ uri: string }` — absolute URI or file path to a prompt file
 * - Name object: `{ name: string }` — filename searched in default Copilot prompt folders
 */
export type IPromptRef = string | { readonly uri: string } | { readonly name: string };
// ---------------------------------------------------------------------------
// Document structure
// ---------------------------------------------------------------------------

/** A role as defined in the YAML document. */
export interface IFlowRole {
	/** Display name (e.g. "Developer", "QA Engineer") */
	readonly name: string;
	/**
	 * System prompt defining the role's perspective and responsibilities.
	 * Can be an inline string, a URI reference, or a filename to search in default prompt folders.
	 * Optional when `agent` is set — the agent file body is used instead.
	 * When both are provided, `prompt` content is prepended as additional context.
	 */
	readonly prompt?: IPromptRef;
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
        /**
         * When `true`, execution is routed through `callRoleAgent()` (Copilot SDK runtime)
         * instead of `callRole()` (VS Code LM API). Orthogonal to `agent:` (content source).
         */
	readonly delegate?: boolean;
}

/** A stage as defined in the YAML document. */
export interface IFlowStage {
	/** Display name shown in the chat stream. */
	readonly name: string;
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

/**
 * A group in a parallel flow — an independent workstream with its own roles.
 * Groups run independently and their outputs are collected for the join role.
 */
export interface IFlowGroup {
	/** Display name for this group (e.g. "React Team"). */
	readonly name: string;
	/** Roles that execute sequentially within this group. */
	readonly roles: ReadonlyArray<IFlowRole>;
	/** Isolation mode for this group's background agent. */
	readonly isolation?: IsolationMode;
	/** LLM model override for all roles in this group. */
	readonly model?: string;
	/** Skills merged with flow-level skills and injected into every role in this group. */
	readonly skills?: ReadonlyArray<ISkillRef>;
	/** Context files merged with flow-level contexts and injected into every role in this group. */
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
	/** Flat role list for pipeline flows. Mutually exclusive with `stages` and `groups`. */
	readonly roles?: ReadonlyArray<IFlowRole>;
	/** Stage-based execution for iterative flows. Mutually exclusive with `roles` and `groups`. */
	readonly stages?: ReadonlyArray<IFlowStage>;
	/** Skills applied to every role across the entire flow. */
	readonly skills?: ReadonlyArray<ISkillRef>;
	/** Context files applied to every role across the entire flow. */
	readonly contexts?: ReadonlyArray<IContextRef>;
	/** Global tools available to all roles (sequence mode only). */
	readonly tools?: ReadonlyArray<string>;
	/** Flow-level model selection. */
	readonly model?: string;
	/** Groups for parallel orchestration (fork-join pattern). Required when `orchestration` is `parallel`. */
	readonly groups?: ReadonlyArray<IFlowGroup>;
	/** Join role executed after all groups complete. Required when `orchestration` is `parallel`. */
	readonly join?: IFlowRole;
	readonly customAgent?: string;
	/** Shared context body appended below the YAML. */
	readonly sharedContext?: string;
}
