/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
	ReactFlow,
	Background,
	Controls,
	MiniMap,
	Panel,
	applyNodeChanges,
	applyEdgeChanges,
	useReactFlow,
	type Node,
	type Edge,
	type NodeChange,
	type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { RoleNode } from './nodes/RoleNode';
import { StageNode } from './nodes/StageNode';
import { NodeDialog } from './nodes/NodeDialog';
import { parseFlowDoc, serializeFlowDoc } from '../shared/serialize';
import type { MetaNodeData, RoleNodeData, StageMeta } from '../shared/serialize';

// acquireVsCodeApi is injected into the webview context by VS Code.
declare function acquireVsCodeApi(): {
	postMessage(msg: unknown): void;
	getState(): unknown;
	setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

const nodeTypes = {
	roleNode: RoleNode,
	stageNode: StageNode,
};

// ---------------------------------------------------------------------------
// Attach live callbacks to parsed nodes
// ---------------------------------------------------------------------------

/**
 * Replace the noop onChange / onDelete / onEdit placeholders from parseFlowDoc
 * with actual state-mutating callbacks.
 *
 * Fix #1: onDelete now also calls setEdges to clean up orphan edges and
 * reconnect the predecessor → successor chain.
 * Fix #7: direct scheduleSerialize() calls removed from callbacks; the
 * useEffect([nodes]) in App handles serialization, avoiding double-triggers.
 */
function withCallbacks(
	node: Node,
	setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
	setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
	setEditingNodeId: React.Dispatch<React.SetStateAction<string | null>>,
	isDirtyRef: React.MutableRefObject<boolean>,
): Node {
	if (node.type === 'metaNode') {
		return {
			...node,
			data: {
				...node.data,
				onChange(patch: Partial<MetaNodeData>) {
					isDirtyRef.current = true;
					setNodes(prev =>
						prev.map(n => n.id === 'meta' ? { ...n, data: { ...n.data, ...patch } } : n)
					);
				},
				onEdit() {
					setEditingNodeId('meta');
				},
			},
		};
	}

	if (node.type === 'roleNode') {
		return {
			...node,
			data: {
				...node.data,
				onChange(patch: Partial<RoleNodeData>) {
					isDirtyRef.current = true;
					setNodes(prev =>
						prev.map(n => n.id === node.id ? { ...n, data: { ...n.data, ...patch } } : n)
					);
				},
				onDelete() {
					isDirtyRef.current = true;
					// Reconnect predecessor → successor before removing this node.
					setEdges(prev => {
						const incoming = prev.find(e => e.target === node.id);
						const outgoing = prev.find(e => e.source === node.id);
						const filtered = prev.filter(e => e.source !== node.id && e.target !== node.id);
						if (incoming && outgoing) {
							filtered.push({
								id: `edge-${incoming.source}-${outgoing.target}`,
								source: incoming.source,
								target: outgoing.target,
								animated: true,
							});
						}
						return filtered;
					});
					setNodes(prev => {
						const filtered = prev.filter(n => n.id !== node.id);
						let roleIdx = 0;
						return filtered.map(n =>
							n.type === 'roleNode' ? { ...n, data: { ...n.data, index: roleIdx++ } } : n
						);
					});
				},
				onEdit() {
					setEditingNodeId(node.id);
				},
			},
		};
	}

	return node;
}

// ---------------------------------------------------------------------------
// FitViewOnLoad — auto-fits the viewport when nodes first appear
// ---------------------------------------------------------------------------

/**
 * Rendered as a child of <ReactFlow> (so useReactFlow context is available).
 * Triggers fitView exactly once: when nodes transition from zero to non-zero.
 */
function FitViewOnLoad({ nodeCount }: { nodeCount: number }) {
	const { fitView } = useReactFlow();
	const prevCountRef = useRef(0);

	useEffect(() => {
		if (nodeCount > 0 && prevCountRef.current === 0) {
			const id = setTimeout(() => fitView({ padding: 0.15 }), 80);
			prevCountRef.current = nodeCount;
			return () => clearTimeout(id);
		}
		prevCountRef.current = nodeCount;
	}, [nodeCount, fitView]);

	return null;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App() {
	const [nodes, setNodes] = useState<Node[]>([]);
	const [edges, setEdges] = useState<Edge[]>([]);
	const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

	const nodesRef = useRef<Node[]>([]);
	const rawBodyRef = useRef('');
	/** Stage metadata preserved for round-trip serialization of stage-based flows. */
	const stageMetaRef = useRef<StageMeta[] | undefined>(undefined);
	/**
	 * Fix #4: Persists finalized drag positions by node ID so they survive
	 * incoming text-document updates. Entries for nodes that no longer exist
	 * are evicted when an `update` message arrives.
	 */
	const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
	const serializeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	/**
	 * True only after a genuine user mutation (data edit, role delete, role add, drag-end).
	 * Set to false when we receive an `update` from the extension host, and after
	 * scheduleSerialize fires. Guards the nodes-change effect from triggering on
	 * React-Flow-internal updates (e.g. dimension measurements on initial render).
	 */
	const isDirtyRef = useRef(false);
	/** Last YAML content received from (or sent to) the extension host. Used to
	 * suppress no-op `change` messages so the document is never marked dirty when
	 * nothing serializable actually changed (e.g. node drag with no YAML impact). */
	const lastReceivedContentRef = useRef('');

	useEffect(() => { nodesRef.current = nodes; }, [nodes]);

	// Debounced serialize: reads from refs so it always has the latest values.
	const scheduleSerialize = useCallback(() => {
		if (serializeTimerRef.current) { clearTimeout(serializeTimerRef.current); }
		serializeTimerRef.current = setTimeout(() => {
			// Reset dirty flag before serializing so subsequent React Flow internal
			// updates (e.g. dimension re-measurements) don't re-trigger this path.
			isDirtyRef.current = false;
			const content = serializeFlowDoc(nodesRef.current, rawBodyRef.current, stageMetaRef.current);
			// Only post if the YAML actually changed from what we last received/sent.
			// This prevents marking the document dirty for canvas-only changes such
			// as node position drags that have no YAML representation.
			if (content === lastReceivedContentRef.current) { return; }
			lastReceivedContentRef.current = content;
			vscode.postMessage({ type: 'change', content });
		}, 600);
	}, []);

	const buildNodes = useCallback(
		(rawNodes: Node[]) => rawNodes.map(n => withCallbacks(n, setNodes, setEdges, setEditingNodeId, isDirtyRef)),
		// setNodes, setEdges, setEditingNodeId, and isDirtyRef are all stable refs — safe to omit.
		[] // eslint-disable-line -- react-hooks/exhaustive-deps plugin not installed
	);

	// Handle messages from the extension host.
	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const msg = event.data as { type: string; content: string };
			if (msg.type !== 'update') { return; }

			const { nodes: raw, edges: rawEdges, rawBody, stageMeta } = parseFlowDoc(msg.content);
			rawBodyRef.current = rawBody;
			stageMetaRef.current = stageMeta;
			// Receiving an update from the host means the document is in sync — clear
			// dirty and record the canonical content to detect future real changes.
			isDirtyRef.current = false;
			lastReceivedContentRef.current = msg.content;

			// Evict positions for nodes that no longer exist, then merge saved
			// drag positions back into the freshly-parsed node list.
			const newIds = new Set(raw.map(n => n.id));
			for (const id of positionsRef.current.keys()) {
				if (!newIds.has(id)) { positionsRef.current.delete(id); }
			}
			const nodesWithPos = raw.map(n => ({
				...n,
				position: positionsRef.current.get(n.id) ?? n.position,
			}));

			setNodes(buildNodes(nodesWithPos));
			setEdges(rawEdges);
		};

		window.addEventListener('message', handler);
		vscode.postMessage({ type: 'ready' });
		return () => window.removeEventListener('message', handler);
	}, [buildNodes]);

	// Serialize when nodes change AND the change was user-initiated (isDirtyRef=true).
	// React Flow fires internal changes (dimension measurements, etc.) that must not
	// trigger serialization — isDirtyRef stays false for those.
	useEffect(() => {
		if (!isDirtyRef.current) { return; }
		if (nodes.length > 0) {
			scheduleSerialize();
		}
	}, [nodes, scheduleSerialize]);

	const onNodesChange = useCallback((changes: NodeChange[]) => {
		for (const c of changes) {
			if (c.type === 'position' && c.position && !c.dragging) {
				// Drag-end: persist position AND mark dirty.
				// (Mid-drag and dimension-only changes are React Flow internals and
				// should not mark the document dirty.)
				positionsRef.current.set(c.id, c.position);
				isDirtyRef.current = true;
			}
		}
		setNodes(prev => applyNodeChanges(changes, prev));
	}, []);

	const onEdgesChange = useCallback((changes: EdgeChange[]) => {
		setEdges(prev => applyEdgeChanges(changes, prev));
	}, []);

	const addRole = useCallback(() => {
		const newId = `role-${Date.now()}`;
		isDirtyRef.current = true;

		// Fix #8: compute new node and edge in the same logical batch.
		setNodes(prev => {
			const roleNodes = prev
				.filter(n => n.type === 'roleNode')
				.sort((a, b) => a.position.y - b.position.y);
			const newIdx = roleNodes.length;
			const lastY = roleNodes.length > 0 ? roleNodes[roleNodes.length - 1].position.y : 280;

			const newRaw: Node = {
				id: newId,
				type: 'roleNode',
				position: { x: 300, y: lastY + 240 },
				data: {
					name: `Role ${newIdx + 1}`,
					prompt: '',
					model: '',
					index: newIdx,
					onChange: () => {},
					onDelete: () => {},
					onEdit: () => {},
				} as RoleNodeData,
			};
			return buildNodes([...prev, newRaw]);
		});

		setEdges(prev => {
			const allTargets = new Set(prev.map(e => e.target));
			const leafSource = [...prev.map(e => e.source)]
				.filter(s => !allTargets.has(s))
				.pop() ?? 'meta';
			return [
				...prev,
				{ id: `edge-${leafSource}-${newId}`, source: leafSource, target: newId, animated: true },
			];
		});

		// Fix #2: extend the last stage when the panel uses stages.
		if (stageMetaRef.current) {
			const stages = stageMetaRef.current;
			const last = stages[stages.length - 1];
			stageMetaRef.current = [
				...stages.slice(0, -1),
				{ ...last, roleCount: last.roleCount + 1 },
			];
		}
	}, [buildNodes]);

	const metaData = nodes.find(n => n.id === 'meta')?.data as MetaNodeData | undefined;
	const flowNodes = nodes.filter(n => n.id !== 'meta');
	const flowEdges = edges.filter(e => e.source !== 'meta' && e.target !== 'meta');
	const isEmpty = flowNodes.length === 0;

	return (
		<div className="app-root">
			<div className="toolbar">
				<span className="toolbar-title">Flow Editor</span>
				<button className="toolbar-btn" onClick={addRole}>+ Add Role</button>
				<button
					className="toolbar-btn secondary"
					onClick={() => vscode.postMessage({ type: 'openTextEditor' })}
					title="Open the raw YAML source in a side-by-side text editor"
				>
					Edit Source
				</button>
			</div>

			<div className="canvas-area">
				{isEmpty ? (
					<div className="empty-state">
						<p>No flow configuration found in this file.</p>
						<p>Click <strong>Edit Source</strong> to add YAML, or use
							<code> @flow #file:&lt;template&gt;</code> to create one from a template.</p>
					</div>
				) : (
					<ReactFlow
						nodes={flowNodes}
						edges={flowEdges}
						onNodesChange={onNodesChange}
						onEdgesChange={onEdgesChange}
						nodeTypes={nodeTypes}
						fitView
						minZoom={0.2}
						maxZoom={2}
					>
						{metaData && (
							<Panel position="top-left" style={{ margin: '12px' }}>
								<div className="canvas-meta-flow">
									<div className="canvas-meta-header">
										<span className="canvas-meta-name">{metaData.name || 'Untitled Flow'}</span>
										<button
											className="icon-btn edit-btn"
											onClick={() => setEditingNodeId('meta')}
											title="Edit flow metadata"
										>\u270e</button>
									</div>
									{metaData.description && (
										<div className="canvas-meta-desc">{metaData.description}</div>
									)}
								</div>
							</Panel>
						)}
						<FitViewOnLoad nodeCount={flowNodes.length} />
						<Background gap={20} />
						<Controls />
						<MiniMap nodeColor={() => 'var(--vscode-editor-inactiveSelectionBackground, #3a3d41)'} />
					</ReactFlow>
				)}
				{editingNodeId && (
					<NodeDialog
						nodeId={editingNodeId}
						nodes={nodes}
						onClose={() => setEditingNodeId(null)}
					/>
				)}
			</div>
		</div>
	);
}

