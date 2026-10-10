import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import { PROJECT_ROOT } from "#application/paths.ts"

test("assertion rule rejects casts without rejecting import/export aliases or const literals", async (t) => {
	const root = await mkdtemp(join(PROJECT_ROOT, "test/lint-test-"))
	t.after(() => rm(root, { recursive: true, force: true }))
	for (const [name, source, rejected] of [
		["cast", 'export const value = "123" as unknown as number\n', true],
		["const", 'export const value = "123" as const\n', false],
		["import", 'import { Schema as BumbleSchema } from "@bjornpagen/bumbledb"\nexport { BumbleSchema }\n', false],
		["export", 'export { Schema as BumbleSchema } from "@bjornpagen/bumbledb"\n', false]
	] as const) {
		const path = join(root, `${name}.ts`)
		await writeFile(path, source)
		const result = await new Promise<{ failed: boolean; output: string }>((complete) => {
			execFile(
				process.execPath,
				[join(PROJECT_ROOT, "node_modules/@biomejs/biome/bin/biome"), "lint", path],
				{ cwd: PROJECT_ROOT, timeout: 10_000 },
				(error, stdout, stderr) => complete({ failed: error !== null, output: stdout + stderr })
			)
		})
		assert.equal(result.failed, rejected, `${name}: ${result.output}`)
		assert.equal(result.output.includes("Type assertions are banned"), rejected, name)
	}
})
