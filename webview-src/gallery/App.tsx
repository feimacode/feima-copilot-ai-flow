/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React, { useEffect, useRef, useState } from 'react';
import type { IFlowEntryMessage } from '../shared/types';
import { FlowCard } from './FlowCard';

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
const vscode = acquireVsCodeApi();

type InstallState = 'idle' | 'pending' | 'done' | 'error';

const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

export function App() {
	const [flows, setFlows] = useState<IFlowEntryMessage[]>([]);
	const [query, setQuery] = useState('');
	const [previewId, setPreviewId] = useState<string | null>(null);
	const [previewYaml, setPreviewYaml] = useState<string>('');
	const [installStates, setInstallStates] = useState<Record<string, InstallState>>({});
	const [installMessages, setInstallMessages] = useState<Record<string, string>>({});
	const [difficultyFilters, setDifficultyFilters] = useState<Set<string>>(new Set());
	const searchRef = useRef<HTMLInputElement>(null);

	// ── Wire up extension messages ─────────────────────────────────────────
	useEffect(() => {
		const handler = (e: MessageEvent) => {
			const msg = e.data as { type: string; [k: string]: unknown };
			switch (msg.type) {
				case 'update':
					setFlows((msg.flows as IFlowEntryMessage[]) ?? []);
					break;
				case 'preview':
					setPreviewYaml((msg.content as string) ?? '');
					break;
				case 'installDone': {
					const id = msg.id as string;
					const success = msg.success as boolean;
					setInstallStates(prev => ({ ...prev, [id]: success ? 'done' : 'error' }));
					setInstallMessages(prev => ({ ...prev, [id]: (msg.message as string) ?? '' }));
					break;
				}
			}
		};
		window.addEventListener('message', handler);
		vscode.postMessage({ type: 'ready' });
		return () => window.removeEventListener('message', handler);
	}, []);

	// ── Filtered list ──────────────────────────────────────────────────────
	const q = query.toLowerCase().trim();
	const filtered = flows.filter(f => {
		if (difficultyFilters.size > 0) {
			const diff = (f.difficulty ?? '').toLowerCase();
			if (!difficultyFilters.has(diff)) {
				return false;
			}
		}
		if (q) {
			return f.name.toLowerCase().includes(q) ||
				(f.description ?? '').toLowerCase().includes(q) ||
				(f.category ?? '').toLowerCase().includes(q) ||
				(f.subcategory ?? '').toLowerCase().includes(q) ||
				(f.tags ?? []).some(t => t.toLowerCase().includes(q)) ||
				f.id.toLowerCase().includes(q);
		}
		return true;
	});

	// ── Handlers ───────────────────────────────────────────────────────────
	const handleInstall = (id: string) => {
		setInstallStates(prev => ({ ...prev, [id]: 'pending' }));
		vscode.postMessage({ type: 'install', id });
	};

	const handleQuickRun = (id: string) => {
		const state = installStates[id] ?? 'idle';
		if (state === 'done') {
			const command = `@flow #file:${id}.flow.yaml`;
			navigator.clipboard.writeText(command).catch(() => {});
		} else {
			handleInstall(id);
		}
	};

	const handleOpenTutorial = (url: string) => {
		vscode.postMessage({ type: 'openUrl', url });
	};

	const handlePreview = (id: string) => {
		if (previewId === id) {
			setPreviewId(null);
			setPreviewYaml('');
		} else {
			setPreviewId(id);
			setPreviewYaml('');
			vscode.postMessage({ type: 'getPreview', id });
		}
	};

	const handleToggleDifficulty = (level: string) => {
		setDifficultyFilters(prev => {
			const next = new Set(prev);
			if (next.has(level)) {
				next.delete(level);
			} else {
				next.add(level);
			}
			return next;
		});
	};

	const handleClearFilters = () => {
		setDifficultyFilters(new Set());
		setQuery('');
		searchRef.current?.focus();
	};

	return (
		<div className="gallery-root">
			<div className="search-wrap">
				<svg className="search-icon" viewBox="0 0 16 16" fill="currentColor">
					<path d="M6.5 1a5.5 5.5 0 1 0 3.545 9.75l3.1 3.1.707-.707-3.1-3.1A5.5 5.5 0 0 0 6.5 1zm-4.5 5.5a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0z" />
				</svg>
				<input
					ref={searchRef}
					className="search-input"
					type="text"
					placeholder="Search flows…"
					value={query}
					onChange={e => setQuery(e.target.value)}
					autoComplete="off"
					spellCheck={false}
				/>
				{query && (
					<button className="search-clear" onClick={() => { setQuery(''); searchRef.current?.focus(); }} title="Clear">✕</button>
				)}
				<button
					className="toolbar-btn"
					onClick={() => vscode.postMessage({ type: 'createFromTemplate' })}
					title="Create from template"
				>
					<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
						<path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
					</svg>
				</button>
			</div>

			{/* Difficulty filter chips */}
			<div className="filter-chips">
				{DIFFICULTY_LEVELS.map(level => (
					<button
						key={level}
						className={`filter-chip ${difficultyFilters.has(level) ? 'filter-chip--active' : ''}`}
						onClick={() => handleToggleDifficulty(level)}
					>
						{level.charAt(0).toUpperCase() + level.slice(1)}
					</button>
				))}
				{difficultyFilters.size > 0 && (
					<button className="filter-chip filter-chip--clear" onClick={handleClearFilters}>
						Clear filters
					</button>
				)}
			</div>

			<div className="flow-list">
				{filtered.length === 0 ? (
					<div className="empty-state">
						{q ? <>No flows match <strong>{q}</strong>.</> : 'No flows found.'}
					</div>
				) : (
					filtered.map(f => (
						<FlowCard
							key={f.id}
							flow={f}
							installState={installStates[f.id] ?? 'idle'}
							installMessage={installMessages[f.id]}
							expanded={previewId === f.id}
							previewYaml={previewId === f.id ? previewYaml : undefined}
							onInstall={() => handleInstall(f.id)}
							onTogglePreview={() => handlePreview(f.id)}
							onQuickRun={() => handleQuickRun(f.id)}
							onOpenTutorial={() => { if (f.tutorialUrl) handleOpenTutorial(f.tutorialUrl); }}
						/>
					))
				)}
			</div>
		</div>
	);
}
