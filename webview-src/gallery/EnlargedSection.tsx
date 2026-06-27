/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { FlowPreview } from '../shared/FlowPreview';

interface EnlargedSectionProps {
	flowId: string;
	yaml: string;
	onOpenEditor: () => void;
	onViewYaml: () => void;
	onCollapse: () => void;
}

export function EnlargedSection({ flowId, yaml, onOpenEditor, onViewYaml, onCollapse }: EnlargedSectionProps) {
	const [showAllRoles, setShowAllRoles] = useState(false);

	// Parse YAML to extract role information
	const roles = React.useMemo(() => {
		try {
			const doc = parseYaml(yaml);
			if (Array.isArray(doc.roles)) {
				return doc.roles;
			} else if (Array.isArray(doc.stages)) {
				return doc.stages.flatMap((stage: any) => stage.roles ?? []);
			} else if (Array.isArray(doc.groups)) {
				return doc.groups.flatMap((group: any) => group.roles ?? []);
			}
			return [];
		} catch {
			return [];
		}
	}, [yaml]);

	const visibleRoles = showAllRoles ? roles : roles.slice(0, 2);

	return (
		<div className="enlarged-section">
			<div className="enlarged-header">
				<span className="enlarged-title">Flow Preview</span>
				<div className="enlarged-actions">
					<button className="btn-ghost" onClick={onOpenEditor}>Open in Editor</button>
					<button className="btn-ghost" onClick={onViewYaml}>View YAML</button>
					<button className="btn-ghost" onClick={onCollapse} title="Close">✕</button>
				</div>
			</div>

			<div className="preview-section preview-section--enlarged">
				<FlowPreview yaml={yaml} compact={false} />
			</div>

			{roles.length > 0 && (
				<>
					<div className="enlarged-header" style={{ marginTop: '12px' }}>
						<span className="enlarged-title">Roles ({roles.length})</span>
					</div>

					<div className="role-prompt-cards">
						{visibleRoles.map((role: any, index: number) => (
							<div key={index} className="role-prompt-card">
								<div className="role-prompt-header">
									<span className="role-prompt-name">{role.name}</span>
								</div>
								{role.prompt && (
									<div className="role-prompt-text" title={role.prompt}>
										{role.prompt}
									</div>
								)}
								{role.tools && role.tools.length > 0 && (
									<div className="role-prompt-tools">
										Tools: {role.tools.join(', ')}
									</div>
								)}
							</div>
						))}

						{!showAllRoles && roles.length > 2 && (
							<button
								className="btn-show-all"
								onClick={() => setShowAllRoles(true)}
							>
								Show all {roles.length} roles
							</button>
						)}
					</div>
				</>
			)}
		</div>
	);
}

// Simple YAML parser for extracting roles
function parseYaml(yamlString: string): any {
	// Very basic YAML parser - just extract roles array
	// For production, use a proper YAML library
	try {
		// Try to extract roles section
		const rolesMatch = yamlString.match(/roles:\s*\n((?:\s+-\s+name:.*\n(?:\s+\w+:.*\n?)*)*)/);
		if (rolesMatch) {
			const rolesText = rolesMatch[1];
			const roleEntries = rolesText.split(/^\s+-\s+name:/m).filter(Boolean);
			return roleEntries.map(entry => {
				const lines = entry.trim().split('\n');
				const role: any = { name: lines[0]?.trim() || 'Unknown' };
				for (let i = 1; i < lines.length; i++) {
					const line = lines[i].trim();
					if (line.startsWith('prompt:')) {
						role.prompt = line.substring(7).trim();
					} else if (line.startsWith('tools:')) {
						role.tools = [];
					}
				}
				return role;
			});
		}
	} catch {
		// Fall through
	}

	return [];
}