/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react';
import type { Node } from '@xyflow/react';
import type { MetaNodeData, RoleNodeData, StageNodeData } from '../../shared/serialize';

// ---------------------------------------------------------------------------
// MetaForm — all flow metadata fields
// ---------------------------------------------------------------------------

function MetaForm({ d }: { d: MetaNodeData }) {
	// Sync comma-string inputs with external node data changes (same pattern as old MetaNode).
	const tagsStr = (d.tags ?? []).join(', ');
	const toolsStr = (d.tools ?? []).join(', ');
	const [tagsInput, setTagsInput] = useState(tagsStr);
	const [toolsInput, setToolsInput] = useState(toolsStr);
	useEffect(() => { setTagsInput(tagsStr); }, [tagsStr]);
	useEffect(() => { setToolsInput(toolsStr); }, [toolsStr]);

	return (
		<>
			<label>
				Name
				<input
					value={d.name}
					onChange={e => d.onChange({ name: e.target.value })}
					placeholder="Flow name"
				/>
			</label>

			<label>
				Description
				<textarea
					value={d.description}
					onChange={e => d.onChange({ description: e.target.value })}
					rows={3}
					placeholder="What does this flow do?"
				/>
			</label>

			<div className="row">
				<label>
					Orchestration
					<select
						value={d.orchestration}
						onChange={e => d.onChange({ orchestration: e.target.value as 'sequence' | 'cli' })}
					>
						<option value="sequence">sequence</option>
						<option value="cli">cli</option>
					</select>
				</label>
				<label>
					Difficulty
					<select
						value={d.difficulty}
						onChange={e => d.onChange({ difficulty: e.target.value })}
					>
						<option value="">—</option>
						<option value="beginner">beginner</option>
						<option value="intermediate">intermediate</option>
						<option value="advanced">advanced</option>
					</select>
				</label>
			</div>

			<label>
				Category
				<input
					value={d.category}
					onChange={e => d.onChange({ category: e.target.value })}
					placeholder="e.g. software-development"
				/>
			</label>

			<label>
				Tags <span className="hint">(comma-separated)</span>
				<input
					value={tagsInput}
					onChange={e => {
						setTagsInput(e.target.value);
						d.onChange({ tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) });
					}}
					placeholder="tag1, tag2"
				/>
			</label>

			<label>
				Model <span className="hint">(leave blank for default)</span>
				<input
					value={d.model}
					onChange={e => d.onChange({ model: e.target.value })}
					placeholder="e.g. claude-sonnet-4.5"
				/>
			</label>

			<label>
				Tools <span className="hint">(comma-separated, or * for all)</span>
				<input
					value={toolsInput}
					onChange={e => {
						setToolsInput(e.target.value);
						d.onChange({ tools: e.target.value.split(',').map(t => t.trim()).filter(Boolean) });
					}}
					placeholder="copilot_readFile, copilot_listDirectory"
				/>
			</label>

			<div className="row">
				<label>
					Author
					<input
						value={d.author}
						onChange={e => d.onChange({ author: e.target.value })}
					/>
				</label>
				<label>
					Version
					<input
						value={d.version}
						onChange={e => d.onChange({ version: e.target.value })}
						placeholder="1.0.0"
					/>
				</label>
			</div>

			{d.orchestration === 'cli' && (
				<>
					<div className="row">
						<label>
							CLI Mode
							<select
								value={d.cliMode}
								onChange={e => d.onChange({ cliMode: e.target.value })}
							>
								<option value="">—</option>
								<option value="supervised">supervised</option>
								<option value="autonomous">autonomous</option>
							</select>
						</label>
						<label>
							Isolation
							<select
								value={d.isolation}
								onChange={e => d.onChange({ isolation: e.target.value })}
							>
								<option value="">—</option>
								<option value="workspace">workspace</option>
								<option value="worktree">worktree</option>
							</select>
						</label>
					</div>
					<label>
						Custom Agent
						<input
							value={d.customAgent}
							onChange={e => d.onChange({ customAgent: e.target.value })}
							placeholder="___vscode_default___"
						/>
					</label>
				</>
			)}
		</>
	);
}

// ---------------------------------------------------------------------------
// RoleForm — role name, system prompt, model override
// ---------------------------------------------------------------------------

function RoleForm({ d }: { d: RoleNodeData }) {
	return (
		<>
			<label>
				Name
				<input
					value={d.name}
					onChange={e => d.onChange({ name: e.target.value })}
					placeholder="e.g. Architect, QA Engineer"
				/>
			</label>

			<label>
				System Prompt
				<textarea
					value={d.prompt}
					onChange={e => d.onChange({ prompt: e.target.value })}
					rows={12}
					placeholder="Define the role's perspective, responsibilities, and output format..."
				/>
			</label>

			<label>
				Model override <span className="hint">(leave blank for default)</span>
				<input
					value={d.model}
					onChange={e => d.onChange({ model: e.target.value })}
					placeholder="e.g. claude-sonnet-4.5"
				/>
			</label>
		</>
	);
}

// ---------------------------------------------------------------------------
// NodeDialog — floating dialog shell
// ---------------------------------------------------------------------------

interface NodeDialogProps {
	nodeId: string;
	nodes: Node[];
	onClose: () => void;
}

export function NodeDialog({ nodeId, nodes, onClose }: NodeDialogProps) {
	const node = nodes.find(n => n.id === nodeId);

	// Close on Escape.
	useEffect(() => {
		const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { onClose(); } };
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [onClose]);

	if (!node) { return null; }

	let title: string;
	if (node.type === 'metaNode') {
		title = 'Flow Settings';
	} else if (node.type === 'roleNode') {
		const d = node.data as RoleNodeData;
		title = `Role ${d.index + 1}: ${d.name || 'Unnamed Role'}`;
	} else {
		const d = node.data as StageNodeData;
		title = `Stage: ${d.stageName}`;
	}

	return (
		<div className="dialog-backdrop" onClick={onClose}>
			<div className="dialog-flow" onClick={e => e.stopPropagation()}>
				<div className="dialog-header">
					<span className="dialog-title">{title}</span>
					<button className="dialog-close" onClick={onClose} aria-label="Close dialog">✕</button>
				</div>
				<div className="dialog-body">
					{node.type === 'metaNode' && <MetaForm d={node.data as MetaNodeData} />}
					{node.type === 'roleNode' && <RoleForm d={node.data as RoleNodeData} />}
					{node.type === 'stageNode' && (
						<p className="stage-readonly-hint">
							Stage structure is defined in the YAML source. Use{' '}
							<strong>Edit Source</strong> to modify stages.
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
