import assert from "node:assert/strict"
import { readdir, readFile, realpath } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import { regex } from "arkregex"
import { createScanner, SyntaxKind } from "typescript/unstable/ast"
import { PROJECT_ROOT } from "#application/paths.ts"
import { isWithin } from "#mechanism/paths.ts"

function moduleSpecifiers(source: string): readonly string[] {
	const scanner = createScanner(true, undefined, source)
	const tokens: { kind: SyntaxKind; value: string }[] = []
	const specifiers: string[] = []
	for (let kind = scanner.scan(); kind !== SyntaxKind.EndOfFile; kind = scanner.scan()) {
		const last = tokens.at(-1)
		const before = tokens.at(-2)
		if (
			kind === SyntaxKind.StringLiteral &&
			(last?.kind === SyntaxKind.FromKeyword ||
				last?.kind === SyntaxKind.ImportKeyword ||
				(last?.kind === SyntaxKind.OpenParenToken &&
					(before?.kind === SyntaxKind.ImportKeyword || before?.value === "require")))
		)
			specifiers.push(scanner.getTokenValue())
		tokens.push({ kind, value: scanner.getTokenValue() })
	}
	return specifiers
}

test("dependency scanner covers quotes, side effects, reexports, type imports, and ignores comments", () => {
	assert.deepEqual(
		moduleSpecifiers(`
		import { value } from '#policy/example.ts'
		import "#application/side-effect.ts"
		export * from '../application/example.ts'
		import type { T } from "../policy/example.ts"
		// import { ignored } from "ignored"
		/* export * from "also-ignored" */
	`),
		["#policy/example.ts", "#application/side-effect.ts", "../application/example.ts", "../policy/example.ts"]
	)
})

test("mechanism imports neither policy nor application, including nested files and relative barrels", async () => {
	const root = join(PROJECT_ROOT, "src/mechanism")
	const files = (await readdir(root, { recursive: true })).filter((file) => file.endsWith(".ts"))
	for (const file of files) {
		const absolute = join(root, file)
		for (const specifier of moduleSpecifiers(await readFile(absolute, "utf8"))) {
			const url = specifier.startsWith(".")
				? new URL(specifier, pathToFileURL(absolute)).href
				: import.meta.resolve(specifier)
			if (!url.startsWith("file:")) continue
			const target = await realpath(fileURLToPath(url))
			assert.ok(
				!isWithin(join(PROJECT_ROOT, "src"), target) || isWithin(root, target),
				`${file} imports higher layer through ${specifier}`
			)
		}
	}
})

test("BumbleDB stays architecture-neutral with every supported native binary locked to its version", async () => {
	const manifest = await readFile(join(PROJECT_ROOT, "package.json"), "utf8")
	const lockfile = await readFile(join(PROJECT_ROOT, "pnpm-lock.yaml"), "utf8")
	const version = manifest.match(regex('"@bjornpagen/bumbledb":\\s*"([0-9]+\\.[0-9]+\\.[0-9]+)"'))?.[1]
	assert.ok(version !== undefined)
	for (const platform of ["darwin-arm64", "linux-arm64", "linux-x64"]) {
		assert.equal(manifest.includes(`"@bjornpagen/bumbledb-${platform}"`), false)
		assert.equal(lockfile.includes(`'@bjornpagen/bumbledb-${platform}@${version}':`), true)
	}
})

test("the manifest exposes the op CLI and the BumbleDB core package", async () => {
	const manifest: unknown = JSON.parse(await readFile(join(PROJECT_ROOT, "package.json"), "utf8"))
	assert.ok(typeof manifest === "object" && manifest !== null)
	assert.ok("scripts" in manifest && typeof manifest.scripts === "object" && manifest.scripts !== null)
	assert.deepEqual(Object.keys(manifest.scripts).toSorted(), [
		"check",
		"format",
		"ledger",
		"lint",
		"sources:extract-text",
		"test",
		"typecheck"
	])
	assert.ok("dependencies" in manifest && typeof manifest.dependencies === "object" && manifest.dependencies !== null)
	assert.deepEqual(Object.keys(manifest.dependencies).toSorted(), [
		"@bjornpagen/bumbledb",
		"@effect/platform-node",
		"arkregex",
		"effect",
		"uuid"
	])
	const tsconfig = await readFile(join(PROJECT_ROOT, "tsconfig.json"), "utf8")
	assert.equal(tsconfig.includes("private/"), false)
})
