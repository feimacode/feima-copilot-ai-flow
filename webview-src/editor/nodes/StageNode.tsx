/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { StageNodeData } from '../../shared/serialize';

const SUB_FLOW_LABELS: Record<string, string> = {
'sequence': 'sequence',
'research-edit-review': 'research → edit → review',
'plan-execute-test-fix': 'plan → execute → test → fix',
};

export function StageNode({ data }: NodeProps) {
	const d = data as StageNodeData;
	const subFlowLabel = SUB_FLOW_LABELS[d.subFlow] ?? d.subFlow;

	return (
		<div className="stage-group">
			<Handle type="target" position={Position.Top} />
			<div className="stage-group-header">
				<span className="node-badge stage-badge">Stage</span>
				<span className="stage-group-title">{d.stageName}</span>
				{d.iterations > 1 && <span className="stage-iterations">×{d.iterations}</span>}
				<span className="stage-group-subflow">{subFlowLabel}</span>
			</div>
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}
