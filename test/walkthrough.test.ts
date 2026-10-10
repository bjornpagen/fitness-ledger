import assert from "node:assert/strict"
import test from "node:test"
import { ChangeSet, type Fact } from "@bjornpagen/bumbledb"
import { Effect, Stream } from "effect"
import { readRows } from "#application/database.ts"
import * as queries from "#application/queries.ts"
import {
	BenchBackrestAngle,
	BenchBackrestPosition,
	BenchSeatAdjustment,
	BenchSeatPosition,
	DumbbellWorkSet,
	FitnessLedger,
	SelectorWorkSet,
	TscWorkSet,
	WorkSet,
	WorkSetBench,
	WorkSetSetting
} from "#application/schema.ts"
import { controlsFor, exerciseById } from "#policy/exercises.ts"
import { exercisePrescriptionById, prescription } from "#policy/prescription.ts"
import { endSession, observed, openSession, rows, run, testDatabase, workSet } from "./helpers.ts"

/* Direct BumbleDB transactions, beneath the op table: each set is its own self-contained change set,
 * judged and applied against the exact witness it was built from. */

const START = observed("2026-10-12T07:02:00-05:00")
const END = observed("2026-10-12T08:31:00-05:00")
const SET_RELATIONS = new Set([
	"WorkSet",
	"SelectorWorkSet",
	"DumbbellWorkSet",
	"TscWorkSet",
	"WorkSetSetting",
	"WorkSetBench",
	"BenchBackrestAngle",
	"BenchBackrestPosition",
	"BenchSeatAdjustment",
	"BenchSeatPosition"
])

test("a live session records every set as its own change set in any order, then closes", () =>
	run(
		Effect.gen(function* () {
			const database = yield* testDatabase()
			const session = yield* openSession(database, START)
			const expectedSets: Fact<typeof WorkSet>[] = []
			for (const exercise of prescription.strength.recommendedOrder.toReversed()) {
				const policy = exercisePrescriptionById[exercise]
				for (let number = 1; number <= policy.sets; number++) {
					const curlChange = exercise === "d-400-hamstring-curl" && number === 2
					// Synthetic conversation: "it hurt" on curl set two is clarified in English as discomforting.
					// Other new sets leave pain unmentioned, so the recording agent explicitly supplies NoPain.
					const set = workSet(session, exercise, BigInt(number), curlChange ? "Discomforting" : "NoPain")
					expectedSets.push(set)
					const snapshot = yield* database.snapshot()
					const draft = yield* ChangeSet.builder(FitnessLedger)
					yield* draft.insert(WorkSet, [set])
					if (policy.loadKind === "SelectorPosition") {
						// The synthetic user changes curl resistance and every curl control on set two.
						yield* draft.insert(SelectorWorkSet, [
							{ workSet: set.id, resistancePosition: curlChange ? 4n : 3n, repetitions: number === 1 ? 10n : 7n }
						])
						yield* draft.insert(
							WorkSetSetting,
							controlsFor(exercise).map((control) => ({
								workSet: set.id,
								exercise,
								control,
								position: curlChange ? 3n : 2n
							}))
						)
					} else if (policy.loadKind === "DumbbellPair")
						yield* draft.insert(DumbbellWorkSet, [{ workSet: set.id, repetitions: 8n, eachTenthsLb: 120n }])
					else yield* draft.insert(TscWorkSet, [{ workSet: set.id, durationSeconds: 90n }])
					if (exerciseById[exercise].usesBench) {
						const tsc = policy.loadKind === "TimedStaticContraction"
						yield* draft.insert(WorkSetBench, [{ workSet: set.id, exercise, bench: "Synthetic bench A" }])
						yield* draft.insert(BenchBackrestAngle, [{ workSet: set.id, degrees: tsc ? 45 : 80 }])
						yield* draft.insert(BenchBackrestPosition, [{ workSet: set.id, mark: tsc ? "45" : "high" }])
						yield* draft.insert(BenchSeatAdjustment, [{ workSet: set.id, adjustable: true }])
						yield* draft.insert(BenchSeatPosition, [{ workSet: set.id, mark: "A" }])
					}
					const changes = yield* draft.finish()
					const records = yield* changes.records().pipe(Stream.runCollect)
					assert.equal(BigInt(records.length), changes.counts.added)
					// Self-contained: only this set's facts, referencing the open session and closed vocabularies.
					for (const record of records) {
						assert.ok(SET_RELATIONS.has(record.relation), record.relation)
						if (record.relation === "WorkSet") assert.equal(record.fact.session, session)
						else assert.ok("workSet" in record.fact && record.fact.workSet === set.id, record.relation)
					}
					const options = snapshot.witness
					assert.equal((yield* database.judge(changes, options))._tag, "Admitted")
					assert.equal((yield* rows(database, queries.workSets)).length, expectedSets.length - 1)
					assert.equal((yield* database.apply(changes, options))._tag, "Committed")
				}
			}
			assert.deepEqual(
				(yield* rows(database, queries.workSets)).toSorted((a, b) => a.id.localeCompare(b.id)),
				expectedSets.toSorted((a, b) => a.id.localeCompare(b.id))
			)
			assert.equal(expectedSets.length, 17)
			assert.deepEqual(yield* rows(database, queries.settingCount), [{ count: 34n }])
			assert.deepEqual(yield* rows(database, queries.openSessions), [{ id: session }])

			yield* endSession(database, session, END)
			assert.deepEqual(yield* rows(database, queries.openSessions), [])
			const curl = (yield* rows(database, queries.selectorWorkSets))
				.filter((row) => row.exercise === "d-400-hamstring-curl")
				.toSorted((a, b) => Number(a.setNumber - b.setNumber))
			assert.deepEqual(
				curl.map((row) => [row.repetitions, row.resistancePosition, row.painRating]),
				[
					[10n, 3n, "NoPain"],
					[7n, 4n, "Discomforting"]
				]
			)
		})
	))

