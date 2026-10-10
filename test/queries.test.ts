import assert from "node:assert/strict"
import test from "node:test"
import type { ChangeDraft, Fact, QueryTemplate } from "@bjornpagen/bumbledb"
import { Effect } from "effect"
import { readRows } from "#application/database.ts"
import * as queries from "#application/queries.ts"
import {
	BenchBackrestAngle,
	BenchBackrestPosition,
	BenchSeatAdjustment,
	BenchSeatPosition,
	DumbbellWorkSet,
	type FitnessLedger,
	SelectorWorkSet,
	Session,
	SessionEnd,
	SessionStart,
	TscWorkSet,
	WorkSet,
	WorkSetBench,
	WorkSetSetting
} from "#application/schema.ts"
import {
	apply,
	newObservationId,
	type ObservedTime,
	observed,
	rows,
	rowsWith,
	run,
	type SessionId,
	testDatabase,
	workSet
} from "./helpers.ts"

const byId = <T extends { readonly id: string }>(values: readonly T[]) =>
	values.toSorted((a, b) => a.id.localeCompare(b.id))
const sorted = (values: readonly string[]) => values.toSorted()

function session(draft: ChangeDraft<typeof FitnessLedger>, id: SessionId, start?: ObservedTime, end?: ObservedTime) {
	return Effect.gen(function* () {
		yield* draft.insert(Session, [{ id }])
		if (start !== undefined) yield* draft.insert(SessionStart, [{ session: id, ...start }])
		if (end !== undefined) yield* draft.insert(SessionEnd, [{ session: id, ...end }])
	})
}

function selector(draft: ChangeDraft<typeof FitnessLedger>, set: Fact<typeof WorkSet>, resistancePosition: bigint) {
	return Effect.gen(function* () {
		yield* draft.insert(WorkSet, [set])
		yield* draft.insert(SelectorWorkSet, [{ workSet: set.id, repetitions: 6n, resistancePosition }])
	})
}

function dumbbell(draft: ChangeDraft<typeof FitnessLedger>, set: Fact<typeof WorkSet>, eachTenthsLb: bigint) {
	return Effect.gen(function* () {
		yield* draft.insert(WorkSet, [set])
		yield* draft.insert(DumbbellWorkSet, [{ workSet: set.id, repetitions: 7n, eachTenthsLb }])
	})
}

test("count queries over empty relations return no row", () =>
	run(
		Effect.gen(function* () {
			const database = yield* testDatabase()
			for (const query of [queries.sessionCount, queries.openSessionCount, queries.workSetCount, queries.settingCount])
				assert.deepEqual(yield* rows(database, query), [])
			assert.deepEqual(yield* rows(database, queries.latestSessionAnchors), [])
			assert.equal((yield* rows(database, queries.controls)).length, 13)
			assert.equal((yield* rows(database, queries.machines)).length, 5)
		})
	))

