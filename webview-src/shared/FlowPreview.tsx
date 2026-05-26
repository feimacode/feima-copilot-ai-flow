/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React, { useMemo } from 'react';
import {
	ReactFlow,
	Background,
	type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { parseFlowDoc } from './serialize';

// Lightweight read-only node renderers — no edit/delete controls.
import { PreviewRoleNode } from './PreviewRoleNode';
import { PreviewStageNode } from './PreviewStageNode';

const nodeTypes: NodeTypes = {
	roleNode: PreviewRoleNode,
	stageNode: PreviewStageNode,
	metaNode: PreviewRoleNode, // reuse compact style for the meta node in preview
};

interface FlowPreviewProps {
	/** Raw YAML content of a *.flow.yaml file. */
	yaml: string;
	/** Height of the preview canvas in px. Default 180. */
	height?: number;
}

/**
 * Read-only mini React Flow canvas for gallery previews.
 * Parses the YAML and renders nodes with all interaction disabled.
 */
export function FlowPreview({ yaml, height = 180 }: FlowPreviewProps) {
	const { nodes, edges } = useMemo(() => {
		try {
			const result = parseFlowDoc(yaml);
			return { nodes: result.nodes, edges: result.edges };
		} catch {
			return { nodes: [], edges: [] };
		}
	}, [yaml]);

	if (nodes.length === 0) {
		return (
			<div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, fontSize: 11 }}>
				No preview available
			</div>
		);
	}

	return (
		<div style={{ height, width: '100%', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--vscode-widget-border, rgba(128,128,128,0.3))' }}>
			<ReactFlow
				nodes={nodes}
				edges={edges}
				nodeTypes={nodeTypes}
				fitView
				fitViewOptions={{ padding: 0.2 }}
				nodesDraggable={false}
				nodesConnectable={false}
				elementsSelectable={false}
				zoomOnScroll={false}
				panOnDrag={false}
				panOnScroll={false}
				preventScrolling={false}
				proOptions={{ hideAttribution: true }}
			>
				<Background gap={16} size={1} />
			</ReactFlow>
		</div>
	);
}