test("admission diagnostics and moved witnesses force renewed reasoning before recording", () =>
	run(
		Effect.gen(function* () {
			const database = yield* testDatabase()
			const session = yield* openSession(database, START)
			const base = yield* database.snapshot()
			const set = workSet(session, "d-200-lat-pulldown")
			const malformed = yield* ChangeSet.builder(FitnessLedger)
			yield* malformed.insert(WorkSet, [set])
			const rejected = yield* database.judge(yield* malformed.finish(), base.witness)
			assert.equal(rejected._tag, "Rejected")
			if (rejected._tag === "Rejected") {
				assert.ok(rejected.violations.length > 0)
				assert.equal(rejected.generation, base.generation)
			}
			const draft = yield* ChangeSet.builder(FitnessLedger)
			yield* draft.insert(WorkSet, [set])
			yield* draft.insert(SelectorWorkSet, [{ workSet: set.id, repetitions: 6n, resistancePosition: 5n }])
			const changes = yield* draft.finish()
			assert.equal((yield* database.judge(changes, base.witness))._tag, "Admitted")
			// Another writer opens an unrelated session in between.
			const other = yield* openSession(database)
			assert.equal((yield* database.apply(changes, base.witness))._tag, "Moved")
			assert.equal((yield* database.judge(changes, base.witness))._tag, "Moved")
			const fresh = yield* database.snapshot()
			assert.deepEqual(yield* readRows(fresh, queries.workSets, {}), [])
			assert.equal((yield* readRows(fresh, queries.sessions, {})).length, 2)
			// Reconsideration: the intervening fact is unrelated; this actual set is still absent.
			const options = fresh.witness
			assert.equal((yield* database.judge(changes, options))._tag, "Admitted")
			assert.equal((yield* database.apply(changes, options))._tag, "Committed")
			assert.deepEqual(yield* rows(database, queries.workSets), [set])
			assert.deepEqual(
				(yield* rows(database, queries.openSessions)).map((row) => row.id).toSorted(),
				[session, other].toSorted()
			)
		})
	))
