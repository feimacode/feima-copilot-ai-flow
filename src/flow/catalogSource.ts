/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { CatalogClient, ICatalogFlow, ICatalogProvider } from './catalogClient';
import { IFlowEntry, catalogFlowToEntry } from './flowSource';
import { FlowSourceBase } from './flowSourceBase';

/**
 * CatalogSource provides flows from the harness catalog index.json.
 * These are production-ready flows from the community, installable to workspaces.
 */
export class CatalogSource extends FlowSourceBase {

	constructor(private readonly catalogClient: CatalogClient) {
		super();
	}

	protected async load(): Promise<IFlowEntry[]> {
		const index = await this.catalogClient.getIndex();
		return this.convertFlows(index.flows, this.buildProviderMap(index.providers));
	}

	/** Force reload from catalog client (which may fetch fresh data). */
	async refresh(forceFetch: boolean = false): Promise<IFlowEntry[]> {
		this.entries = undefined;
		await this.catalogClient.getIndex(forceFetch);
		return this.getAll();
	}

	/** Get flows filtered by provider. */
	async getByProvider(provider: string): Promise<IFlowEntry[]> {
		const all = await this.getAll();
		return all.filter(f => f.provider === provider);
	}

	/** Get flows filtered by trust level. */
	async getByTrust(trust: 'official' | 'community'): Promise<IFlowEntry[]> {
		const all = await this.getAll();
		return all.filter(f => f.trust === trust);
	}

	/** Get flows filtered by orchestration pattern. */
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
