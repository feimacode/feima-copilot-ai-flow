/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Node } from '@xyflow/react';
import type { MetaNodeData, RoleNodeData, StageNodeData } from '../../shared/serialize';

// ---------------------------------------------------------------------------
// MetaForm — all flow metadata fields
// ---------------------------------------------------------------------------

function MetaForm({ d }: { d: MetaNodeData }) {
	// Sync comma-string inputs with draft changes.
	const tagsStr = (d.tags ?? []).join(', ');
	const toolsStr = (d.tools ?? []).join(', ');
	const [tagsInput, setTagsInput] = useState(tagsStr);
	const [toolsInput, setToolsInput] = useState(toolsStr);
	const prevTags = useRef(tagsStr);
	const prevTools = useRef(toolsStr);
	if (prevTags.current !== tagsStr) { prevTags.current = tagsStr; }
	if (prevTools.current !== toolsStr) { prevTools.current = toolsStr; }
	useEffect(() => { setTagsInput(prevTags.current); }, [prevTags.current]);
	useEffect(() => { setToolsInput(prevTools.current); }, [prevTools.current]);

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

			<label>
				Shared Context
				<textarea
					value={d.sharedContext}
					onChange={e => d.onChange({ sharedContext: e.target.value })}
					rows={4}
					placeholder="Instructions or context shared by all roles..."
				/>
			</label>

			<div className="row">
				<label>
					Orchestration
					<select
						value={(d as any).orchestration}
						onChange={e => d.onChange({ orchestration: e.target.value as any })}
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

			{(d as any).orchestration === 'cli' && (
				<>
					<div className="row">
						<label>
							CLI Mode
							<select
								value={(d as any).cliMode}
								onChange={e => d.onChange({ cliMode: e.target.value } as any)}
							>
								<option value="">—</option>
								<option value="supervised">supervised</option>
								<option value="autonomous">autonomous</option>
							</select>
						</label>
						<label>
							Isolation
							<select
								value={(d as any).isolation}
								onChange={e => d.onChange({ isolation: e.target.value } as any)}
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
					rows={16}
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
// StageForm — stage name and iterations
// ---------------------------------------------------------------------------

function StageForm({ d }: { d: StageNodeData }) {
	return (
		<>
			<label>
				Name
				<input
					value={d.stageName}
					onChange={e => d.onChange({ stageName: e.target.value })}
					placeholder="e.g. Planning, Review"
				/>
			</label>

			<label>
				Iterations
				<input
					type="number"
					min={1}
					max={99}
					value={d.iterations}
					onChange={e => {
						const v = Math.max(1, parseInt(e.target.value, 10) || 1);
						d.onChange({ iterations: v });
					}}
				/>
				<span className="hint">Number of times to loop this stage's roles</span>
			</label>
		</>
	);
}

// ---------------------------------------------------------------------------
// NodeDialog — floating dialog with Save / Discard
// ---------------------------------------------------------------------------

interface NodeDialogProps {
	nodeId: string;
	nodes: Node[];
	onClose: () => void;
}

export function NodeDialog({ nodeId, nodes, onClose }: NodeDialogProps) {
	const node = nodes.find(n => n.id === nodeId);

	// Snapshot the live node data when the dialog first opens. We will edit
	// a local draft and only flush it back on Save — onClose discards.
	const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
	useEffect(() => {
		if (node) {
			const { onChange, onEdit, onDelete, ...rest } = node.data as any;
			setDraft({ ...rest });
		}
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	const updateDraft = useCallback((patch: Record<string, unknown>) => {
		setDraft(prev => prev ? { ...prev, ...patch } : null);
	}, []);

	// Proxy data object that looks like the real node data but writes to draft.
	const draftData = useMemo(() => {
		if (!draft) { return null; }
		return {
			...draft,
			onChange: (patch: Record<string, unknown>) => updateDraft(patch),
			onEdit: () => { },
			onDelete: () => { },
		};
	}, [draft, updateDraft]);

	const handleSave = useCallback(() => {
		if (!node || !draft) { return; }
		// Flush entire draft to the real node — the onChange callback in App
		// does `{ ...prev, ...patch }` so passing the full state replaces all.
		const nodeData = node.data as Record<string, unknown>;
		if (typeof nodeData.onChange === 'function') {
			nodeData.onChange(draft);
		}
		onClose();
	}, [node, draft, onClose]);

	// Close on Escape.
	useEffect(() => {
		const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { onClose(); } };
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [onClose]);

	if (!node || !draftData) { return null; }

	let title: string;
	let FormComponent: React.FC<{ d: any }> | null = null;
	const formProps = { d: draftData };

	if (node.type === 'metaNode') {
		title = 'Flow Settings';
		FormComponent = MetaForm;
	} else if (node.type === 'roleNode') {
		const d = node.data as RoleNodeData;
		title = `Role ${d.index + 1}: ${d.name || 'Unnamed Role'}`;
		FormComponent = RoleForm;
	} else if (node.type === 'stageNode') {
		title = `Stage: ${(node.data as StageNodeData).stageName}`;
		FormComponent = StageForm;
	} else {
		title = 'Unknown Node';
	}

	return (
		<div className="dialog-backdrop" onClick={onClose}>
			<div className="dialog-flow dialog-flow-lg" onClick={e => e.stopPropagation()}>
				<div className="dialog-header">
					<span className="dialog-title">{title}</span>
					<button className="dialog-close" onClick={onClose} aria-label="Discard changes">✕</button>
				</div>
				<div className="dialog-body">
					{FormComponent && <FormComponent {...formProps} />}
				</div>
				{FormComponent && (
					<div className="dialog-footer">
						<button className="dialog-btn dialog-btn-secondary" onClick={onClose}>Discard</button>
						<button className="dialog-btn dialog-btn-primary" onClick={handleSave}>Save</button>
					</div>
				)}
			</div>
		</div>
	);
}

