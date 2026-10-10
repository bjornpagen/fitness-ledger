import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
	type Bumble,
	type ChangeDraft,
	ChangeSet,
	type Fact,
	type ParamsRecord,
	type QueryTemplate
} from "@bjornpagen/bumbledb"
import { Db } from "@bjornpagen/bumbledb/engine"
import { Effect, type Scope } from "effect"
import { DatabaseRuntime, type FitnessDatabase, readRows } from "#application/database.ts"
import {
	FitnessLedger,
	type PainRatingId,
	Session,
	SessionEnd,
	SessionStart,
	type WorkSet
} from "#application/schema.ts"
import { parseInstant, timezoneOffsetMinutes } from "#mechanism/dates.ts"
import { observationId } from "#mechanism/identity.ts"
import { type ExerciseId, exerciseById } from "#policy/exercises.ts"

export type SessionId = Fact<typeof Session>["id"]
/** An observed instant: epoch milliseconds, its clock precision and the offset the user reported. */
export type ObservedTime = Omit<Fact<typeof SessionStart>, "session">

export const newObservationId = () => Effect.runSync(observationId)

export const run = <A, E>(program: Effect.Effect<A, E, Bumble | Scope.Scope>) =>
	Effect.runPromise(Effect.scoped(program).pipe(Effect.provide(DatabaseRuntime)))

/** A fresh, empty store in a temporary directory. A single-person ledger needs no initialization. */
export function testDatabase() {
	return Effect.gen(function* () {
		const root = yield* Effect.acquireRelease(
			Effect.tryPromise(() => mkdtemp(join(tmpdir(), "fitness-ledger-test-"))),
			(path) => Effect.promise(() => rm(path, { recursive: true, force: true }))
		)
		return yield* Db.create(join(root, "database"), FitnessLedger)
	})
}

/** A synthetic time exactly as a user would report it, with an explicit offset. */
export function observed(text: string, precision: ObservedTime["precision"] = "Minute"): ObservedTime {
	return { at: parseInstant(text), precision, timezoneOffsetMinutes: timezoneOffsetMinutes(text) }
}

export function apply<E, R>(
	database: FitnessDatabase,
	build: (draft: ChangeDraft<typeof FitnessLedger>) => Effect.Effect<unknown, E, R>
) {
	return Effect.scoped(
		Effect.gen(function* () {
			const draft = yield* ChangeSet.builder(FitnessLedger)
			yield* build(draft)
			return yield* database.apply(yield* draft.finish())
		})
	)
}

/** The live start of a session: one change set holding the Session and, when known, its SessionStart. */
export function openSession(database: FitnessDatabase, start?: ObservedTime) {
	return Effect.gen(function* () {
		const session = newObservationId()
		const outcome = yield* apply(database, (draft) =>
			Effect.gen(function* () {
				yield* draft.insert(Session, [{ id: session }])
				if (start !== undefined) yield* draft.insert(SessionStart, [{ session, ...start }])
			})
		)
		assert.equal(outcome._tag, "Committed")
		return session
	})
}

/** The user says they are done: the end is its own later change set. */
export function endSession(database: FitnessDatabase, session: SessionId, end: ObservedTime) {
	return Effect.gen(function* () {
		const outcome = yield* apply(database, (draft) => draft.insert(SessionEnd, [{ session, ...end }]))
		assert.equal(outcome._tag, "Committed")
	})
}

/** A work-set parent whose load kind agrees with its exercise. */
export function workSet(
	session: SessionId,
	exercise: ExerciseId,
	setNumber = 1n,
	painRating: PainRatingId = "NoPain"
): Fact<typeof WorkSet> {
	return {
		id: newObservationId(),
		session,
		exercise,
		loadKind: exerciseById[exercise].loadKind,
		setNumber,
		painRating
	}
}

export function rows<A>(
	database: FitnessDatabase,
	query: QueryTemplate<typeof FitnessLedger, Record<never, never>, A>
) {
	return rowsWith(database, query, {})
}

export function rowsWith<P extends ParamsRecord, A>(
	database: FitnessDatabase,
	query: QueryTemplate<typeof FitnessLedger, P, A>,
	params: P
) {
	return Effect.scoped(
		Effect.gen(function* () {
			const snapshot = yield* database.snapshot()
			return yield* readRows(snapshot, query, params)
		})
	)
}
