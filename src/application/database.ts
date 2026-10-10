import {
	Bumble,
	type BumbleOptions,
	type ParamsRecord,
	type QueryReader,
	type QueryTemplate
} from "@bjornpagen/bumbledb"
import { Db } from "@bjornpagen/bumbledb/engine"
import { Effect } from "effect"
import { assertStoreDestination } from "#application/paths.ts"
import { FitnessLedger } from "#application/schema.ts"
import { FitnessLedgerFailure } from "#mechanism/failure.ts"

const databaseRuntimeOptions = {
	workers: 2,
	queueCapacity: 64,
	cleanupCapacity: 64,
	ownerCapacity: 128,
	nativeHandleCapacity: 512,
	cleanupTimeout: "10 seconds"
} satisfies BumbleOptions

/** The one native runtime per process; BumbleDB refuses a second live one. */
export const DatabaseRuntime = Bumble.layer(databaseRuntimeOptions)

const privateStore = (storePath: string) =>
	Effect.tryPromise({
		try: () => assertStoreDestination(storePath),
		catch: (cause) =>
			cause instanceof FitnessLedgerFailure
				? cause
				: new FitnessLedgerFailure({ code: "InvalidPath", message: "cannot resolve the store path", cause })
	})

export const createFitnessDatabase = (storePath: string) =>
	privateStore(storePath).pipe(Effect.flatMap((path) => Db.create(path, FitnessLedger)))
export const openFitnessDatabase = (storePath: string) =>
	privateStore(storePath).pipe(Effect.flatMap((path) => Db.open(path, FitnessLedger)))
export type FitnessDatabase = Db<typeof FitnessLedger>

/** Materialize one query answer and release its native result immediately. */
export function readRows<P extends ParamsRecord, A>(
	reader: QueryReader<typeof FitnessLedger>,
	query: QueryTemplate<typeof FitnessLedger, P, A>,
	params: P
) {
	return Effect.scoped(
		Effect.gen(function* () {
			const result = yield* reader.execute(query, params)
			return yield* result.collect()
		})
	)
}
