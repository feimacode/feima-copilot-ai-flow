import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['src/**/*.spec.ts'],
		exclude: [
			'**/node_modules/**',
			'**/dist/**',
			'**/out/**',
			'**/.vscode/**'
		],
		setupFiles: ['./src/test/setup.ts'],
	},
	resolve: {
		alias: {
			vscode: path.resolve(__dirname, 'src/test/vscode-shim.ts')
		}
	}
});
