/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React, { useEffect, useRef, useState } from 'react';
import type { IFlowEntryMessage } from '../shared/types';
import { FlowCard } from './FlowCard';

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
const vscode = acquireVsCodeApi();

type InstallState = 'idle' | 'pending' | 'done' | 'error';

export function App() {
	const [flows, setFlows] = useState<IFlowEntryMessage[]>([]);
	const [query, setQuery] = useState('');
	const [previewId, setPreviewId] = useState<string | null>(null);
	const [previewYaml, setPreviewYaml] = useState<string>('');
	const [installStates, setInstallStates] = useState<Record<string, InstallState>>({});
	const [installMessages, setInstallMessages] = useState<Record<string, string>>({});
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
	const filtered = q
		? flows.filter(f =>
			f.name.toLowerCase().includes(q) ||
			(f.description ?? '').toLowerCase().includes(q) ||
			(f.category ?? '').toLowerCase().includes(q) ||
			(f.subcategory ?? '').toLowerCase().includes(q) ||
			(f.tags ?? []).some(t => t.toLowerCase().includes(q)) ||
			f.id.toLowerCase().includes(q)
		)
		: flows;

	// ── Handlers ───────────────────────────────────────────────────────────
	const handleInstall = (id: string) => {
		setInstallStates(prev => ({ ...prev, [id]: 'pending' }));
		vscode.postMessage({ type: 'install', id });
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
						/>
					))
				)}
			</div>
		</div>
	);
}
