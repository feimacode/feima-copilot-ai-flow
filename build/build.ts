#!/usr/bin/env node
/**
 * Build script for feima-copilot-ai-flow
 * 
 * Compiles the extension (tsc + esbuild webview), packages a VSIX
 * with @vscode/vsce, generates a SHA-256 checksum, and validates
 * the output.
 * 
 * Usage:
 *   npm run build:vsix
 *   tsx build/build.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function readPackageJson(): { version: string; name: string } {
	const pkgPath = path.join(PROJECT_ROOT, 'package.json');
	return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
}

function compile(): void {
	console.log('🔨 Compiling extension...');
	execSync('npx tsc -p ./', { cwd: PROJECT_ROOT, stdio: 'inherit' });
	console.log('🔨 Bundling webview...');
	execSync('node esbuild.webview.mjs', { cwd: PROJECT_ROOT, stdio: 'inherit' });
	console.log('✅ Compilation complete\n');
}

function fetchCatalogIndex(): void {
	console.log('📥 Fetching catalog index...');

	const assetsDir = path.join(PROJECT_ROOT, 'assets');
	fs.mkdirSync(assetsDir, { recursive: true });

	const indexUrl = 'https://raw.githubusercontent.com/feimacode/feima-harness-catalog/main/index.json';
	const indexPath = path.join(assetsDir, 'index.json');

	try {
		execSync(`curl -sL --max-time 15 -o "${indexPath}" "${indexUrl}"`, {
			cwd: PROJECT_ROOT,
			stdio: 'pipe',
		});

		if (!fs.existsSync(indexPath) || fs.statSync(indexPath).size === 0) {
			throw new Error('Downloaded index.json is empty');
		}

		// Validate the downloaded index
		execSync(`node scripts/validate-index.js "${indexPath}"`, {
			cwd: PROJECT_ROOT,
			stdio: 'inherit',
		});

		const sizeKB = (fs.statSync(indexPath).size / 1024).toFixed(1);
		console.log(`✅ Catalog index fetched and validated (${sizeKB} KB)\n`);
	} catch (err) {
		console.warn(`⚠️  Failed to fetch catalog index: ${err instanceof Error ? err.message : String(err)}`);
		console.warn('   The extension will use an empty fallback index.\n');

		// Write an empty index as fallback
		const emptyIndex = {
			version: 1,
			updated: new Date().toISOString(),
			providers: [],
			skills: [],
			prompts: [],
			flows: [],
		};
		fs.writeFileSync(indexPath, JSON.stringify(emptyIndex, null, '\t'));
	}
}

function packageVsix(version: string): string {
	console.log('📦 Packaging VSIX...');

	const distDir = path.join(PROJECT_ROOT, 'dist');
	fs.mkdirSync(distDir, { recursive: true });

	const vsixPath = path.join(distDir, `feima-copilot-ai-flow-${version}.vsix`);

	const cmd = `npx @vscode/vsce package --allow-star-activation --no-dependencies --out "${vsixPath}"`;
	execSync(cmd, { cwd: PROJECT_ROOT, stdio: 'inherit' });

	if (!fs.existsSync(vsixPath)) {
		throw new Error('VSIX file was not created');
	}

	const stats = fs.statSync(vsixPath);
	const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
	console.log(`✅ VSIX created: ${path.basename(vsixPath)} (${sizeMB} MB)`);

	return vsixPath;
}

function generateChecksum(vsixPath: string): string {
	console.log('🔐 Generating SHA-256 checksum...');

	const checksumPath = `${vsixPath}.sha256`;
	let cmd: string;

	if (process.platform === 'darwin') {
		cmd = `shasum -a 256 "${vsixPath}" > "${checksumPath}"`;
	} else {
		cmd = `sha256sum "${vsixPath}" > "${checksumPath}"`;
	}

	execSync(cmd, { cwd: PROJECT_ROOT, stdio: 'pipe' });

	if (!fs.existsSync(checksumPath)) {
		throw new Error('Checksum file was not created');
	}

	const checksum = fs.readFileSync(checksumPath, 'utf-8').trim();
	const shortHash = checksum.split(' ')[0].substring(0, 16);
	console.log(`✅ Checksum: ${shortHash}...`);

	return checksumPath;
}

function validateVsix(vsixPath: string): boolean {
	console.log('🔍 Validating VSIX...');

	let valid = true;

	// Size check
	const stats = fs.statSync(vsixPath);
	const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
	if (stats.size > MAX_SIZE_BYTES) {
		console.warn(`⚠️  Warning: VSIX (${sizeMB} MB) exceeds ${MAX_SIZE_MB} MB limit`);
	} else {
		console.log(`✅ Size: ${sizeMB} MB (under ${MAX_SIZE_MB} MB limit)`);
	}

	// Structure check — VSIX is a ZIP file
	try {
		const output = execSync(
			`unzip -l "${vsixPath}" | grep -E "extension.vsixmanifest|package.json"`,
			{ cwd: PROJECT_ROOT, stdio: 'pipe' }
		).toString();

		if (!output.includes('extension.vsixmanifest') || !output.includes('package.json')) {
			console.error('❌ VSIX is missing required files');
			valid = false;
		} else {
			console.log('✅ VSIX structure valid');
		}
	} catch {
		console.error('❌ Failed to validate VSIX structure');
		valid = false;
	}

	return valid;
}

function main(): void {
	console.log('🚀 feima-copilot-ai-flow Build System\n');

	const pkg = readPackageJson();
	console.log(`   Extension: ${pkg.name}`);
	console.log(`   Version: ${pkg.version}\n`);

	// Step 1: Compile
	compile();

	// Step 2: Fetch catalog index
	fetchCatalogIndex();

	// Step 3: Package
	const vsixPath = packageVsix(pkg.version);

	// Step 3: Checksum
	generateChecksum(vsixPath);

	// Step 4: Validate
	const valid = validateVsix(vsixPath);
	if (!valid) {
		console.error('\n❌ Build failed validation');
		process.exit(1);
	}

	console.log('\n✅ Build complete');
	console.log(`   VSIX:  dist/${path.basename(vsixPath)}`);
	console.log(`   SHA:   dist/${path.basename(vsixPath)}.sha256`);
}

try {
	main();
} catch (err) {
	console.error('❌ Build failed:', err instanceof Error ? err.message : err);
	process.exit(1);
}
