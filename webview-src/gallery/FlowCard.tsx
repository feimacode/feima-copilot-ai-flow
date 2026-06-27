/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import type { IFlowEntryMessage } from '../shared/types';
import { FlowPreview } from '../shared/FlowPreview';
import { EnlargedSection } from './EnlargedSection';

interface FlowCardProps {
	flow: IFlowEntryMessage;
	installState: 'idle' | 'pending' | 'done' | 'error';
	installMessage?: string;
	expanded: boolean;
	previewYaml?: string;
	onInstall: () => void;
	onTogglePreview: () => void;
	onQuickRun: () => void;
	onOpenTutorial: () => void;
}

const DIFFICULTY_CLASS: Record<string, string> = {
	beginner: 'badge-beginner',
	intermediate: 'badge-intermediate',
	advanced: 'badge-advanced',
};

const ORCHESTRATION_ICONS: Record<string, string> = {
	sequence: '→',
	staged: '↻',
	'fork-join': '⌥',
};

export function FlowCard({
	flow,
	installState,
	installMessage,
	expanded,
	previewYaml,
	onInstall,
	onTogglePreview,
	onQuickRun,
	onOpenTutorial,
}: FlowCardProps) {
	const [showMoreMenu, setShowMoreMenu] = useState(false);

	const isInstalled = installState === 'done';
	const quickRunCommand = `@flow #file:${flow.id}.flow.yaml`;

	const handleStarClick = () => {
		if (flow.sourceUrl) {
			(window as any).vscode.postMessage({ type: 'openUrl', url: flow.sourceUrl });
		}
	};

	const handleMoreMenuClick = () => {
		setShowMoreMenu(!showMoreMenu);
	};

	const handleCopyReference = () => {
		navigator.clipboard.writeText(`@flow #file:${flow.id}.flow.yaml`);
		setShowMoreMenu(false);
	};

	const handleOpenSource = () => {
		if (flow.sourceUrl) {
			(window as any).vscode.postMessage({ type: 'openUrl', url: flow.sourceUrl });
		}
		setShowMoreMenu(false);
	};

	const handleOpenEditor = () => {
		(window as any).vscode.postMessage({ type: 'openEditor', id: flow.id });
		setShowMoreMenu(false);
	};

	const handleUninstall = () => {
		(window as any).vscode.postMessage({ type: 'uninstall', id: flow.id });
		setShowMoreMenu(false);
	};

	const handleViewYaml = () => {
		(window as any).vscode.postMessage({ type: 'viewYaml', id: flow.id });
	};

	const visibleTags = (flow.tags ?? []).slice(0, 3);
	const hasMoreTags = (flow.tags?.length ?? 0) > 3;

	return (
		<div className={`flow-card ${expanded ? 'flow-card--expanded' : ''}`}>
			{/* Compact preview (always visible) */}
			<div className="preview-section preview-section--compact">
				{flow.yamlContent || previewYaml
					? <FlowPreview yaml={previewYaml || flow.yamlContent || ''} height={200} compact />
					: <div className="preview-loading">Preview not available</div>
				}
				<button
					className="btn-preview-overlay"
					onClick={onTogglePreview}
					title={expanded ? 'Collapse preview' : 'Expand preview'}
				>
					🔍
				</button>
			</div>

			{/* Title row */}
			<div className="card-title-row">
				<span className="card-title" title={flow.name}>{flow.name}</span>
				<div className="card-actions">
					<button
						className={`btn-star ${flow.sourceUrl ? '' : 'btn-star--disabled'}`}
						onClick={handleStarClick}
						disabled={!flow.sourceUrl}
						title={flow.sourceUrl ? `Star on GitHub (${flow.starCount ?? 0} stars)` : 'No source URL available'}
					>
						★ {flow.starCount ?? 0}
					</button>
					<div className="more-menu-container">
						<button
							className="btn-icon"
							onClick={handleMoreMenuClick}
							title="More actions"
						>
							⋮
						</button>
						{showMoreMenu && (
							<div className="more-menu">
								<button onClick={handleCopyReference}>Copy flow reference</button>
								{flow.tutorialUrl && (
									<button onClick={onOpenTutorial}>Open tutorial</button>
								)}
								{flow.sourceUrl && (
									<button onClick={handleOpenSource}>Open source on GitHub</button>
								)}
								{flow.source === 'catalog' && !isInstalled && (
									<button onClick={onInstall}>Install to workspace</button>
								)}
								<button onClick={handleOpenEditor}>Open in editor</button>
								{flow.source === 'catalog' && isInstalled && (
									<button onClick={handleUninstall}>Uninstall</button>
								)}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Description */}
			{flow.description && (
				<div className="card-desc" title={flow.description}>{flow.description}</div>
			)}

			{/* Badges */}
			{(flow.category || flow.difficulty || visibleTags.length > 0) && (
				<div className="card-meta">
					{flow.category && <span className="badge badge-category">{flow.category}</span>}
					{flow.difficulty && (
						<span className={`badge ${DIFFICULTY_CLASS[flow.difficulty.toLowerCase()] ?? ''}`}>
							{flow.difficulty}
						</span>
					)}
					{visibleTags.map(t => <span key={t} className="badge">{t}</span>)}
					{hasMoreTags && <span className="badge">+{flow.tags!.length - 3}</span>}
				</div>
			)}

			{/* Metadata */}
			<div className="card-metadata">
				{flow.roleCount !== undefined && (
					<span className="metadata-item" title={`${flow.roleCount} roles`}>
						👤 {flow.roleCount}
					</span>
				)}
				{flow.orchestration && (
					<span className="metadata-item" title={`Orchestration: ${flow.orchestration}`}>
						{ORCHESTRATION_ICONS[flow.orchestration] ?? '→'} {flow.orchestration}
					</span>
				)}
				{flow.version && (
					<span className="metadata-item" title={`Version ${flow.version}`}>
						v{flow.version}
					</span>
				)}
				{flow.author && (
					<span className="metadata-item" title={`Author: ${flow.author}`}>
						👤 {flow.author}
					</span>
				)}
			</div>

			{/* Quick actions */}
			<div className="card-actions-row">
				<button
					className={`btn-primary ${isInstalled ? '' : 'btn-primary--install'}`}
					onClick={onQuickRun}
					title={isInstalled ? `Copy: ${quickRunCommand}` : 'Install first'}
				>
					{isInstalled ? '▶ Run' : '↓ Install'}
				</button>
				{flow.tutorialUrl && (
					<button
						className="btn-ghost"
						onClick={onOpenTutorial}
						title="Open tutorial"
					>
						📖 Tutorial
					</button>
				)}
			</div>

			{/* Install error message */}
			{installState === 'error' && installMessage && (
				<div className="card-error-message">{installMessage}</div>
			)}

			{/* Modal overlay for enlarged preview */}
			{expanded && (
				<div className="preview-overlay" onClick={onTogglePreview}>
					<div className="preview-overlay-content" onClick={e => e.stopPropagation()}>
						{previewYaml || flow.yamlContent ? (
							<EnlargedSection
								flowId={flow.id}
								yaml={previewYaml || flow.yamlContent || ''}
								onOpenEditor={handleOpenEditor}
								onViewYaml={handleViewYaml}
								onCollapse={onTogglePreview}
							/>
						) : (
							<div className="preview-loading" style={{ height: '60vh' }}>Loading preview…</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
