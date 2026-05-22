/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as yaml from 'js-yaml';
import type { Node, Edge } from '@xyflow/react';
import type { IFlowDocument, IFlowRole, IFlowStage, SubFlowPattern } from '../../src/types/flowDocument';

// ---------------------------------------------------------------------------
// Data shapes
// ---------------------------------------------------------------------------

export interface MetaNodeData extends Record<string, unknown> {
	name: string;
	description: string;
	orchestration: 'sequence' | 'cli';
	category: string;
	difficulty: string;
	tags: string[];
	version: string;
	author: string;
	model: string;
	tools: string[];
	// cli-specific
	isolation: string;
	cliMode: string;
	customAgent: string;
	onChange: (patch: Partial<Omit<MetaNodeData, 'onChange' | 'onEdit'>>) => void;
	onEdit: () => void;
}

export interface RoleNodeData extends Record<string, unknown> {
	name: string;
	prompt: string;
	model: string;
	index: number;
	onChange: (patch: Partial<Omit<RoleNodeData, 'index' | 'onChange' | 'onDelete' | 'onEdit'>>) => void;
	onDelete: () => void;
	onEdit: () => void;
}

export interface StageNodeData extends Record<string, unknown> {
	stageName: string;
	subFlow: string;
	iterations: number;
}

