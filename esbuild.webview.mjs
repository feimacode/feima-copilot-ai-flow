// @ts-check
import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
	entryPoints: {
		editor: 'webview-src/editor/index.tsx',
		gallery: 'webview-src/gallery/index.tsx',
	},
	bundle: true,
	outdir: 'out/webview',
	format: 'iife',
	platform: 'browser',
	target: 'es2020',
	sourcemap: watch ? 'inline' : false,
	minify: !watch,
	define: {
		'process.env.NODE_ENV': watch ? '"development"' : '"production"',
	},
	loader: {
		'.css': 'css',
		'.svg': 'dataurl',
		'.png': 'dataurl',
		'.woff': 'dataurl',
		'.woff2': 'dataurl',
		'.ttf': 'dataurl',
	},
	jsx: 'automatic',
};

if (watch) {
	const ctx = await esbuild.context(options);
	await ctx.watch();
	console.log('[esbuild] Watching webview-src for changes…');
} else {
	const result = await esbuild.build(options);
	if (result.errors.length > 0) {
		process.exit(1);
	}
	console.log('[esbuild] Webview bundle written to out/webview/');
}
