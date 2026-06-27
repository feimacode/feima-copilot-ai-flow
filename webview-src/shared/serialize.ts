/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as yaml from 'js-yaml';
import type { Node, Edge } from '@xyflow/react';
import type { IFlowDocument, IFlowRole, IFlowStage, IFlowGroup } from '../../src/types/flowDocument';

// ---------------------------------------------------------------------------
// Data shapes
// ---------------------------------------------------------------------------

export interface MetaNodeData extends Record<string, unknown> {
	name: string;
	description: string;
	sharedContext: string;
	category: string;
	difficulty: string;
	tags: string[];
	version: string;
	author: string;
	model: string;
	tools: string[];
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
	iterations: number;
	onChange: (patch: Partial<Pick<StageNodeData, 'stageName' | 'iterations'>>) => void;
	onEdit: () => void;
}

/** Data attached to a group container node (fork-join pattern). */
export interface GroupNodeData extends Record<string, unknown> {
	name: string;
	onChange: (patch: Partial<Pick<GroupNodeData, 'name'>>) => void;
	onEdit: () => void;
}

/** Preserved stage structure so serializeFlowDoc can reconstruct the YAML correctly. */
export interface StageMeta {
	name: string;
	iterations: number;
	skills?: unknown[];
	roleCount: number;
}

/** Preserved group structure so serializeFlowDoc can reconstruct fork-join YAML correctly. */
export interface GroupMeta {
	name: string;
	skills?: unknown[];
	roleCount: number;
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const NODE_X = 0;
// Flat panels: first role starts at y=0 (no meta node in the flow).
const ROLE_START_Y = 0;
const ROLE_GAP = 116;  // ROLE_HEIGHT(100) + GAP(16)

// Stage group layout
const STAGE_PAD_X = 16;       // horizontal padding inside stage group
const STAGE_PAD_Y = 12;       // vertical padding inside stage group
const STAGE_HEADER = 44;      // height of stage group header bar
const ROLE_HEIGHT = 100;      // rendered height of a compact role node (with 3-line preview)
const ROLE_GAP_Y = 12;        // gap between roles inside a stage/group
const STAGE_WIDTH = 272;      // ROLE_WIDTH(240) + STAGE_PAD_X(16) * 2
const INTER_STAGE_GAP = 60;   // vertical gap between stage groups
const GROUP_GAP_X = 40;       // horizontal gap between parallel groups
const JOIN_GAP_Y = 60;        // vertical gap from groups to join role

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
	/** Present when the document uses fork-join execution. Passed back to serializeFlowDoc. */
	groupMeta?: GroupMeta[];
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
		sharedContext: String(fm.sharedContext ?? ''),
		category: String(fm.category ?? ''),
		difficulty: String(fm.difficulty ?? ''),
		tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : [],
		version: String(fm.version ?? ''),
		author: String(fm.author ?? ''),
		model: String(fm.model ?? ''),
		tools: Array.isArray(fm.tools) ? (fm.tools as string[]) : [],
		customAgent: String(fm.customAgent ?? ''),
		orchestration: String((fm as any).orchestration ?? ''),
		cliMode: String((fm as any).cliMode ?? ''),
		isolation: String((fm as any).isolation ?? ''),
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

