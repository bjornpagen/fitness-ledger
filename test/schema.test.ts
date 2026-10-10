import assert from "node:assert/strict"
import test from "node:test"
import { type ChangeDraft, ChangeSet, type Fact } from "@bjornpagen/bumbledb"
import { Effect, Result, Stream } from "effect"
import type { FitnessDatabase } from "#application/database.ts"
import * as queries from "#application/queries.ts"
import {
	BenchBackrestAngle,
	BenchBackrestPosition,
	BenchSeatAdjustment,
	BenchSeatPosition,
	Control,
	DumbbellWorkSet,
	Exercise,
	FitnessLedger,
	LoadKind,
	Machine,
	Numbering,
	PAIN_RATING_IDS,
	PainRating,
	SelectorWorkSet,
	Session,
	SessionEnd,
	SessionStart,
	TimePrecision,
	TscWorkSet,
	WorkSet,
	WorkSetBench,
	WorkSetSetting
} from "#application/schema.ts"
import {
	CONTROL_IDS,
	type ControlId,
	controlsFor,
	EXERCISE_IDS,
	isSelectorExercise,
	MACHINE_IDS,
	NUMBERING_IDS,
	numberingRules,
	selectorMachineByExercise
} from "#policy/exercises.ts"
import {
	apply,
	endSession,
	newObservationId,
	observed,
	openSession,
	rows,
	rowsWith,
	run,
	type SessionId,
	testDatabase,
	workSet
} from "./helpers.ts"

const START = observed("2026-10-12T07:02:00-05:00")
const END = observed("2026-10-12T08:31:00-05:00")
const UNCONFIRMED: readonly ControlId[] = [
	"cl-2403-seat-slide-adjuster",
	"d-400-leg-length",
	"d-400-thigh-brace",
	"d-600-foot-rest"
]
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

type Build = (draft: ChangeDraft<typeof FitnessLedger>) => Effect.Effect<unknown, unknown>

/** One set as its own change set, judged and applied against the exact witness it was built from. */
function recordSet(database: FitnessDatabase, build: Build) {
	return Effect.scoped(
		Effect.gen(function* () {
			const witness = yield* Effect.scoped(Effect.map(database.snapshot(), (snapshot) => snapshot.witness))
			const draft = yield* ChangeSet.builder(FitnessLedger)
			yield* build(draft)
			const changes = yield* draft.finish()
			const relations = (yield* changes.records().pipe(Stream.runCollect)).map((record) => record.relation)
			const options = witness
			const judgment = yield* database.judge(changes, options)
			const outcome = yield* database.apply(changes, options)
			return { relations, judgment: judgment._tag, outcome: outcome._tag }
		})
	)
}

function selectorSet(session: SessionId, setNumber = 1n, resistancePosition = 5n) {
	const set = workSet(session, "d-200-lat-pulldown", setNumber)
	return {
		set,
		build: ((draft) =>
			Effect.gen(function* () {
				yield* draft.insert(WorkSet, [set])
				yield* draft.insert(SelectorWorkSet, [{ workSet: set.id, repetitions: 7n, resistancePosition }])
			})) satisfies Build
	}
}

function pulldownSetting(
	set: Fact<typeof WorkSet>,
	control: Fact<typeof WorkSetSetting>["control"] = "d-200-seat-pad-adjuster",
	position = 3n
): Fact<typeof WorkSetSetting> {
	return { workSet: set.id, exercise: set.exercise, control, position }
}

