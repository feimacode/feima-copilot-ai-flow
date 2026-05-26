/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import type { IFlowEntryMessage } from '../shared/types';
import { FlowPreview } from '../shared/FlowPreview';

interface FlowCardProps {
	flow: IFlowEntryMessage;
	installState: 'idle' | 'pending' | 'done' | 'error';
	installMessage?: string;
	expanded: boolean;
	previewYaml?: string;
	onInstall: () => void;
	onTogglePreview: () => void;
}

const DIFFICULTY_CLASS: Record<string, string> = {
	beginner: 'badge-beginner',
	intermediate: 'badge-intermediate',
	advanced: 'badge-advanced',
};

export function FlowCard({
	flow,
	installState,
	installMessage,
	expanded,
	previewYaml,
	onInstall,
	onTogglePreview,
}: FlowCardProps) {
	const installLabel =
		installState === 'pending' ? '…' :
		installState === 'done'    ? '✓ Done' :
		installState === 'error'   ? '✕ Error' :
		'Install';

	return (
		<div className={`flow-card ${expanded ? 'flow-card--expanded' : ''}`}>
			{/* Header row */}
			<div className="card-header">
				<span className="card-title" title={flow.name}>{flow.name}</span>
				<div className="card-actions">
					<button
						className="btn-preview"
						onClick={onTogglePreview}
						title={expanded ? 'Hide preview' : 'Preview flow'}
					>
						{expanded ? '▲' : '▼'}
					</button>
					<button
						className={`btn-install btn-install--${installState}`}
						onClick={onInstall}
						disabled={installState === 'pending' || installState === 'done'}
						title={installMessage ?? 'Copy to .github/flows/'}
					>
						{installLabel}
					</button>
				</div>
			</div>

			{/* Description */}
			{flow.description && (
				<div className="card-desc">{flow.description}</div>
			)}

			{/* Badges */}
			{(flow.category || flow.difficulty || (flow.tags?.length ?? 0) > 0) && (
				<div className="card-meta">
					{flow.category && <span className="badge badge-category">{flow.category}</span>}
					{flow.difficulty && (
						<span className={`badge ${DIFFICULTY_CLASS[flow.difficulty.toLowerCase()] ?? ''}`}>
							{flow.difficulty}
						</span>
					)}
					{flow.tags?.map(t => <span key={t} className="badge">{t}</span>)}
				</div>
			)}

			{/* Expandable preview */}
			{expanded && (
				<div className="card-preview">
					{previewYaml
						? <FlowPreview yaml={previewYaml} height={180} />
						: <div className="preview-loading">Loading preview…</div>
					}
				</div>
			)}
		</div>
	);
}
