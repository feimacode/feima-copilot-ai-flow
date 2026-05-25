/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { StageNodeData } from './serialize';

/**
 * Read-only stage group node for gallery previews.
 */
export function PreviewStageNode({ data }: NodeProps) {
	const d = data as StageNodeData;

	return (
		<div style={{
			padding: '4px 10px 4px 8px',
			background: 'var(--vscode-editorGroupHeader-tabsBackground, rgba(128,128,128,0.1))',
			border: '1px dashed var(--vscode-widget-border, rgba(128,128,128,0.4))',
			borderRadius: 4,
			fontSize: 10,
			color: 'var(--vscode-descriptionForeground)',
			textAlign: 'center',
		}}>
			<Handle type="target" position={Position.Top} style={{ background: 'var(--vscode-focusBorder)' }} />
			<span style={{ fontWeight: 600 }}>{d.stageName}</span>
			{d.iterations > 1 && <span style={{ marginLeft: 4 }}>×{d.iterations}</span>}
			<Handle type="source" position={Position.Bottom} style={{ background: 'var(--vscode-focusBorder)' }} />
		</div>
	);
}
