#!/usr/bin/env -S node

import { NodeRuntime } from "@effect/platform-node"
import { Console, Data, Effect } from "effect"
import { openFitnessDatabase } from "#application/database.ts"
import { STORE_PATH } from "#application/paths.ts"
import { renderPlan, renderStatus } from "#application/report.ts"
import { syncWhoopSnapshot } from "#application/whoop.ts"
import { renderUnknownFailure } from "#mechanism/failure.ts"
import { fetchWhoopSnapshot } from "#mechanism/whoop-client.ts"

class UsageFailure extends Data.TaggedError("UsageFailure")<{ readonly message: string }> {}

class CommandFailure extends Data.TaggedError("CommandFailure")<{
	readonly message: string
	readonly cause?: unknown
}> {}

function usage(message: string): Effect.Effect<never, UsageFailure> {
	return Effect.fail(new UsageFailure({ message }))
}

const showPlan = Effect.gen(function* () {
	const output = yield* Effect.try({
		try: () => renderPlan(),
		catch: (cause) => new CommandFailure({ message: "failed to render plan", cause })
	})
	yield* Console.log(output)
})

const showStatus = Effect.gen(function* () {
	const database = yield* Effect.tryPromise({
		try: () => openFitnessDatabase(STORE_PATH),
		catch: (cause) => new CommandFailure({ message: `failed to open ${STORE_PATH}`, cause })
	})
	const output = yield* Effect.try({
		try: () => renderStatus(database),
		catch: (cause) => new CommandFailure({ message: "failed to render status", cause })
	})
	yield* Console.log(output)
})

const whoopSync = (start: string, end: string) =>
	Effect.gen(function* () {
		const accessToken = process.env.WHOOP_ACCESS_TOKEN
		if (accessToken === undefined || accessToken.length === 0) {
			return yield* usage("WHOOP_ACCESS_TOKEN is required in the process environment")
		}
		const snapshot = yield* Effect.tryPromise({
			try: () => fetchWhoopSnapshot(accessToken, start, end),
			catch: (cause) => new CommandFailure({ message: "failed to fetch the WHOOP workout/sleep boundary", cause })
		})
		const database = yield* Effect.tryPromise({
			try: () => openFitnessDatabase(STORE_PATH),
			catch: (cause) => new CommandFailure({ message: `failed to open ${STORE_PATH}`, cause })
		})
		const summary = yield* Effect.try({
			try: () => syncWhoopSnapshot(database, snapshot),
			catch: (cause) => new CommandFailure({ message: "failed to sync trusted WHOOP fields", cause })
		})
		yield* Console.log(
			`WHOOP sync: ${summary.workoutsImported} workouts imported, ${summary.workoutsSkipped} skipped; ${summary.sleepsImported} sleeps imported, ${summary.sleepsSkipped} skipped`
		)
	})

const args = process.argv.slice(2).filter((argument) => argument !== "--")
const command = args[0]
const main: Effect.Effect<void, UsageFailure | CommandFailure> = (() => {
	switch (command) {
		case "plan":
			return args.length === 1 ? showPlan : usage("plan takes no arguments")
		case "status":
			return args.length === 1 ? showStatus : usage("status takes no arguments")
		case "whoop:sync": {
			const start = args[1]
			const end = args[2]
			return start !== undefined && end !== undefined && args.length === 3
				? whoopSync(start, end)
				: usage("whoop:sync requires start and end ISO timestamps with offsets")
		}
		default:
			return usage("usage: pnpm plan | pnpm status | pnpm whoop:sync -- <start> <end>")
	}
})()

NodeRuntime.runMain(
	Effect.catch(main, (error) =>
		Effect.gen(function* () {
			yield* Console.error(renderUnknownFailure(error))
			if ("cause" in error && error.cause !== undefined) yield* Console.error(renderUnknownFailure(error.cause))
			process.exitCode = 1
		})
	)
)
