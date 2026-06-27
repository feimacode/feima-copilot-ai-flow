/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { GroupNodeData } from '../../shared/serialize';

export function GroupNode({ data }: NodeProps) {
	const d = data as GroupNodeData;

	return (
		<div className="stage-group group-node">
			<Handle type="target" position={Position.Top} />
			<div className="stage-group-header">
				<span className="node-badge group-badge">Group</span>
				<span className="stage-group-title">{d.name || 'Unnamed Group'}</span>
				<button
					className="icon-btn edit-btn"
					onClick={d.onEdit}
					title="Edit group"
					aria-label="Edit group"
				>{'\u270e'}</button>
			</div>
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}
