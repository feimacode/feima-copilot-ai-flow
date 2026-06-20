/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { CatalogClient, ICatalogFlow, ICatalogProvider } from './catalogClient';
import { IFlowEntry, catalogFlowToEntry } from './flowSource';

/**
 * CatalogSource provides flows from the harness catalog index.json.
 * These are production-ready flows from the community, installable to workspaces.
 */
export class CatalogSource {
	private entries: IFlowEntry[] | undefined;

	constructor(private readonly catalogClient: CatalogClient) { }

	/**
	 * Get all catalog flow entries (cached after first load).
	 */
	async getAll(): Promise<IFlowEntry[]> {
		if (this.entries) {
			return this.entries;
		}

		const index = await this.catalogClient.getIndex();
		const providerMap = this.buildProviderMap(index.providers);
		this.entries = this.convertFlows(index.flows, providerMap);
		return this.entries;
	}

	/**
	 * Find a catalog flow by id.
	 */
	async find(id: string): Promise<IFlowEntry | undefined> {
		const all = await this.getAll();
		return all.find(f => f.id === id);
	}

	/**
	 * Search catalog flows by query (matches name, description, tags, provider).
	 */
	async search(query: string): Promise<IFlowEntry[]> {
		const all = await this.getAll();
		const q = query.toLowerCase();
		return all.filter(f =>
			f.name.toLowerCase().includes(q) ||
			f.description?.toLowerCase().includes(q) ||
			f.tags?.some(t => t.toLowerCase().includes(q)) ||
			f.provider?.toLowerCase().includes(q) ||
			f.category?.toLowerCase().includes(q)
		);
	}

	/**
	 * Force reload from catalog client (which may fetch fresh data).
	 */
	async refresh(forceFetch: boolean = false): Promise<IFlowEntry[]> {
		this.entries = undefined;
		await this.catalogClient.getIndex(forceFetch);
		return this.getAll();
	}

	/**
	 * Get flows filtered by provider.
	 */
	async getByProvider(provider: string): Promise<IFlowEntry[]> {
		const all = await this.getAll();
		return all.filter(f => f.provider === provider);
	}

	/**
	 * Get flows filtered by trust level.
	 */
	async getByTrust(trust: 'official' | 'community'): Promise<IFlowEntry[]> {
		const all = await this.getAll();
		return all.filter(f => f.trust === trust);
	}

	/**
	 * Get flows filtered by orchestration pattern.
	 */
	async getByOrchestration(orchestration: 'sequence' | 'staged' | 'fork-join'): Promise<IFlowEntry[]> {
		const all = await this.getAll();
		return all.filter(f => f.orchestration === orchestration);
	}

	private convertFlows(
		flows: readonly ICatalogFlow[],
		providers: Record<string, { name: string; trust: 'official' | 'community' }>
	): IFlowEntry[] {
		return flows.map(flow => {
			const provider = flow.provider || 'unknown';
			const providerInfo = providers[provider];
			const trust = providerInfo?.trust || 'community';

			return catalogFlowToEntry(flow, provider, trust);
		});
	}

	private buildProviderMap(
		providers: readonly ICatalogProvider[]
	): Record<string, { name: string; trust: 'official' | 'community' }> {
		const map: Record<string, { name: string; trust: 'official' | 'community' }> = {};
		for (const p of providers) {
			map[p.name] = { name: p.name, trust: p.trust };
		}
		return map;
	}
}
