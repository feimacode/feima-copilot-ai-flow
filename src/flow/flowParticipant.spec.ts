/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowParticipant } from './flowParticipant';
import * as vscode from 'vscode';
import type { IFlowConfig } from './flowService';
import { FlowService } from './flowService';
import type { IFlowContext } from '../context/flowContextBuilder';
import { NullLogService } from '../platform/log/common/logService';

// Mock dependencies
vi.mock('./flowService');
vi.mock('../context/flowContextBuilder');
vi.mock('../session/flowConversation');
vi.mock('../prompts/flowPromptRenderer');
vi.mock('../util/copilotSdkExecutor');

// ── helpers ─────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<IFlowConfig> = {}): IFlowConfig {
	return {
		name: 'Test Flow',
		roles: [],
		sharedContext: '',
		promptUri: vscode.Uri.file('/test.flow.yaml'),
		...overrides
	} as IFlowConfig;
}

// ── FlowParticipant bootstrapping ────────────────────────────────────────────

describe('FlowParticipant', () => {
	let participant: FlowParticipant;
	let mockContext: vscode.ExtensionContext;

	beforeEach(() => {
		vi.clearAllMocks();

		mockContext = {
			subscriptions: [],
			extensionPath: '/test/path',
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn().mockReturnValue([]),
				setKeysForSync: vi.fn()
			} as unknown as vscode.Memento & { setKeysForSync(keys: readonly string[]): void },
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn().mockReturnValue([])
			} as unknown as vscode.Memento,
			secrets: {
				get: vi.fn(),
				store: vi.fn(),
				delete: vi.fn(),
				onDidChange: { dispose: vi.fn() } as unknown as vscode.Event<vscode.SecretStorageChangeEvent>
			} as unknown as vscode.SecretStorage,
			extensionUri: vscode.Uri.file('/test/path'),
			environmentVariableCollection: {
				get: vi.fn(),
				forEach: vi.fn(),
				replace: vi.fn(),
				append: vi.fn(),
				prepend: vi.fn(),
				delete: vi.fn(),
				clear: vi.fn(),
				getScoped: vi.fn(),
				[Symbol.iterator]: vi.fn()
			} as unknown as vscode.GlobalEnvironmentVariableCollection,
			extension: {} as vscode.Extension<unknown>,
			storageUri: undefined,
			globalStorageUri: vscode.Uri.file('/test/global'),
			logUri: vscode.Uri.file('/test/log'),
			extensionMode: vscode.ExtensionMode.Test,
			asAbsolutePath: (path: string) => `/test/path/${path}`,
			storagePath: undefined,
			globalStoragePath: '/test/global',
			logPath: '/test/log',
			languageModelAccessInformation: {} as vscode.LanguageModelAccessInformation
		};

		participant = new FlowParticipant(mockContext, new NullLogService());
	});

	it('should instantiate', () => {
		expect(participant).toBeDefined();
	});
});

// ── FlowService.validate() ───────────────────────────────────────────────────

describe('FlowService.validate() — fork-join structure', () => {
	let service: FlowService;

	beforeEach(() => {
		vi.unmock('./flowService');
		service = new FlowService();
	});

	it('accepts a valid parallel config with 2 groups and a join role', () => {
		const config = makeConfig({
			groups: [
				{ name: 'Group A', roles: [{ name: 'Role A', prompt: 'p' }] },
				{ name: 'Group B', roles: [{ name: 'Role B', prompt: 'p' }] }
			],
			join: { name: 'Synthesiser', prompt: 'Synthesise all outputs.' }
		});

		const { valid, errors } = service.validate(config);
		expect(errors).toEqual([]);
		expect(valid).toBe(true);
	});

	it('rejects parallel config missing groups', () => {
		const config = makeConfig({
			join: { name: 'Synthesiser', prompt: 'Synthesise.' }
		});

		const { valid, errors } = service.validate(config);
		expect(valid).toBe(false);
		expect(errors.some(e => e.includes('groups'))).toBe(true);
	});

	it('rejects parallel config with only 1 group', () => {
		const config = makeConfig({
			groups: [{ name: 'Solo', roles: [{ name: 'R', prompt: 'p' }] }],
			join: { name: 'Join', prompt: 'p' }
		});

		const { valid, errors } = service.validate(config);
		expect(valid).toBe(false);
		expect(errors.some(e => e.includes('groups'))).toBe(true);
	});

	it('rejects parallel config missing join role', () => {
		const config = makeConfig({
			groups: [
				{ name: 'A', roles: [{ name: 'R', prompt: 'p' }] },
				{ name: 'B', roles: [{ name: 'R', prompt: 'p' }] }
			]
		});

		const { valid, errors } = service.validate(config);
		expect(valid).toBe(false);
		expect(errors.some(e => e.includes('join'))).toBe(true);
	});

	it('rejects a group with no roles', () => {
		const config = makeConfig({
			groups: [
				{ name: 'A', roles: [] },
				{ name: 'B', roles: [{ name: 'R', prompt: 'p' }] }
			],
			join: { name: 'J', prompt: 'p' }
		});

		const { valid, errors } = service.validate(config);
		expect(valid).toBe(false);
		expect(errors.some(e => e.includes("group 'A'"))).toBe(true);
	});

	it('rejects a config with no root structure key (roles, stages, or groups)', () => {
		const config = makeConfig({ roles: [] });

		const { valid, errors } = service.validate(config);
		expect(valid).toBe(false);
		expect(errors.some(e => e.includes('exactly one root structure key'))).toBe(true);
	});
});

