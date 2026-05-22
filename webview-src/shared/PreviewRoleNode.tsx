/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { RoleNodeData, MetaNodeData } from './serialize';

/**
 * Read-only role/meta node for gallery previews.
 * Renders just the name badge — no edit or delete controls.
 */
export function PreviewRoleNode({ data, type }: NodeProps) {
	const isMeta = type === 'metaNode';
	const name = isMeta
		? (data as MetaNodeData).name || 'Flow'
		: (data as RoleNodeData).name;

	return (
		<div style={{
			padding: '4px 10px',
			background: isMeta
				? 'var(--vscode-badge-background, #007acc)'
				: 'var(--vscode-editor-background, #1e1e1e)',
			border: '1px solid var(--vscode-widget-border, rgba(128,128,128,0.4))',
			borderRadius: 4,
			fontSize: 11,
			color: isMeta ? 'var(--vscode-badge-foreground, #fff)' : 'var(--vscode-foreground)',
			minWidth: 80,
			textAlign: 'center',
		}}>
			{!isMeta && <Handle type="target" position={Position.Top} style={{ background: 'var(--vscode-focusBorder)' }} />}
			{name}
			<Handle type="source" position={Position.Bottom} style={{ background: 'var(--vscode-focusBorder)' }} />
		</div>
	);
}