/** Preserved stage structure so serializeFlowDoc can reconstruct the YAML correctly. */
export interface StageMeta {
	name: string;
	subFlow: string;
	iterations: number;
	skills?: unknown[];
	roleCount: number;
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const NODE_X = 0;
// Flat panels: first role starts at y=0 (no meta node in the flow).
const ROLE_START_Y = 0;
const ROLE_GAP = 78;   // ROLE_HEIGHT(62) + GAP(16)

// Stage group layout
const STAGE_PAD_X = 16;       // horizontal padding inside stage group
const STAGE_PAD_Y = 12;       // vertical padding inside stage group
const STAGE_HEADER = 44;      // height of stage group header bar
const ROLE_HEIGHT = 62;       // rendered height of a compact role node
const ROLE_GAP_Y = 12;        // gap between roles inside a stage
const STAGE_WIDTH = 272;      // ROLE_WIDTH(240) + STAGE_PAD_X(16) * 2
const INTER_STAGE_GAP = 60;   // vertical gap between stage groups

/** Pixel height of a stage group containing `n` roles. */
function stageGroupHeight(n: number): number {
	if (n === 0) { return STAGE_HEADER + STAGE_PAD_Y * 2; }
	return STAGE_HEADER + STAGE_PAD_Y + n * ROLE_HEIGHT + (n - 1) * ROLE_GAP_Y + STAGE_PAD_Y;
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

export interface ParseResult {
	nodes: Node[];
	edges: Edge[];
	/** Shared context stored in the `sharedContext` YAML field. */
	rawBody: string;
	/** Present when the document uses stage-based execution. Passed back to serializeFlowDoc. */
	stageMeta?: StageMeta[];
}

/**
 * Parse the raw text of a *.flow.yaml file into React Flow nodes and edges.
 * Supports both flat roles.
 */
export function parseFlowDoc(content: string): ParseResult {
	let fm: Partial<IFlowDocument>;
	try {
		fm = (yaml.load(content) as Partial<IFlowDocument>) ?? {};
	} catch {
		return { nodes: [], edges: [], rawBody: '' };
	}

	const rawBody = fm.sharedContext ? String(fm.sharedContext) : '';

	const metaData: MetaNodeData = {
		name: String(fm.name ?? ''),
		description: String(fm.description ?? ''),
		orchestration: fm.orchestration === 'cli' ? 'cli' : 'sequence',
		category: String(fm.category ?? ''),
		difficulty: String(fm.difficulty ?? ''),
		tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : [],
		version: String(fm.version ?? ''),
		author: String(fm.author ?? ''),
		model: String(fm.model ?? ''),
		tools: Array.isArray(fm.tools) ? (fm.tools as string[]) : [],
		isolation: String(fm.isolation ?? ''),
		cliMode: String(fm.cliMode ?? ''),
		customAgent: String(fm.customAgent ?? ''),
		onChange: () => { /* replaced by App */ },
		onEdit: () => { /* replaced by App */ },
	};

	const nodes: Node[] = [
		{ id: 'meta', type: 'metaNode', position: { x: NODE_X, y: 0 }, data: metaData },
	];
	const edges: Edge[] = [];

	// Stage-based flow
	if (Array.isArray(fm.stages) && fm.stages.length > 0) {
		return buildStageGraph(nodes, edges, fm.stages as IFlowStage[], rawBody);
	}

	// Flat-role flow
	const roles: IFlowRole[] = Array.isArray(fm.roles) ? (fm.roles as IFlowRole[]) : [];

	for (let i = 0; i < roles.length; i++) {
		const role = roles[i];
		nodes.push({
			id: `role-${i}`,
			type: 'roleNode',
			position: { x: NODE_X, y: ROLE_START_Y + i * ROLE_GAP },
			data: {
				name: String(role.name ?? ''),
				prompt: String(role.prompt ?? ''),
				model: String(role.model ?? ''),
				index: i,
				onChange: () => { /* replaced by App */ },
				onDelete: () => { /* replaced by App */ },
				onEdit: () => { /* replaced by App */ },
			} as RoleNodeData,
		});
	}

	if (roles.length > 0) {
		edges.push({ id: 'edge-meta-role-0', source: 'meta', target: 'role-0', animated: true });
	}
	for (let i = 0; i < roles.length - 1; i++) {
		edges.push({ id: `edge-role-${i}-role-${i + 1}`, source: `role-${i}`, target: `role-${i + 1}`, animated: true });
	}

	return { nodes, edges, rawBody };
}

function buildStageGraph(
	nodes: Node[],
	edges: Edge[],
	stageList: IFlowStage[],
	rawBody: string,
): ParseResult {
	const stageMeta: StageMeta[] = [];
	let currentY = 0;
	let globalRoleIdx = 0;
	let prevStageId: string | null = null;

	for (let si = 0; si < stageList.length; si++) {
		const stage = stageList[si];
		const stageRoles: IFlowRole[] = Array.isArray(stage.roles) ? (stage.roles as IFlowRole[]) : [];
		const roleCount = stageRoles.length;
		const stageH = stageGroupHeight(roleCount);

		stageMeta.push({
			name: String(stage.name ?? `Stage ${si + 1}`),
			subFlow: (stage.subFlow ?? 'sequence') as SubFlowPattern,
			iterations: typeof stage.iterations === 'number' ? Math.max(1, stage.iterations) : 1,
			skills: Array.isArray(stage.skills) ? stage.skills : undefined,
			roleCount,
		});

		const stageId = `stage-${si}`;
		nodes.push({
			id: stageId,
			type: 'stageNode',
			position: { x: NODE_X, y: currentY },
			style: { width: STAGE_WIDTH, height: stageH },
			data: {
				stageName: stageMeta[si].name,
				subFlow: stageMeta[si].subFlow,
				iterations: stageMeta[si].iterations,
			} as StageNodeData,
		});
		if (prevStageId) {
			edges.push({ id: `edge-${prevStageId}-${stageId}`, source: prevStageId, target: stageId, animated: true });
		}
		prevStageId = stageId;

		for (let ri = 0; ri < stageRoles.length; ri++) {
			const role = stageRoles[ri];
			const roleId = `role-${globalRoleIdx}`;
			nodes.push({
				id: roleId,
				type: 'roleNode',
				parentId: stageId,
				extent: 'parent' as const,
				position: {
					x: STAGE_PAD_X,
					y: STAGE_HEADER + STAGE_PAD_Y + ri * (ROLE_HEIGHT + ROLE_GAP_Y),
				},
				data: {
					name: String(role.name ?? ''),
					prompt: String(role.prompt ?? ''),
					model: String(role.model ?? ''),
					index: globalRoleIdx,
					onChange: () => { /* replaced by App */ },
					onDelete: () => { /* replaced by App */ },
					onEdit: () => { /* replaced by App */ },
				} as RoleNodeData,
			});
			globalRoleIdx++;
		}
		currentY += stageH + INTER_STAGE_GAP;
	}

	return { nodes, edges, rawBody, stageMeta };
}

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

/**
 * Serialize React Flow nodes back to a *.flow.yaml string.
 * Pass `stageMeta` from ParseResult to preserve stage structure on round-trip.
 * Role nodes are ordered by vertical position (top → bottom = first → last).
 */
export function serializeFlowDoc(nodes: Node[], rawBody: string, stageMeta?: StageMeta[]): string {
	const metaNode = nodes.find(n => n.id === 'meta');
	if (!metaNode) { return ''; }

	const meta = metaNode.data as MetaNodeData;
	// When stages are groups, role positions are parent-relative; sort by stage
	// index (from parentId 'stage-N') then by y within the stage.
	const allRoleNodes = nodes.filter(n => n.type === 'roleNode');
	const roleNodes = stageMeta
		? allRoleNodes.sort((a, b) => {
			const ai = Number(String(a.parentId ?? '').split('-')[1] ?? 999);
			const bi = Number(String(b.parentId ?? '').split('-')[1] ?? 999);
			return ai !== bi ? ai - bi : a.position.y - b.position.y;
		})
		: allRoleNodes.sort((a, b) => a.position.y - b.position.y);

	const fm: Record<string, unknown> = { name: meta.name };
	if (meta.description) { fm.description = meta.description; }
	if (meta.category) { fm.category = meta.category; }
	fm.orchestration = meta.orchestration;
	if (meta.difficulty) { fm.difficulty = meta.difficulty; }
	if (meta.tags?.length) { fm.tags = meta.tags; }
	if (meta.version) { fm.version = meta.version; }
	if (meta.author) { fm.author = meta.author; }
	if (meta.model) { fm.model = meta.model; }
	if (meta.tools?.length) { fm.tools = meta.tools; }
	if (meta.isolation) { fm.isolation = meta.isolation; }
	if (meta.cliMode) { fm.cliMode = meta.cliMode; }
	if (meta.customAgent) { fm.customAgent = meta.customAgent; }

	if (stageMeta) {
		// Reconstruct stage structure from the flattened role nodes.
		let offset = 0;
		fm.stages = stageMeta.map(stage => {
			const stageRoles = roleNodes.slice(offset, offset + stage.roleCount);
			offset += stage.roleCount;
			const s: Record<string, unknown> = {
				name: stage.name,
				subFlow: stage.subFlow,
				iterations: stage.iterations,
			};
			if (stage.skills?.length) { s.skills = stage.skills; }
			s.roles = stageRoles.map(n => {
				const d = n.data as RoleNodeData;
				const r: Record<string, string> = { name: d.name, prompt: d.prompt };
				if (d.model) { r.model = d.model; }
				return r;
			});
			return s;
		});
	} else {
		fm.roles = roleNodes.map(n => {
			const d = n.data as RoleNodeData;
			const r: Record<string, string> = { name: d.name, prompt: d.prompt };
			if (d.model) { r.model = d.model; }
			return r;
		});
	}

	if (rawBody.trim()) { fm.sharedContext = rawBody; }
	return yaml.dump(fm, { lineWidth: -1, noRefs: true, quotingType: '"' });
}
