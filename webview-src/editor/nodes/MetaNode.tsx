/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { MetaNodeData } from '../../shared/serialize';

export function MetaNode({ data }: NodeProps) {
	const d = data as MetaNodeData;

	return (
		<div className="flow-node meta-node compact-node">
			<div className="compact-header">
				<span className="node-badge meta-badge">Flow</span>

				<span className="compact-title">{d.name || 'Untitled Flow'}</span>
				<button
					className="icon-btn edit-btn"
					onClick={d.onEdit}
					title="Edit flow settings"
					aria-label="Edit flow settings"
				>✎</button>
			</div>
			{d.description && (
				<div className="compact-subtitle">{d.description}</div>
			)}
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}

