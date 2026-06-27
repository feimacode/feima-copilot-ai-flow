import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://starlight.astro.build/
export default defineConfig({
	site: 'https://feimacode.github.io',
	base: '/feima-copilot-ai-flow',
	integrations: [
		starlight({
			title: 'Copilot AI Flow',
			description: 'Orchestrate multiple AI roles in a single command',
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