test("every exported query runs against populated data and anchors sessions by actual time", () =>
	run(
		Effect.gen(function* () {
			const database = yield* testDatabase()
			const aStart = observed("2026-10-05T07:00:00-05:00")
			const aEnd = observed("2026-10-05T08:20:00-05:00")
			const bEnd = observed("2026-10-08T08:15:00-05:00")
			const latest = observed("2026-10-12T07:02:00-05:00")
			const ids = {
				a: newObservationId(),
				b: newObservationId(),
				c: newObservationId(),
				d: newObservationId(),
				e: newObservationId()
			}
			const sets = {
				aPulldown: workSet(ids.a, "d-200-lat-pulldown"),
				aPress: workSet(ids.a, "back-supported-neutral-db-overhead-press", 1n, "VeryMild"),
				aPress2: workSet(ids.a, "back-supported-neutral-db-overhead-press", 2n),
				aNeck: workSet(ids.a, "bench-tsc-neck-extension"),
				bPulldown: workSet(ids.b, "d-200-lat-pulldown"),
				bPress: workSet(ids.b, "back-supported-neutral-db-overhead-press"),
				cPulldown: workSet(ids.c, "d-200-lat-pulldown"),
				dPulldown: workSet(ids.d, "d-200-lat-pulldown")
			}
			assert.equal(
				(yield* apply(database, (draft) =>
					Effect.gen(function* () {
						yield* session(draft, ids.a, aStart, aEnd) // Complete.
						yield* session(draft, ids.b, undefined, bEnd) // Historical: only an end.
						yield* session(draft, ids.c, latest) // Open: only a start.
						yield* session(draft, ids.d) // Neither boundary: open and unanchored.
						yield* session(draft, ids.e, undefined, latest) // Ends when C starts: a tie for latest.
						yield* selector(draft, sets.aPulldown, 5n)
						yield* selector(draft, sets.bPulldown, 5n)
						yield* selector(draft, sets.cPulldown, 6n)
						yield* selector(draft, sets.dPulldown, 4n)
						yield* draft.insert(WorkSetSetting, [
							{
								workSet: sets.aPulldown.id,
								exercise: "d-200-lat-pulldown",
								control: "d-200-seat-pad-adjuster",
								position: 3n
							},
							{
								workSet: sets.aPulldown.id,
								exercise: "d-200-lat-pulldown",
								control: "d-200-thigh-pad-adjuster",
								position: 2n
							}
						])
						yield* dumbbell(draft, sets.aPress, 200n)
						yield* dumbbell(draft, sets.aPress2, 200n)
						yield* dumbbell(draft, sets.bPress, 250n)
						yield* draft.insert(WorkSetBench, [
							{ workSet: sets.aPress.id, exercise: sets.aPress.exercise, bench: "Synthetic bench A" },
							{ workSet: sets.aNeck.id, exercise: sets.aNeck.exercise, bench: "Synthetic bench A" }
						])
						yield* draft.insert(BenchBackrestAngle, [
							{ workSet: sets.aPress.id, degrees: 80 },
							{ workSet: sets.aNeck.id, degrees: 45 }
						])
						yield* draft.insert(BenchBackrestPosition, [{ workSet: sets.aPress.id, mark: "high" }])
						yield* draft.insert(BenchSeatAdjustment, [
							{ workSet: sets.aPress.id, adjustable: true },
							{ workSet: sets.aNeck.id, adjustable: false }
						])
						yield* draft.insert(BenchSeatPosition, [{ workSet: sets.aPress.id, mark: "A" }])
						yield* draft.insert(WorkSet, [sets.aNeck])
						yield* draft.insert(TscWorkSet, [{ workSet: sets.aNeck.id, durationSeconds: 84n }])
					})
				))._tag,
				"Committed"
			)
			const {
				workSetsInSession,
				selectorHistory,
				dumbbellHistory,
				tscHistory,
				unanchoredWorkSets,
				workSetSettingsForExercise,
				...plain
			} = queries
			const all: Record<keyof typeof plain, QueryTemplate<typeof FitnessLedger, Record<never, never>, unknown>> = plain
			const snapshot = yield* database.snapshot()
			for (const [name, query] of Object.entries(all)) {
				const result = yield* readRows(snapshot, query, {})
				assert.ok(Array.isArray(result) && result.length > 0, name)
			}

			assert.deepEqual(
				sorted((yield* rows(database, queries.sessions)).map((row) => row.id)),
				sorted(Object.values(ids))
			)
			assert.deepEqual(
				sorted((yield* rows(database, queries.openSessions)).map((row) => row.id)),
				sorted([ids.c, ids.d])
			)
			assert.deepEqual(yield* rows(database, queries.unanchoredSessions), [{ id: ids.d }])
			assert.deepEqual(
				(yield* rows(database, queries.sessionAnchors)).toSorted((a, b) => a.session.localeCompare(b.session)),
				[
					{ session: ids.a, ...aStart, fromStart: true },
					{ session: ids.b, ...bEnd, fromStart: false },
					{ session: ids.c, ...latest, fromStart: true },
					{ session: ids.e, ...latest, fromStart: false }
				].toSorted((a, b) => a.session.localeCompare(b.session))
			)
			// All ties are returned; UUID generation order is not chronology.
			assert.deepEqual(
				sorted((yield* rows(database, queries.latestSessionAnchors)).map((row) => row.session)),
				sorted([ids.c, ids.e])
			)
			assert.deepEqual(yield* rows(database, queries.sessionCount), [{ count: 5n }])
			assert.deepEqual(yield* rows(database, queries.openSessionCount), [{ count: 2n }])
			assert.deepEqual(yield* rows(database, queries.workSetCount), [{ count: 8n }])
			assert.deepEqual(yield* rows(database, queries.settingCount), [{ count: 2n }])

			assert.deepEqual(
				byId(yield* rowsWith(database, workSetsInSession, { session: ids.a })),
				byId([sets.aPulldown, sets.aPress, sets.aPress2, sets.aNeck])
			)
			const pulldown = yield* rowsWith(database, selectorHistory, { exercise: "d-200-lat-pulldown" })
			assert.deepEqual(
				pulldown
					.map((row) => [row.session, row.at, row.fromStart, row.resistancePosition])
					.toSorted((a, b) => String(a[0]).localeCompare(String(b[0]))),
				[
					[ids.a, aStart.at, true, 5n],
					[ids.b, bEnd.at, false, 5n],
					[ids.c, latest.at, true, 6n]
				].toSorted((a, b) => String(a[0]).localeCompare(String(b[0])))
			)
			assert.deepEqual(
				(yield* rowsWith(database, unanchoredWorkSets, { exercise: "d-200-lat-pulldown" })).map((row) => row.id),
				[sets.dPulldown.id]
			)
			assert.deepEqual(yield* rowsWith(database, unanchoredWorkSets, { exercise: "d-200-mid-row" }), [])
			assert.deepEqual(
				(yield* rowsWith(database, dumbbellHistory, { exercise: "back-supported-neutral-db-overhead-press" }))
					.map((row) => row.eachTenthsLb)
					.toSorted((a, b) => Number(a - b)),
				[200n, 200n, 250n]
			)
			assert.deepEqual(
				(yield* rows(database, queries.recordedDumbbellWeights))
					.map((row) => row.eachTenthsLb)
					.toSorted((a, b) => Number(a - b)),
				[200n, 250n]
			)
			assert.deepEqual(
				(yield* rowsWith(database, tscHistory, { exercise: "bench-tsc-neck-extension" })).map((row) => [
					row.durationSeconds,
					row.at
				]),
				[[84n, aStart.at]]
			)
			assert.deepEqual(yield* rowsWith(database, tscHistory, { exercise: "bench-tsc-neck-flexion" }), [])
			assert.deepEqual(
				(yield* rowsWith(database, workSetSettingsForExercise, { exercise: "d-200-lat-pulldown" }))
					.map((row) => [row.control, row.machine, row.numbering, row.position])
					.toSorted(),
				[
					["d-200-seat-pad-adjuster", "d-200", "Printed", 3n],
					["d-200-thigh-pad-adjuster", "d-200", "Printed", 2n]
				]
			)
			assert.deepEqual(yield* rowsWith(database, workSetSettingsForExercise, { exercise: "d-200-mid-row" }), [])
			assert.deepEqual(
				(yield* rows(database, queries.controls)).find((row) => row.control === "cl-2403-back-adjuster"),
				{
					control: "cl-2403-back-adjuster",
					machine: "cl-2403",
					numbering: "CountFromMostUpright"
				}
			)
			assert.deepEqual(yield* rows(database, queries.benchSeatPositions), [{ workSet: sets.aPress.id, mark: "A" }])
		})
	))