test("the theory holds closed vocabularies, sessions and sets", () => {
	assert.deepEqual(Object.keys(FitnessLedger.relations), [
		"LoadKind",
		"Exercise",
		"Machine",
		"Numbering",
		"Control",
		"TimePrecision",
		"PainRating",
		"Session",
		"SessionStart",
		"SessionEnd",
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
	assert.deepEqual(LoadKind.handles, ["SelectorPosition", "DumbbellPair", "TimedStaticContraction"])
	assert.deepEqual(TimePrecision.handles, ["Minute", "Millisecond"])
	assert.deepEqual(PainRating.handles, PAIN_RATING_IDS)
	assert.deepEqual(Exercise.handles, EXERCISE_IDS)
	assert.deepEqual(Machine.handles, MACHINE_IDS)
	assert.deepEqual(Numbering.handles, NUMBERING_IDS)
	assert.deepEqual(Control.handles, CONTROL_IDS)
	assert.deepEqual(Object.keys(WorkSet.fields), ["id", "session", "exercise", "loadKind", "setNumber", "painRating"])
	assert.deepEqual(Object.keys(SelectorWorkSet.fields), ["workSet", "repetitions", "resistancePosition"])
	assert.deepEqual(Object.keys(WorkSetSetting.fields), ["workSet", "exercise", "control", "position"])
	assert.deepEqual(Object.keys(WorkSetBench.fields), ["workSet", "exercise", "bench"])
})

test("exercises keep their load kinds and stacks keep their HOIST selector counts", () =>
	run(
		Effect.gen(function* () {
			assert.deepEqual(Exercise.axioms["cl-2403-seated-leg-press"], { loadKind: "SelectorPosition", usesBench: false })
			assert.deepEqual(Exercise.axioms["back-supported-neutral-db-overhead-press"], {
				loadKind: "DumbbellPair",
				usesBench: true
			})
			assert.deepEqual(Exercise.axioms["bench-tsc-neck-extension"], {
				loadKind: "TimedStaticContraction",
				usesBench: true
			})
			assert.deepEqual(Exercise.axioms["bench-tsc-neck-flexion"], {
				loadKind: "TimedStaticContraction",
				usesBench: true
			})
			const database = yield* testDatabase()
			assert.deepEqual(
				Object.fromEntries((yield* rows(database, queries.machines)).map((row) => [row.id, row.stackPositions])),
				{ "cl-2403": 21n, "d-200": 21n, "d-300": 16n, "d-400": 16n, "d-600": 16n }
			)
		})
	))

test("every control has a numbering convention; the back adjuster counts from upright and four are unconfirmed", () =>
	run(
		Effect.gen(function* () {
			for (const control of CONTROL_IDS) {
				const axiom = Control.axioms[control]
				assert.ok(NUMBERING_IDS.includes(axiom.numbering), control)
				assert.ok(control.startsWith(`${axiom.machine}-`), control)
			}
			assert.equal(Control.axioms["cl-2403-back-adjuster"].numbering, "CountFromMostUpright")
			assert.deepEqual(
				CONTROL_IDS.filter((control) => Control.axioms[control].numbering === "Unconfirmed"),
				UNCONFIRMED
			)
			assert.deepEqual(
				CONTROL_IDS.filter((control) => Control.axioms[control].numbering === "Printed"),
				[
					"d-200-seat-pad-adjuster",
					"d-200-thigh-pad-adjuster",
					"d-200-horizontal-chest-pad-adjuster",
					"d-300-seat-pad-adjuster",
					"d-300-back-pad-adjuster",
					"d-400-back-adjuster",
					"d-400-range-of-motion",
					"d-600-range-of-motion"
				]
			)
			for (const numbering of NUMBERING_IDS) assert.ok(numberingRules[numbering].length > 0, numbering)
			assert.ok(numberingRules.CountFromMostUpright.includes("Hole 1 is the most upright position"))
			// The ledger itself answers how each control is counted.
			const database = yield* testDatabase()
			const stored = yield* rows(database, queries.controls)
			assert.equal(stored.length, CONTROL_IDS.length)
			for (const row of stored) {
				assert.equal(row.numbering, Control.axioms[row.control].numbering, row.control)
				assert.equal(row.machine, Control.axioms[row.control].machine, row.control)
			}
			assert.deepEqual(
				[...new Set(stored.filter((row) => row.numbering === "Unconfirmed").map((row) => row.control))].sort(),
				[...UNCONFIRMED].sort()
			)
		})
	))

test("controls belong to machines: every exercise on a machine may record exactly that machine's controls", () => {
	for (const exercise of EXERCISE_IDS.filter(isSelectorExercise)) {
		const machine = selectorMachineByExercise[exercise]
		const expected = CONTROL_IDS.filter((control) => Control.axioms[control].machine === machine)
		assert.ok(expected.length > 0, exercise)
		assert.deepEqual(controlsFor(exercise), expected, exercise)
	}
	// The pulldown and the mid-row are one machine, so they share all three D-200 controls.
	const d200 = ["d-200-seat-pad-adjuster", "d-200-thigh-pad-adjuster", "d-200-horizontal-chest-pad-adjuster"]
	assert.deepEqual(controlsFor("d-200-lat-pulldown"), d200)
	assert.deepEqual(controlsFor("d-200-mid-row"), d200)
	assert.deepEqual(controlsFor("cl-2403-calf-press"), controlsFor("cl-2403-seated-leg-press"))
	assert.deepEqual(controlsFor("d-600-abdominals"), controlsFor("d-600-lower-back"))
	assert.deepEqual(controlsFor("d-400-hamstring-curl"), [
		"d-400-back-adjuster",
		"d-400-range-of-motion",
		"d-400-leg-length",
		"d-400-thigh-brace"
	])
	for (const exercise of [
		"back-supported-neutral-db-overhead-press",
		"bench-tsc-neck-extension",
		"bench-tsc-neck-flexion"
	] as const)
		assert.deepEqual(controlsFor(exercise), [])
})

test("the pulldown and the mid-row each admit every D-200 control", () =>
	run(
		Effect.gen(function* () {
			const database = yield* testDatabase()
			const session = yield* openSession(database, START)
			for (const exercise of ["d-200-lat-pulldown", "d-200-mid-row"] as const) {
				const set = workSet(session, exercise)
				const result = yield* recordSet(database, (draft) =>
					Effect.gen(function* () {
						yield* draft.insert(WorkSet, [set])
						yield* draft.insert(SelectorWorkSet, [{ workSet: set.id, repetitions: 6n, resistancePosition: 4n }])
						yield* draft.insert(
							WorkSetSetting,
							controlsFor(exercise).map((control, index) => ({
								workSet: set.id,
								exercise,
								control,
								position: BigInt(index + 2)
							}))
						)
					})
				)
				assert.equal(result.outcome, "Committed", exercise)
			}
			assert.equal((yield* rows(database, queries.workSetSettings)).length, 6)
		})
	))

test("required English pain rejects omission and unknown anchors; clock precision is closed", () =>
	run(
		Effect.gen(function* () {
			const database = yield* testDatabase()
			const session = yield* openSession(database, START)
			const set = workSet(session, "d-200-lat-pulldown", 1n, "NoPain")
			const { painRating: _pain, ...missing } = set
			const omitted = yield* ChangeSet.builder(FitnessLedger)
			// @ts-expect-error Pain is required even when a caller bypasses static checking.
			assert.ok(Result.isFailure(yield* Effect.result(omitted.insert(WorkSet, [missing]))))
			const invalid = yield* ChangeSet.builder(FitnessLedger)
			// @ts-expect-error Pain is a closed English vocabulary.
			assert.ok(Result.isFailure(yield* Effect.result(invalid.insert(WorkSet, [{ ...set, painRating: "Unknown" }]))))
			const numeric = yield* ChangeSet.builder(FitnessLedger)
			// @ts-expect-error A numeric rating is not an English anchor.
			assert.ok(Result.isFailure(yield* Effect.result(numeric.insert(WorkSet, [{ ...set, painRating: 2n }]))))
			const precision = yield* ChangeSet.builder(FitnessLedger)
			const hourly = { session, at: END.at, precision: "Hour", timezoneOffsetMinutes: END.timezoneOffsetMinutes }
			// @ts-expect-error Clock precision is a closed vocabulary.
			const imprecise = precision.insert(SessionEnd, [hourly])
			assert.ok(Result.isFailure(yield* Effect.result(imprecise)))
			const accepted = yield* apply(database, (draft) =>
				Effect.gen(function* () {
					yield* draft.insert(WorkSet, [set])
					yield* draft.insert(SelectorWorkSet, [{ workSet: set.id, repetitions: 6n, resistancePosition: 3n }])
				})
			)
			assert.equal(accepted._tag, "Committed")
			assert.deepEqual(yield* rows(database, queries.workSets), [set])
		})
	))

test("an open session admits each set as its own self-contained change set and closes later", () =>
	run(
		Effect.gen(function* () {
			const database = yield* testDatabase()
			const session = yield* openSession(database, START)
			assert.deepEqual(yield* rows(database, queries.openSessions), [{ id: session }])
			assert.deepEqual(yield* rows(database, queries.sessionStarts), [{ session, ...START }])
			assert.deepEqual(yield* rows(database, queries.sessionEnds), [])

			const first = selectorSet(session, 1n)
			const second = selectorSet(session, 2n, 6n)
			const press = workSet(session, "back-supported-neutral-db-overhead-press", 1n, "VeryMild")
			const neck = workSet(session, "bench-tsc-neck-extension")
			const writes: readonly Build[] = [
				(draft) =>
					Effect.gen(function* () {
						yield* first.build(draft)
						yield* draft.insert(WorkSetSetting, [
							pulldownSetting(first.set),
							pulldownSetting(first.set, "d-200-thigh-pad-adjuster", 2n)
						])
					}),
				// Settings are optional observations; a set without them is still a complete set.
				second.build,
				(draft) =>
					Effect.gen(function* () {
						yield* draft.insert(WorkSet, [press])
						yield* draft.insert(DumbbellWorkSet, [{ workSet: press.id, repetitions: 8n, eachTenthsLb: 250n }])
						yield* draft.insert(WorkSetBench, [
							{ workSet: press.id, exercise: press.exercise, bench: "Synthetic bench A" }
						])
						yield* draft.insert(BenchBackrestAngle, [{ workSet: press.id, degrees: 75 }])
						yield* draft.insert(BenchSeatAdjustment, [{ workSet: press.id, adjustable: false }])
					}),
				(draft) =>
					Effect.gen(function* () {
						yield* draft.insert(WorkSet, [neck])
						yield* draft.insert(TscWorkSet, [{ workSet: neck.id, durationSeconds: 90n }])
						yield* draft.insert(WorkSetBench, [
							{ workSet: neck.id, exercise: neck.exercise, bench: "Synthetic bench A" }
						])
						yield* draft.insert(BenchBackrestAngle, [{ workSet: neck.id, degrees: 45 }])
						yield* draft.insert(BenchBackrestPosition, [{ workSet: neck.id, mark: "45" }])
						yield* draft.insert(BenchSeatAdjustment, [{ workSet: neck.id, adjustable: true }])
						yield* draft.insert(BenchSeatPosition, [{ workSet: neck.id, mark: "2" }])
					})
			]
			for (const write of writes) {
				const result = yield* recordSet(database, write)
				assert.equal(result.judgment, "Admitted")
				assert.equal(result.outcome, "Committed")
				// Each set writes only its own facts, referencing its open session and closed vocabularies.
				for (const relation of result.relations) assert.ok(SET_RELATIONS.has(relation), relation)
				assert.deepEqual(yield* rows(database, queries.openSessions), [{ id: session }])
			}
			assert.equal(
				(yield* rowsWith(database, queries.workSetsInSession, { session })).length,
				4,
				"all four sets belong to the open session"
			)
			assert.deepEqual(
				(yield* rows(database, queries.workSetSettings))
					.map((row) => [row.control, row.numbering, row.position])
					.sort(),
				[
					["d-200-seat-pad-adjuster", "Printed", 3n],
					["d-200-thigh-pad-adjuster", "Printed", 2n]
				]
			)
			const byWorkSet = (a: { readonly workSet: string }, b: { readonly workSet: string }) =>
				a.workSet.localeCompare(b.workSet)
			assert.deepEqual(
				(yield* rows(database, queries.workSetBenches)).toSorted(byWorkSet),
				[
					{ workSet: press.id, exercise: press.exercise, bench: "Synthetic bench A" },
					{ workSet: neck.id, exercise: neck.exercise, bench: "Synthetic bench A" }
				].toSorted(byWorkSet)
			)

			yield* endSession(database, session, END)
			assert.deepEqual(yield* rows(database, queries.openSessions), [])
			assert.deepEqual(yield* rows(database, queries.sessionEnds), [{ session, ...END }])
			assert.deepEqual(yield* rows(database, queries.sessionAnchors), [{ session, ...START, fromStart: true }])
			// A set may still arrive after the end is recorded; the schedule and boundaries never constrain admission.
			const late = selectorSet(session, 3n)
			assert.equal((yield* recordSet(database, late.build)).outcome, "Committed")
		})
	))

test("a past session recorded with only its end is admitted, anchored by that end and not open", () =>
	run(
		Effect.gen(function* () {
			const database = yield* testDatabase()
			const session = newObservationId()
			const ended = observed("2026-09-06T09:17:00-05:00") // A Sunday: actual dates need not match the schedule.
			const set = workSet(session, "cl-2403-seated-leg-press")
			assert.equal(
				(yield* apply(database, (draft) =>
					Effect.gen(function* () {
						yield* draft.insert(Session, [{ id: session }])
						yield* draft.insert(SessionEnd, [{ session, ...ended }])
						yield* draft.insert(WorkSet, [set])
						yield* draft.insert(SelectorWorkSet, [{ workSet: set.id, repetitions: 4n, resistancePosition: 9n }])
					})
				))._tag,
				"Committed"
			)
			assert.deepEqual(yield* rows(database, queries.openSessions), [])
			assert.deepEqual(yield* rows(database, queries.sessionStarts), [])
			assert.deepEqual(yield* rows(database, queries.sessionAnchors), [{ session, ...ended, fromStart: false }])
			assert.deepEqual(
				(yield* rowsWith(database, queries.selectorHistory, { exercise: set.exercise })).map((row) => [
					row.at,
					row.fromStart,
					row.resistancePosition
				]),
				[[ended.at, false, 9n]]
			)
		})
	))

test("a corrected session boundary replaces the recorded fact and leaves its sets untouched", () =>
	run(
		Effect.gen(function* () {
			const database = yield* testDatabase()
			const session = yield* openSession(database, START)
			const { set, build } = selectorSet(session)
			assert.equal((yield* recordSet(database, build)).outcome, "Committed")
			const corrected = observed("2026-10-12T07:04:12.250-05:00", "Millisecond")
			assert.equal(
				(yield* apply(database, (draft) =>
					Effect.gen(function* () {
						yield* draft.delete(SessionStart, [{ session, ...START }])
						yield* draft.insert(SessionStart, [{ session, ...corrected }])
					})
				))._tag,
				"Committed"
			)
			assert.deepEqual(yield* rows(database, queries.sessionStarts), [{ session, ...corrected }])
			assert.deepEqual(yield* rows(database, queries.workSets), [set])
		})
	))

test("a session may start and end in the same instant", () =>
	run(
		Effect.gen(function* () {
			const database = yield* testDatabase()
			const session = yield* openSession(database, START)
			yield* endSession(database, session, START)
			assert.deepEqual(yield* rows(database, queries.openSessions), [])
		})
	))

for (const problem of [
	"start for an unknown session",
	"end for an unknown session",
	"second start",
	"second end",
	"an end before its start",
	"a session that starts after it ends"
] as const) {
	test(`session boundaries reject ${problem}`, () =>
		run(
			Effect.gen(function* () {
				const database = yield* testDatabase()
				const session = yield* openSession(database, START)
				if (problem === "second end") yield* endSession(database, session, END)
				const outcome = yield* apply(database, (draft) =>
					problem === "start for an unknown session"
						? draft.insert(SessionStart, [{ session: newObservationId(), ...START }])
						: problem === "end for an unknown session"
							? draft.insert(SessionEnd, [{ session: newObservationId(), ...END }])
							: problem === "second start"
								? draft.insert(SessionStart, [{ session, ...observed("2026-10-12T07:05:00-05:00") }])
								: problem === "an end before its start"
									? draft.insert(SessionEnd, [{ session, ...observed("2026-10-12T06:45:00-05:00") }])
									: problem === "a session that starts after it ends"
										? Effect.gen(function* () {
												const late = newObservationId()
												yield* draft.insert(Session, [{ id: late }])
												yield* draft.insert(SessionStart, [{ session: late, ...END }])
												yield* draft.insert(SessionEnd, [{ session: late, ...START }])
											})
										: draft.insert(SessionEnd, [{ session, ...observed("2026-10-12T08:45:00-05:00") }])
				)
				assert.equal(outcome._tag, "Rejected")
			})
		))
}

for (const problem of [
	"missing child",
	"wrong child",
	"two children",
	"load kind disagreeing with the exercise",
	"zero set number",
	"zero selector position",
	"zero dumbbell weight",
	"unknown session",
	"duplicate set number"
] as const) {
	test(`work-set theory rejects ${problem}`, () =>
		run(
			Effect.gen(function* () {
				const database = yield* testDatabase()
				const session = yield* openSession(database, START)
				const existing = selectorSet(session, 1n)
				assert.equal((yield* recordSet(database, existing.build)).outcome, "Committed")
				const set = workSet(session, "d-200-lat-pulldown", 2n)
				const press = workSet(session, "back-supported-neutral-db-overhead-press")
				const result = yield* recordSet(database, (draft) =>
					Effect.gen(function* () {
						if (problem === "zero dumbbell weight") {
							yield* draft.insert(WorkSet, [press])
							yield* draft.insert(DumbbellWorkSet, [{ workSet: press.id, repetitions: 6n, eachTenthsLb: 0n }])
							return
						}
						const parent =
							problem === "load kind disagreeing with the exercise"
								? { ...set, loadKind: "DumbbellPair" as const }
								: problem === "zero set number"
									? { ...set, setNumber: 0n }
									: problem === "unknown session"
										? { ...set, session: newObservationId() }
										: problem === "duplicate set number"
											? { ...set, setNumber: 1n }
											: set
						yield* draft.insert(WorkSet, [parent])
						if (problem === "missing child") return
						if (problem === "wrong child" || problem === "load kind disagreeing with the exercise") {
							yield* draft.insert(DumbbellWorkSet, [{ workSet: set.id, repetitions: 6n, eachTenthsLb: 250n }])
							return
						}
						yield* draft.insert(SelectorWorkSet, [
							{ workSet: set.id, repetitions: 6n, resistancePosition: problem === "zero selector position" ? 0n : 5n }
						])
						if (problem === "two children")
							yield* draft.insert(DumbbellWorkSet, [{ workSet: set.id, repetitions: 6n, eachTenthsLb: 250n }])
					})
				)
				assert.equal(result.judgment, "Rejected")
				assert.equal(result.outcome, "Rejected")
				assert.deepEqual(yield* rows(database, queries.workSets), [existing.set])
			})
		))
}

test("settings change per set and remain separate from resistance", () =>
	run(
		Effect.gen(function* () {
			const database = yield* testDatabase()
			const session = yield* openSession(database, START)
			const first = selectorSet(session, 1n, 5n)
			const second = selectorSet(session, 2n, 5n)
			for (const [entry, position] of [
				[first, 1n],
				[second, 2n]
			] as const) {
				const result = yield* recordSet(database, (draft) =>
					Effect.gen(function* () {
						yield* entry.build(draft)
						yield* draft.insert(WorkSetSetting, [pulldownSetting(entry.set, undefined, position)])
					})
				)
				assert.equal(result.outcome, "Committed")
			}
			assert.deepEqual(
				(yield* rowsWith(database, queries.workSetSettingsForExercise, { exercise: "d-200-lat-pulldown" }))
					.map((row) => row.position)
					.sort(),
				[1n, 2n]
			)
			assert.deepEqual(
				(yield* rows(database, queries.selectorWorkSets)).map((row) => row.resistancePosition),
				[5n, 5n]
			)
			assert.deepEqual(yield* rowsWith(database, queries.workSetSettingsForExercise, { exercise: "d-200-mid-row" }), [])
		})
	))

for (const problem of [
	"a control on another machine",
	"a setting claiming another exercise",
	"a zero position",
	"two positions for one control",
	"a setting on a bench exercise",
	"a setting for an unknown set"
] as const) {
	test(`work-set settings reject ${problem}`, () =>
		run(
			Effect.gen(function* () {
				const database = yield* testDatabase()
				const session = yield* openSession(database, START)
				const { set, build } = selectorSet(session)
				const press = workSet(session, "back-supported-neutral-db-overhead-press")
				const result = yield* recordSet(database, (draft) =>
					Effect.gen(function* () {
						yield* build(draft)
						if (problem === "a setting on a bench exercise") {
							yield* draft.insert(WorkSet, [press])
							yield* draft.insert(DumbbellWorkSet, [{ workSet: press.id, repetitions: 6n, eachTenthsLb: 250n }])
							yield* draft.insert(WorkSetSetting, [
								{ ...pulldownSetting(set), workSet: press.id, exercise: press.exercise }
							])
							return
						}
						const setting =
							problem === "a control on another machine"
								? pulldownSetting(set, "d-300-seat-pad-adjuster")
								: problem === "a setting claiming another exercise"
									? {
											...pulldownSetting(set, "d-200-horizontal-chest-pad-adjuster"),
											exercise: "d-200-mid-row" as const
										}
									: problem === "a zero position"
										? pulldownSetting(set, undefined, 0n)
										: problem === "a setting for an unknown set"
											? { ...pulldownSetting(set), workSet: newObservationId() }
											: pulldownSetting(set)
						yield* draft.insert(WorkSetSetting, [setting])
						if (problem === "two positions for one control")
							yield* draft.insert(WorkSetSetting, [pulldownSetting(set, undefined, 4n)])
					})
				)
				assert.equal(result.outcome, "Rejected")
				assert.deepEqual(yield* rows(database, queries.workSets), [])
				assert.deepEqual(yield* rows(database, queries.workSetSettings), [])
			})
		))
}

test("bench facts are inline labels on each set", () =>
	run(
		Effect.gen(function* () {
			const database = yield* testDatabase()
			const session = yield* openSession(database, START)
			const press = workSet(session, "back-supported-neutral-db-overhead-press")
			const result = yield* recordSet(database, (draft) =>
				Effect.gen(function* () {
					yield* draft.insert(WorkSet, [press])
					yield* draft.insert(DumbbellWorkSet, [{ workSet: press.id, repetitions: 7n, eachTenthsLb: 205n }])
					yield* draft.insert(WorkSetBench, [
						{ workSet: press.id, exercise: press.exercise, bench: "Synthetic bench B" }
					])
					yield* draft.insert(BenchBackrestPosition, [{ workSet: press.id, mark: "high" }])
					yield* draft.insert(BenchSeatAdjustment, [{ workSet: press.id, adjustable: true }])
					yield* draft.insert(BenchSeatPosition, [{ workSet: press.id, mark: "A" }])
				})
			)
			assert.equal(result.outcome, "Committed")
			assert.deepEqual(result.relations.toSorted(), [
				"BenchBackrestPosition",
				"BenchSeatAdjustment",
				"BenchSeatPosition",
				"DumbbellWorkSet",
				"WorkSet",
				"WorkSetBench"
			])
			assert.deepEqual(yield* rows(database, queries.workSetBenches), [
				{ workSet: press.id, exercise: press.exercise, bench: "Synthetic bench B" }
			])
			assert.deepEqual(yield* rows(database, queries.benchSeatPositions), [{ workSet: press.id, mark: "A" }])
			// Historical sets may omit bench facts entirely; missing setup stays absent.
			const bare = workSet(session, "back-supported-neutral-db-overhead-press", 2n)
			const omitted = yield* recordSet(database, (draft) =>
				Effect.gen(function* () {
					yield* draft.insert(WorkSet, [bare])
					yield* draft.insert(DumbbellWorkSet, [{ workSet: bare.id, repetitions: 6n, eachTenthsLb: 205n }])
				})
			)
			assert.equal(omitted.outcome, "Committed")
			assert.equal((yield* rows(database, queries.workSetBenches)).length, 1)
		})
	))

for (const problem of [
	"a bench on a machine exercise",
	"a bench naming another exercise",
	"an angle without a bench",
	"conflicting angles",
	"a seat mark on a fixed seat",
	"a seat mark without a seat adjustment"
] as const) {
	test(`bench observations reject ${problem}`, () =>
		run(
			Effect.gen(function* () {
				const database = yield* testDatabase()
				const session = yield* openSession(database, START)
				const press = workSet(session, "back-supported-neutral-db-overhead-press")
				const pulldown = selectorSet(session)
				const result = yield* recordSet(database, (draft) =>
					Effect.gen(function* () {
						if (problem === "a bench on a machine exercise") {
							yield* pulldown.build(draft)
							yield* draft.insert(WorkSetBench, [
								{ workSet: pulldown.set.id, exercise: pulldown.set.exercise, bench: "Synthetic bench" }
							])
							return
						}
						yield* draft.insert(WorkSet, [press])
						yield* draft.insert(DumbbellWorkSet, [{ workSet: press.id, repetitions: 6n, eachTenthsLb: 205n }])
						if (problem !== "an angle without a bench")
							yield* draft.insert(WorkSetBench, [
								{
									workSet: press.id,
									exercise: problem === "a bench naming another exercise" ? "bench-tsc-neck-flexion" : press.exercise,
									bench: "Synthetic bench"
								}
							])
						yield* draft.insert(BenchBackrestAngle, [{ workSet: press.id, degrees: 80 }])
						if (problem === "conflicting angles")
							yield* draft.insert(BenchBackrestAngle, [{ workSet: press.id, degrees: 45 }])
						if (problem === "a seat mark on a fixed seat")
							yield* draft.insert(BenchSeatAdjustment, [{ workSet: press.id, adjustable: false }])
						if (problem === "a seat mark on a fixed seat" || problem === "a seat mark without a seat adjustment")
							yield* draft.insert(BenchSeatPosition, [{ workSet: press.id, mark: "2" }])
					})
				)
				assert.equal(result.outcome, "Rejected")
				assert.deepEqual(yield* rows(database, queries.workSets), [])
				assert.deepEqual(yield* rows(database, queries.workSetBenches), [])
			})
		))
}
