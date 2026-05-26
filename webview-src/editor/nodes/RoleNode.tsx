/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { RoleNodeData } from '../../shared/serialize';

export function RoleNode({ data }: NodeProps) {
	const d = data as RoleNodeData;
	const preview = d.prompt
		? d.prompt.slice(0, 80).replace(/\n/g, ' ') + (d.prompt.length > 80 ? '\u2026' : '')
		: '';

	return (
		<div className="flow-node role-node compact-node">
			<Handle type="target" position={Position.Top} />
			<div className="compact-header">
				<span className="node-badge">Role {d.index + 1}</span>
				<span className="compact-title">{d.name || 'Unnamed Role'}</span>
				<button
					className="icon-btn edit-btn"
					onClick={d.onEdit}
					title="Edit role"
					aria-label="Edit role"
				>\u270e</button>
				<button
					className="icon-btn delete-btn"
					onClick={d.onDelete}
					title="Remove role"
					aria-label="Remove role"
				>\u2715</button>
			</div>
			{preview && (
				<div className="compact-subtitle">{preview}</div>
			)}
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}