// ── FlowEngine.executeForkJoin() ─────────────────────────────────────────────

/** Minimal interface for spying on FlowEngine private methods in tests. */
interface IEngineInternals {
	callRole(role: { name: string; prompt: string; model?: string }, ...rest: unknown[]): Promise<{ content: string; model?: string; error?: string }>;
	buildAugmentedSystemPrompt(...args: unknown[]): Promise<string>;
	resolveContextFiles(...args: unknown[]): Promise<unknown[]>;
	resolveReferenceFiles(...args: unknown[]): Promise<unknown[]>;
	getFlowTools(...args: unknown[]): { tools: unknown[]; missingTools: string[] };
}

describe('FlowEngine.executeForkJoin() — group execution and join', () => {
	it('collects output from each group and passes it to the join role', async () => {
		const { FlowEngine } = await import('./flowEngine');
		const engine = new FlowEngine(new NullLogService());
		const eng = engine as unknown as IEngineInternals;

		const callRoleSpy = vi.spyOn(eng, 'callRole').mockImplementation(
			async role => ({ content: `output-from-${role.name}`, model: 'stub' })
		);
		vi.spyOn(eng, 'buildAugmentedSystemPrompt').mockResolvedValue('sys');
		vi.spyOn(eng, 'resolveContextFiles').mockResolvedValue([]);
		vi.spyOn(eng, 'resolveReferenceFiles').mockResolvedValue([]);
		vi.spyOn(eng, 'getFlowTools').mockReturnValue({ tools: [], missingTools: [] });

		const config = makeConfig({
			groups: [
				{ name: 'Alpha', roles: [{ name: 'Researcher', prompt: 'p' }] },
				{ name: 'Beta', roles: [{ name: 'Writer', prompt: 'p' }] }
			],
			join: { name: 'Synthesiser', prompt: 'Combine outputs.' }
		});

		const stream = {
			markdown: vi.fn(),
			progress: vi.fn()
		} as unknown as vscode.ChatResponseStream;
		const token = { isCancellationRequested: false } as vscode.CancellationToken;
		const vsCodeContext = { references: [] } as unknown as IFlowContext;

		const responses = await engine.executeForkJoin(
			config, 'query', vsCodeContext, [], stream, token, undefined, {} as vscode.LanguageModelChat
		);

		expect(responses.get('Alpha:Researcher')).toBe('output-from-Researcher');
		expect(responses.get('Beta:Writer')).toBe('output-from-Writer');
		expect(responses.has('join:Synthesiser')).toBe(true);

		// Join role must have received labeled context files for both groups
		const joinCall = callRoleSpy.mock.calls.find(args => {
			const role = args[0] as { name: string };
			return role.name === 'Synthesiser';
		});
		expect(joinCall).toBeDefined();
		const joinContextFiles = joinCall![4] as Array<{ label: string; content: string }>;
		expect(joinContextFiles.some(f => f.label === '[Group: Alpha]')).toBe(true);
		expect(joinContextFiles.some(f => f.label === '[Group: Beta]')).toBe(true);
	});

	it('continues remaining groups after a group failure and surfaces failure notice to join', async () => {
		const { FlowEngine } = await import('./flowEngine');
		const engine = new FlowEngine(new NullLogService());
		const eng = engine as unknown as IEngineInternals;

		vi.spyOn(eng, 'callRole').mockImplementation(async role => {
			if (role.name === 'Broken') {
				throw new Error('group exploded');
			}
			return { content: `ok-${role.name}`, model: 'stub' };
		});
		vi.spyOn(eng, 'buildAugmentedSystemPrompt').mockResolvedValue('sys');
		vi.spyOn(eng, 'resolveContextFiles').mockResolvedValue([]);
		vi.spyOn(eng, 'resolveReferenceFiles').mockResolvedValue([]);
		vi.spyOn(eng, 'getFlowTools').mockReturnValue({ tools: [], missingTools: [] });

		const config = makeConfig({
			groups: [
				{ name: 'FailGroup', roles: [{ name: 'Broken', prompt: 'p' }] },
				{ name: 'OkGroup', roles: [{ name: 'Fine', prompt: 'p' }] }
			],
			join: { name: 'Judge', prompt: 'Evaluate.' }
		});

		const stream = { markdown: vi.fn(), progress: vi.fn() } as unknown as vscode.ChatResponseStream;
		const token = { isCancellationRequested: false } as vscode.CancellationToken;
		const vsCodeContext = { references: [] } as unknown as IFlowContext;

		const responses = await engine.executeForkJoin(
			config, 'q', vsCodeContext, [], stream, token, undefined, {} as vscode.LanguageModelChat
		);

		// OkGroup should still produce output despite FailGroup failing
		expect(responses.get('OkGroup:Fine')).toBe('ok-Fine');
		// Join must still execute
		expect(responses.has('join:Judge')).toBe(true);

		// Failure notice streamed to chat
		const markdownCalls = (stream.markdown as ReturnType<typeof vi.fn>).mock.calls;
		expect(markdownCalls.some(args => {
			const text = args[0] as string;
			return text.includes('FailGroup') && text.includes('failed');
		})).toBe(true);
	});
});
