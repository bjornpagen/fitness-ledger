import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { after } from "node:test"
import { key, relation, schema, uuid } from "@bjornpagen/bumbledb"
import { Db } from "@bjornpagen/bumbledb/engine"
import { Effect, Exit, ManagedRuntime } from "effect"
import { DatabaseRuntime } from "#application/database.ts"
import { describeFailure, run } from "#application/ops.ts"
import { PRIVATE_ROOT } from "#application/paths.ts"
import { parseInstant } from "#mechanism/dates.ts"

/* Ops in-process, exactly as `node src/application/cli.ts <op> '<json>'` runs them: one shared
 * runtime, a scratch ledger per scenario under private/, a fixed clock, and JSON in and out.
 * Synthetic data only. */

const runtime = ManagedRuntime.make(DatabaseRuntime)
mkdirSync(PRIVATE_ROOT, { recursive: true, mode: 0o700 })
const scratch = mkdtempSync(join(PRIVATE_ROOT, "ops-test-"))
after(async () => {
	await runtime.dispose()
	rmSync(scratch, { recursive: true, force: true })
})
let ledgers = 0

/** A ledger in a scratch directory with its own clock; `at` moves the clock. */
export async function ledger(now = "2026-10-12T07:02:00-05:00") {
	const handle = at(join(scratch, `ledger-${++ledgers}`), now)
	await handle.op("db.create")
	return handle
}

/** A store created under another theory, as an old or foreign ledger would be. */
export async function foreignLedger(now = "2026-10-12T07:02:00-05:00") {
	const store = join(scratch, `foreign-${++ledgers}`)
	const Other = relation("Other", { id: uuid })
	await runtime.runPromise(Effect.scoped(Db.create(store, schema("Foreign", { Other }, [key(Other, ["id"])]))))
	return at(store, now)
}

function at(store: string, now: string) {
	let clock = parseInstant(now)
	const exec = (name: string, payload: object) =>
		runtime.runPromiseExit(run(name, JSON.parse(JSON.stringify(payload)), { store, now: clock }))
	const handle = {
		store,
		at(time: string) {
			clock = parseInstant(time)
			return handle
		},
		/** One op that must succeed; its output as the CLI prints it. */
		async op(name: string, payload: object = {}) {
			const exit = await exec(name, payload)
			if (Exit.isFailure(exit)) return assert.fail(`${name}: ${JSON.stringify(describeFailure(exit.cause))}`)
			return JSON.parse(JSON.stringify(exit.value))
		},
		/** One op that must refuse; its `{code, message}`. */
		async refused(name: string, payload: object = {}) {
			const exit = await exec(name, payload)
			if (Exit.isSuccess(exit)) return assert.fail(`${name} succeeded: ${JSON.stringify(exit.value)}`)
			return describeFailure(exit.cause)
		}
	}
	return handle
}