	// Fork-join flow
	if (Array.isArray(fm.groups) && fm.groups.length > 0) {
		const groups = fm.groups as IFlowGroup[];
		const join = fm.join as IFlowRole | undefined;
		return buildForkJoinGraph(nodes, edges, groups, join, rawBody);
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

		stageMeta.push({
			name: String(stage.name ?? `Stage ${si + 1}`),
			iterations: typeof stage.iterations === 'number' ? Math.max(1, stage.iterations) : 1,
			skills: Array.isArray(stage.skills) ? stage.skills : undefined,
			roleCount,
		});

		const stageId = `stage-${si}`;

		// Build child role nodes first to calculate stage dimensions
		const childNodes: Node[] = [];
		for (let ri = 0; ri < stageRoles.length; ri++) {
			const role = stageRoles[ri];
			const roleId = `role-${globalRoleIdx}`;
			childNodes.push({
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

		// Calculate stage dimensions based on child extents
		const stageW = computeStageWidth(childNodes);
		const stageH = computeStageHeight(childNodes);

		nodes.push({
			id: stageId,
			type: 'stageNode',
			position: { x: NODE_X, y: currentY },
			style: { width: stageW, height: stageH },
			data: {
				stageName: stageMeta[si].name,
				iterations: stageMeta[si].iterations,
				onChange: () => { /* replaced by App */ },
				onEdit: () => { /* replaced by App */ },
			} as StageNodeData,
		});
		nodes.push(...childNodes);

		if (prevStageId) {
			edges.push({ id: `edge-${prevStageId}-${stageId}`, source: prevStageId, target: stageId, animated: true });
		}
		prevStageId = stageId;

		currentY += stageH + INTER_STAGE_GAP;
	}

	return { nodes, edges, rawBody, stageMeta };
}

/**
 * Build React Flow nodes and edges for a fork-join flow.
 *
 * Layout:
 *   - Groups are placed side-by-side horizontally (parallel lanes).
 *   - Each group renders like a stage container: a GroupNode with child RoleNodes.
 *   - The join role sits below all groups, centered horizontally.
 *   - Edges: meta → each group, each group → join role.
 */
function buildForkJoinGraph(
	nodes: Node[],
	edges: Edge[],
	groups: IFlowGroup[],
	join: IFlowRole | undefined,
	rawBody: string,
): ParseResult {
	const groupMeta: GroupMeta[] = [];
	let globalRoleIdx = 0;

	// Group metadata and actual rendered widths are collected so we can
	// lay out adjacent groups and center the join role correctly.
	const groupWidths: number[] = [];
	const groupHeights: number[] = [];

	let currentX = NODE_X;

	for (let gi = 0; gi < groups.length; gi++) {
		const group = groups[gi];
		const groupRoles: IFlowRole[] = Array.isArray(group.roles) ? (group.roles as IFlowRole[]) : [];
		const roleCount = groupRoles.length;

		groupMeta.push({
			name: String(group.name ?? `Group ${gi + 1}`),
			skills: Array.isArray(group.skills) ? group.skills : undefined,
			roleCount,
		});

		const groupId = `group-${gi}`;

		// Build child role nodes first so we can compute group dimensions from them.
		const childNodes: Node[] = [];
		for (let ri = 0; ri < groupRoles.length; ri++) {
			const role = groupRoles[ri];
			const roleId = `role-${globalRoleIdx}`;
			childNodes.push({
				id: roleId,
				type: 'roleNode',
				parentId: groupId,
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

		const groupW = computeStageWidth(childNodes);
		const groupH = computeStageHeight(childNodes);
		groupWidths.push(groupW);
		groupHeights.push(groupH);

		nodes.push({
			id: groupId,
			type: 'groupNode',
			position: { x: currentX, y: 0 },
			style: { width: groupW, height: groupH },
			data: {
				name: groupMeta[gi].name,
				onChange: () => { /* replaced by App */ },
				onEdit: () => { /* replaced by App */ },
			} as GroupNodeData,
		});
		nodes.push(...childNodes);

		// Edge from meta to this group
		edges.push({ id: `edge-meta-${groupId}`, source: 'meta', target: groupId, animated: true });

		currentX += groupW + GROUP_GAP_X;
	}

	const tallestGroupH = groupHeights.length > 0 ? Math.max(...groupHeights) : 0;

	// Build the join role node (if present)
	if (join) {
		const joinW = 220; // ROLE_WIDTH approximate — same as flat-role nodes
		// Center the join role horizontally under the groups
		const totalWidth = groupWidths.reduce((sum, w, i) => sum + w + (i > 0 ? GROUP_GAP_X : 0), 0);
		const joinX = NODE_X + (totalWidth - joinW) / 2;

		const joinId = `role-${globalRoleIdx}`;
		nodes.push({
			id: joinId,
			type: 'roleNode',
			position: { x: joinX, y: tallestGroupH + JOIN_GAP_Y },
			data: {
				name: String(join.name ?? 'Join'),
				prompt: String(join.prompt ?? ''),
				model: String(join.model ?? ''),
				index: globalRoleIdx,
				onChange: () => { /* replaced by App */ },
				onDelete: () => { /* replaced by App */ },
				onEdit: () => { /* replaced by App */ },
			} as RoleNodeData,
		});
		globalRoleIdx++;

		// Edges from each group to the join role
		for (let gi = 0; gi < groups.length; gi++) {
			edges.push({ id: `edge-group-${gi}-join`, source: `group-${gi}`, target: joinId, animated: true });
		}
	}

	return { nodes, edges, rawBody, groupMeta };
}

/**
 * Calculate stage width based on child node extents
 */
function computeStageWidth(children: Node[]): number {
	if (children.length === 0) {
		return STAGE_WIDTH;
	}

	// Find the rightmost edge of any child node
	let maxX = 0;
	for (const child of children) {
		// Estimate child width: 320px max-width + 20px padding + 2px border
		const childWidth = 342;
		const rightEdge = child.position.x + childWidth;
		maxX = Math.max(maxX, rightEdge);
	}

	return maxX + STAGE_PAD_X;
}

/**
 * Calculate stage height based on child node extents
 */
function computeStageHeight(children: Node[]): number {
	if (children.length === 0) {
		return STAGE_HEADER + STAGE_PAD_Y * 2;
	}

	// Find the bottommost edge of any child node
	let maxY = 0;
	for (const child of children) {
		const bottomEdge = child.position.y + ROLE_HEIGHT;
		maxY = Math.max(maxY, bottomEdge);
	}

	return maxY + STAGE_PAD_Y;
}

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

/**
 * Serialize React Flow nodes back to a *.flow.yaml string.
 * Pass `stageMeta` or `groupMeta` from ParseResult to preserve structure on round-trip.
 * Role nodes are ordered by vertical position (top → bottom = first → last) within
 * their parent stage/group, or by global index for flat flows.
 */
export function serializeFlowDoc(nodes: Node[], rawBody: string, stageMeta?: StageMeta[], groupMeta?: GroupMeta[]): string {
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
	if (meta.difficulty) { fm.difficulty = meta.difficulty; }
	if (meta.tags?.length) { fm.tags = meta.tags; }
	if (meta.version) { fm.version = meta.version; }
	if (meta.author) { fm.author = meta.author; }
	if (meta.model) { fm.model = meta.model; }
	if (meta.tools?.length) { fm.tools = meta.tools; }
	if (meta.customAgent) { fm.customAgent = meta.customAgent; }
	if ((meta as any).orchestration) { fm.orchestration = (meta as any).orchestration; }
	if ((meta as any).cliMode) { fm.cliMode = (meta as any).cliMode; }
	if ((meta as any).isolation) { fm.isolation = (meta as any).isolation; }

	if (stageMeta) {
		// Reconstruct stage structure from the flattened role nodes.
		let offset = 0;
		fm.stages = stageMeta.map((stage, si) => {
			const stageRoles = roleNodes.slice(offset, offset + stage.roleCount);
			offset += stage.roleCount;
			// Read live stage name/iterations from the stage node (preserves edits).
			const stageNode = nodes.find(n => n.id === `stage-${si}`);
			const stageData = stageNode?.data as StageNodeData | undefined;
			const s: Record<string, unknown> = {
				name: stageData?.stageName ?? stage.name,
				iterations: stageData?.iterations ?? stage.iterations,
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
	} else if (groupMeta) {
		// Reconstruct fork-join structure from the flattened role nodes.
		// Roles are sorted by parentId (group-0, group-1, ...) then by y.
		// The join role has no parentId.
		const groupRoles = allRoleNodes
			.filter(n => n.parentId !== undefined && String(n.parentId).startsWith('group-'))
			.sort((a, b) => {
				const ai = Number(String(a.parentId ?? '').split('-')[1] ?? 999);
				const bi = Number(String(b.parentId ?? '').split('-')[1] ?? 999);
				return ai !== bi ? ai - bi : a.position.y - b.position.y;
			});
		const joinRole = allRoleNodes.find(n => n.parentId === undefined || !String(n.parentId).startsWith('group-'));

		let offset = 0;
		fm.groups = groupMeta.map((grp, gi) => {
			const grpRoles = groupRoles.slice(offset, offset + grp.roleCount);
			offset += grp.roleCount;
			const groupNode = nodes.find(n => n.id === `group-${gi}`);
			const groupData = groupNode?.data as GroupNodeData | undefined;
			const g: Record<string, unknown> = { name: groupData?.name ?? grp.name };
			if (grp.skills?.length) { g.skills = grp.skills; }
			g.roles = grpRoles.map(n => {
				const d = n.data as RoleNodeData;
				const r: Record<string, string> = { name: d.name, prompt: d.prompt };
				if (d.model) { r.model = d.model; }
				return r;
			});
			return g;
		});

		if (joinRole) {
			const d = joinRole.data as RoleNodeData;
			const j: Record<string, string> = { name: d.name, prompt: d.prompt };
			if (d.model) { j.model = d.model; }
			fm.join = j;
		}
	} else {
		fm.roles = roleNodes.map(n => {
			const d = n.data as RoleNodeData;
			const r: Record<string, string> = { name: d.name, prompt: d.prompt };
			if (d.model) { r.model = d.model; }
			return r;
		});
	}

	if (meta.sharedContext?.trim()) { fm.sharedContext = meta.sharedContext; }

	// Build YAML manually so multi-line sharedContext and prompts use
	// literal block scalars (|) instead of invalid double-quoted multiline.
	return yamlToText(fm);
}

/** Serialize a plain JS object to YAML text, using literal block scalars for
 *  multi-line string values. */
function yamlToText(obj: Record<string, unknown>, indent = 0): string {
	const pad = '  '.repeat(indent);
	const lines: string[] = [];

	for (const [key, value] of Object.entries(obj)) {
		if (value === undefined || value === null || value === '') { continue; }

		if (Array.isArray(value)) {
			if (value.length === 0) { continue; }
			if (value.every(v => typeof v === 'string' && !v.includes('\n'))) {
				// Simple string array: inline YAML
				lines.push(`${pad}${key}: [${value.map(v => JSON.stringify(v)).join(', ')}]`);
			} else {
				lines.push(`${pad}${key}:`);
				for (const item of value) {
					if (typeof item === 'string') {
						lines.push(`${pad}  - ${JSON.stringify(item)}`);
					} else if (typeof item === 'object' && item !== null) {
						const sub = yamlToText(item as Record<string, unknown>, indent + 2);
						lines.push(`${pad}  - ${sub.trimStart()}`);
					}
				}
			}
		} else if (typeof value === 'object') {
			lines.push(`${pad}${key}:`);
			lines.push(yamlToText(value as Record<string, unknown>, indent + 1));
		} else if (typeof value === 'string' && (value.includes('\n') || value.length > 80)) {
			// Multi-line or long string → literal block scalar
			lines.push(`${pad}${key}: |`);
			for (const line of value.split('\n')) {
				lines.push(`${pad}  ${line}`);
			}
		} else if (typeof value === 'string') {
			lines.push(`${pad}${key}: ${JSON.stringify(value)}`);
		} else if (typeof value === 'number' || typeof value === 'boolean') {
			lines.push(`${pad}${key}: ${value}`);
		}
	}

	return lines.join('\n');
}
