/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React, { useRef, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { RoleNodeData } from '../../shared/serialize';
import { PortalTooltip } from '../../shared/PortalTooltip';

// ---------------------------------------------------------------------------
// RoleNode
// ---------------------------------------------------------------------------

export function RoleNode({ data }: NodeProps) {
	const d = data as RoleNodeData;
	const [showTooltip, setShowTooltip] = useState(false);
	const magRef = useRef<HTMLButtonElement>(null);

	return (
		<>
			<div className="flow-node role-node compact-node">
				<Handle type="target" position={Position.Top} />
				<div className="compact-header">
					<span className="node-badge">Role {d.index + 1}</span>
					<span className="compact-title">{d.name || 'Unnamed Role'}</span>
					{d.prompt && (
						<button
							ref={magRef}
							className="icon-btn magnifier-btn"
							onMouseEnter={() => setShowTooltip(true)}
							onMouseLeave={() => setShowTooltip(false)}
							title="View full prompt"
							aria-label="View full prompt"
						>{'\ud83d\udd0d'}</button>
					)}
					<button
						className="icon-btn edit-btn"
						onClick={d.onEdit}
						title="Edit role"
						aria-label="Edit role"
					>{'\u270e'}</button>
					<button
						className="icon-btn delete-btn"
						onClick={d.onDelete}
						title="Remove role"
						aria-label="Remove role"
					>{'\u2715'}</button>
				</div>
				{d.prompt && (
					<div className="compact-subtitle">
						{d.prompt}
					</div>
				)}
				<Handle type="source" position={Position.Bottom} />
			</div>
			<PortalTooltip text={d.prompt} triggerRef={magRef} visible={showTooltip} direction="up" />
		</>
	);
}
