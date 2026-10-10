#!/usr/bin/env -S node

import { NodeRuntime } from "@effect/platform-node"
import { Effect, Exit } from "effect"
import { DatabaseRuntime } from "#application/database.ts"
import { describeFailure, parsePayload, run, summaries } from "#application/ops.ts"
import { storePath } from "#application/paths.ts"
import { FitnessLedgerFailure, refuse, renderUnknownFailure } from "#mechanism/failure.ts"

/**
 * node src/application/cli.ts <op> ['<json>']
 *
 * One op, one JSON object in, one JSON object out on stdout. A refusal prints {code, message} on
 * stderr and exits 1. With no op, prints every op with its summary.
 */

const main = Effect.gen(function* () {
	const [name, json, ...rest] = process.argv.slice(2)
	if (name === undefined) return summaries()
	if (rest.length > 0) return yield* refuse("Usage", "node src/application/cli.ts <op> '<json>'")
	const payload = yield* parsePayload(json)
	const store = yield* Effect.try({
		try: storePath,
		catch: (cause) =>
			cause instanceof FitnessLedgerFailure
				? cause
				: new FitnessLedgerFailure({ code: "InvalidPath", message: renderUnknownFailure(cause), cause })
	})
	return yield* run(name, payload, { store, now: BigInt(Date.now()) })
})

NodeRuntime.runMain(
	main.pipe(
		Effect.provide(DatabaseRuntime),
		Effect.exit,
		Effect.flatMap((exit) =>
			Effect.sync(() => {
				if (Exit.isSuccess(exit)) {
					process.stdout.write(`${JSON.stringify(exit.value, null, 2)}\n`)
					return
				}
				process.stderr.write(`${JSON.stringify(describeFailure(exit.cause), null, 2)}\n`)
				process.exitCode = 1
			})
		)
	)
)
