import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import { PROJECT_ROOT } from "#application/paths.ts"

test("mechanism imports neither policy nor application", async () => {
	const root = join(PROJECT_ROOT, "src/mechanism")
	const files = (await readdir(root)).filter((file) => file.endsWith(".ts"))
	for (const file of files) {
		const source = await readFile(join(root, file), "utf8")
		assert.equal(source.includes('from "#policy/'), false, `${file} imports policy`)
		assert.equal(source.includes('from "#application/'), false, `${file} imports application`)
	}
})

test("the executable surface has no shadow journal language", async () => {
	const sourceRoot = join(PROJECT_ROOT, "src")
	const directories = [
		sourceRoot,
		join(sourceRoot, "mechanism"),
		join(sourceRoot, "policy"),
		join(sourceRoot, "application")
	]
	const sources = await Promise.all(
		directories.map(async (directory) =>
			Promise.all(
				(await readdir(directory, { withFileTypes: true }))
					.filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
					.map((entry) => readFile(join(directory, entry.name), "utf8"))
			)
		)
	)
	for (const source of sources.flat()) {
		assert.equal(source.includes("defineEntry"), false)
		assert.equal(source.includes("parseLedgerEntry"), false)
	}
})

test("BumbleDB stays architecture-neutral with the Linux x64 binary locked", async () => {
	const manifest = await readFile(join(PROJECT_ROOT, "package.json"), "utf8")
	const lockfile = await readFile(join(PROJECT_ROOT, "pnpm-lock.yaml"), "utf8")
	assert.equal(manifest.includes('"@bjornpagen/bumbledb": "0.20.1"'), true)
	assert.equal(manifest.includes('"@bjornpagen/bumbledb-darwin-arm64"'), false)
	assert.equal(manifest.includes('"@bjornpagen/bumbledb-linux-arm64"'), false)
	assert.equal(manifest.includes('"@bjornpagen/bumbledb-linux-x64"'), false)
	assert.equal(lockfile.includes("'@bjornpagen/bumbledb-linux-x64@0.20.1':"), true)
})
