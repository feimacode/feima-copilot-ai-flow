/*---------------------------------------------------------------------------------------------
 *  Copyright (c) IX. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

export interface IPromptInfo {
	id: string;
	name: string;
	description: string;
	category: string;
	subcategory?: string;
	filePath: string;
	tags: string[];
	difficulty?: string;
	rolesCount: number;
	featured?: boolean;
}

export interface ICategoryInfo {
	id: string;
	name: string;
	description: string;
	icon: string;
	subcategories?: ISubcategoryInfo[];
	prompts?: string[]; // prompt IDs
}

export interface ISubcategoryInfo {
	id: string;
	name: string;
	prompts: string[];
}

/**
 * Tree view provider for the prompt library
 */
export class LibraryTreeProvider implements vscode.TreeDataProvider<LibraryItem> {
	
	private _onDidChangeTreeData = new vscode.EventEmitter<LibraryItem | undefined>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
	
	constructor(private context: vscode.ExtensionContext) {}
	
	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}
	
	getTreeItem(element: LibraryItem): vscode.TreeItem {
		return element;
	}
	
	async getChildren(element?: LibraryItem): Promise<LibraryItem[]> {
		if (!element) {
			// Root level: show categories
			return this.getCategories();
		}
		
		if (element.contextValue === 'category') {
			// Show subcategories or prompts
			return this.getCategoryChildren(element.id!);
		}
		
		if (element.contextValue === 'subcategory') {
			// Show prompts in subcategory
			return this.getPromptsInSubcategory(element.categoryId!, element.id!);
		}
		
		return [];
	}
	
	private async getCategories(): Promise<LibraryItem[]> {
		const categories: LibraryItem[] = [
			// Featured category disabled until prompts are marked as featured
			// new LibraryItem(
			// 	'⭐ Featured',
			// 	'featured',
			// 	vscode.TreeItemCollapsibleState.Expanded,
			// 	'category'
			// ),
			new LibraryItem(
				'💻 Software Development',
				'software-development',
				vscode.TreeItemCollapsibleState.Collapsed,
				'category'
			),
			new LibraryItem(
				'💼 Business & Strategy',
				'business',
				vscode.TreeItemCollapsibleState.Collapsed,
				'category'
			),
			new LibraryItem(
				'🎨 Design & UX',
				'design',
				vscode.TreeItemCollapsibleState.Collapsed,
				'category'
			),
			new LibraryItem(
				'📚 Education & Learning',
				'education',
				vscode.TreeItemCollapsibleState.Collapsed,
				'category'
			),
			new LibraryItem(
				'💡 Creative & Brainstorming',
				'creative',
				vscode.TreeItemCollapsibleState.Collapsed,
				'category'
			),
			new LibraryItem(
				'⚙️ Operations & SRE',
				'operations',
				vscode.TreeItemCollapsibleState.Collapsed,
				'category'
			)
		];
		
		return categories;
	}
	
	private async getCategoryChildren(categoryId: string): Promise<LibraryItem[]> {
		const extensionPath = this.context.extensionPath;
		const promptsPath = path.join(extensionPath, 'prompts', categoryId);
		
		try {
			const uri = vscode.Uri.file(promptsPath);
			const entries = await vscode.workspace.fs.readDirectory(uri);
			
			const items: LibraryItem[] = [];
			for (const [name, type] of entries) {
				if (type === vscode.FileType.File && name.endsWith('.prompt.md')) {
					const promptName = name.replace('.prompt.md', '');
					const displayName = promptName
						.split('-')
						.map(word => word.charAt(0).toUpperCase() + word.slice(1))
						.join(' ');
					
					const item = new LibraryItem(
						displayName,
						promptName,
						vscode.TreeItemCollapsibleState.None,
						'prompt'
					);
					item.categoryId = categoryId;
					item.filePath = path.join(promptsPath, name);
					item.command = {
						command: 'copilot-ai-panel.usePrompt',
						title: 'Use Prompt',
						arguments: [item]
					};
					items.push(item);
				}
			}
			
			return items;
		} catch {
			return [];
		}
	}
	
	private async getPromptsInSubcategory(categoryId: string, subcategoryId: string): Promise<LibraryItem[]> {
		// For now, return empty. Will implement subcategories later
		return [];
	}
}

export class LibraryItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly id: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly contextValue: string,
		public categoryId?: string,
		public filePath?: string
	) {
		super(label, collapsibleState);
		
		if (contextValue === 'prompt') {
			this.iconPath = new vscode.ThemeIcon('file');
			this.tooltip = `Use this prompt in chat with @panel`;
		} else if (contextValue === 'category') {
			this.tooltip = `Browse ${label} prompts`;
		}
	}
}
