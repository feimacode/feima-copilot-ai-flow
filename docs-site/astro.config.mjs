import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
	site: 'https://flow-docs.feimacode.com',
	base: '/',
	integrations: [
		sitemap(),
		starlight({
			title: 'Copilot AI Flow',
			description: 'Multi-agent orchestration in VS Code — define AI workflows as version-controlled YAML files, run autonomous tool-using agents, get consistent repeatable results',
			head: [
				{
					tag: 'meta',
					attrs: { property: 'og:image', content: 'https://flow-docs.feimacode.com/assets/screenshots/flow-gallery.png' },
				},
				{
					tag: 'meta',
					attrs: { property: 'og:image:width', content: '976' },
				},
				{
					tag: 'meta',
					attrs: { property: 'og:image:height', content: '852' },
				},
				{
					tag: 'meta',
					attrs: { name: 'twitter:card', content: 'summary_large_image' },
				},
				{
					tag: 'script',
					attrs: { type: 'application/ld+json' },
					content: JSON.stringify({
						'@context': 'https://schema.org',
						'@type': 'SoftwareApplication',
						name: 'AI Flow - Multi-Agent Orchestration',
						operatingSystem: 'Windows, macOS, Linux',
						applicationCategory: 'DeveloperApplication',
						offers: {
							'@type': 'Offer',
							price: '0',
							priceCurrency: 'USD',
						},
						url: 'https://marketplace.visualstudio.com/items?itemName=feima.copilot-ai-flow',
					}),
				},
			],
			logo: {
				src: './src/assets/logo.svg',
			},
			social: {
				github: 'https://github.com/feimacode/feima-copilot-ai-flow',
			},
			editLink: {
				baseUrl: 'https://github.com/feimacode/feima-copilot-ai-flow/edit/main/docs-site/',
			},
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Installation', link: '/getting-started/installation/' },
						{ label: 'Quick Start', link: '/getting-started/quickstart/' },
					],
				},
				{
					label: 'Tutorials',
					items: [
						{
							label: 'Basic',
							collapsed: false,
							items: [
								{ label: 'Hello, Flow', link: '/tutorials/hello-world/' },
								{ label: 'Pipeline Basics', link: '/tutorials/pipeline-basics/' },
								{ label: 'Iteration & Convergence', link: '/tutorials/iteration-convergence/' },
								{ label: 'Fork-Join', link: '/tutorials/fork-join/' },
								{ label: 'Context Files', link: '/tutorials/context-files/' },
								{ label: 'Dialog Simulator', link: '/tutorials/dialog-simulator/' },
								{ label: 'Tool Control', link: '/tutorials/tool-control/' },
								{ label: 'Human Gate', link: '/tutorials/human-gate/' },
							],
						},
						{
							label: 'In Practice',
							collapsed: true,
							items: [
								{ label: 'Your First Flow', link: '/tutorials/your-first-flow/' },
								{ label: 'Make It Yours', link: '/tutorials/customize-flow/' },
								{ label: 'Connect to Jira', link: '/tutorials/jira-integration/' },
								{ label: 'Add Iteration', link: '/tutorials/staged-iteration/' },
								{ label: 'Go Autonomous', link: '/tutorials/cli-delegation/' },
							],
						},
						{
							label: 'Advanced',
							collapsed: true,
							items: [
								{ label: 'Quality Gates', link: '/tutorials/quality-gates/' },
								{ label: 'Efficiency Patterns', link: '/tutorials/efficiency-patterns/' },
								{ label: 'Autonomous Design', link: '/tutorials/autonomous-design/' },
								{ label: 'Case Study: Full-Cycle', link: '/tutorials/case-study-full-cycle/' },
							],
						},
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Choosing Execution Patterns', link: '/guides/execution-patterns/' },
						{ label: 'Referencing Files in Flows', link: '/guides/referencing-files/' },
						{ label: 'Flow Authoring Concepts', link: '/guides/flow-authoring/' },
						{ label: 'Tool Integration', link: '/guides/tool-integration/' },
					],
				},
			],

			customCss: [],
		}),
	],
});
