/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { StageNodeData } from '../../shared/serialize';

export function StageNode({ data }: NodeProps) {
	const d = data as StageNodeData;

	return (
		<div className="stage-group">
			<Handle type="target" position={Position.Top} />
			<div className="stage-group-header">
				<span className="node-badge stage-badge">Stage</span>
				<span className="stage-group-title">{d.stageName}</span>
				{d.iterations > 1 && <span className="stage-iterations">×{d.iterations}</span>}
				<button
					className="icon-btn edit-btn"
					onClick={d.onEdit}
					title="Edit stage"
					aria-label="Edit stage"
				>{'\u270e'}</button>
			</div>
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}
