import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import { PRIVATE_ROOT, PROJECT_ROOT } from "#application/paths.ts"

function cli(args: readonly string[], store: string) {
	return new Promise<{ code: number | string; stdout: string; stderr: string }>((complete) => {
		execFile(
			process.execPath,
			[join(PROJECT_ROOT, "src/application/cli.ts"), ...args],
			{
				cwd: PROJECT_ROOT,
				encoding: "utf8",
				timeout: 15_000,
				maxBuffer: 512 * 1024,
				env: { ...process.env, FITNESS_LEDGER_STORE: store, NODE_OPTIONS: "" }
			},
			(error, stdout, stderr) => complete({ code: error === null ? 0 : (error.code ?? 1), stdout, stderr })
		)
	})
}

test("the CLI prints one JSON object on success and {code, message} on stderr with exit 1 on refusal", async (t) => {
	await mkdir(PRIVATE_ROOT, { recursive: true, mode: 0o700 })
	const root = await mkdtemp(join(PRIVATE_ROOT, "cli-test-"))
	t.after(() => rm(root, { recursive: true, force: true }))
	const store = join(root, "database")

	const listing = await cli([], store)
	assert.equal(listing.code, 0, listing.stderr)
	const ops: unknown = JSON.parse(listing.stdout)
	assert.ok(Array.isArray(ops) && ops.some((entry) => entry.op === "set.record"))

	const refusals = await Promise.all([
		cli(["status"], store),
		cli(["no.such.op"], store),
		cli(["next", "{not json"], store),
		cli(["next", "{}", "extra"], store),
		cli(["db.create"], join(PROJECT_ROOT, "database-outside-private"))
	])
	assert.deepEqual(
		refusals.map((result) => {
			assert.notEqual(result.code, 0)
			assert.equal(result.stdout, "")
			const failure: unknown = JSON.parse(result.stderr)
			assert.ok(typeof failure === "object" && failure !== null && "code" in failure && "message" in failure)
			return failure.code
		}),
		["NoLedger", "UnknownOp", "InvalidJson", "Usage", "InvalidPath"]
	)
	assert.equal((await readdir(root)).includes("database"), false)
	assert.equal((await readdir(PROJECT_ROOT)).includes("database-outside-private"), false)

	const created = await cli(["db.create"], store)
	assert.equal(created.code, 0, created.stderr)
	assert.equal(JSON.parse(created.stdout).outcome, "committed")
	const started = await cli(["session.start", '{"at":"2026-10-12T07:02-05:00"}'], store)
	assert.equal(started.code, 0, started.stderr)
	assert.equal(JSON.parse(started.stdout).start, "2026-10-12T07:02-05:00")
	const next = await cli(["next"], store)
	assert.equal(next.code, 0, next.stderr)
	assert.equal(JSON.parse(next.stdout).exercise.id, "cl-2403-seated-leg-press")
})
