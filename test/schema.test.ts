import assert from "node:assert/strict"
import test from "node:test"
import { lower } from "@bjornpagen/bumbledb"
import type { FitnessDatabase } from "#application/database.ts"
import {
	Activity,
	DumbbellWorkSet,
	EBikeActivity,
	Exercise,
	ExerciseMachineSlot,
	FitnessLedger,
	MachineSlot,
	MachineSlotPosition,
	PAIN_RATING_IDS,
	PainRating,
	type PainRatingId,
	Person,
	PrimaryProfile,
	SelectorWorkSet,
	StrengthActivity,
	TscWorkSet,
	WorkSet,
	WorkSetMachineSetting
} from "#application/schema.ts"
import type { ExerciseId } from "#policy/exercises.ts"
import { reserved, testDatabase } from "./helpers.ts"

interface SelectorSpec {
	readonly exercise: ExerciseId
	readonly loadKind: "SelectorPosition"
	readonly order: bigint
	readonly painRating: PainRatingId
	readonly repetitions: bigint
	readonly rir: bigint
	readonly resistancePosition: bigint
}

interface DumbbellSpec {
	readonly exercise: ExerciseId
	readonly loadKind: "DumbbellPair"
	readonly order: bigint
	readonly painRating: PainRatingId
	readonly repetitions: bigint
	readonly rir: bigint
	readonly eachTenthsLb: bigint
}

interface TscSpec {
	readonly exercise: ExerciseId
	readonly loadKind: "TimedStaticContraction"
	readonly order: bigint
	readonly painRating: PainRatingId
	readonly durationSeconds: bigint
}

type WorkSetSpec = SelectorSpec | DumbbellSpec | TscSpec

function personId(database: FitnessDatabase): bigint {
	const person = database.read((instance) => instance.scan(Person)[0])
	assert.ok(person !== undefined)
	return person.id
}

function insertStrengthSets(
	database: FitnessDatabase,
	specifications: readonly WorkSetSpec[]
): { readonly activity: bigint; readonly workSets: readonly bigint[] } {
	const person = personId(database)
	const outcome = database.write((transaction) => {
		const activity = reserved(transaction.reserve(Activity, "id", 1n).at(0n))
		const workSetIds = transaction.reserve(WorkSet, "id", BigInt(specifications.length))
		const workSets = specifications.map((_, index) => reserved(workSetIds.at(BigInt(index))))
		transaction.insert(Activity, [
			{
				id: activity,
				person,
				kind: "Strength",
				completedAt: 1_000n,
				completedAtPrecision: "Minute",
				timezoneOffsetMinutes: -300n
			}
		])
		transaction.insert(StrengthActivity, [{ activity }])
		transaction.insert(
			WorkSet,
			specifications.map((specification, index) => ({
				id: reserved(workSets[index]),
				activity,
				exercise: specification.exercise,
				loadKind: specification.loadKind,
				order: specification.order,
				painRating: specification.painRating
			}))
		)
		for (const [index, specification] of specifications.entries()) {
			const workSet = reserved(workSets[index])
			switch (specification.loadKind) {
				case "SelectorPosition":
					transaction.insert(SelectorWorkSet, [
						{
							workSet,
							repetitions: specification.repetitions,
							rir: specification.rir,
							resistancePosition: specification.resistancePosition
						}
					])
					break
				case "DumbbellPair":
					transaction.insert(DumbbellWorkSet, [
						{
							workSet,
							repetitions: specification.repetitions,
							rir: specification.rir,
							eachTenthsLb: specification.eachTenthsLb
						}
					])
					break
				case "TimedStaticContraction":
					transaction.insert(TscWorkSet, [{ workSet, durationSeconds: specification.durationSeconds }])
					break
			}
		}
		return { activity, workSets }
	})
	if (outcome.tag !== "accepted") {
		assert.fail(outcome.violations.map((violation) => violation.canonical).join("\n"))
	}
	return outcome.value.value
}

const selector = (exercise: ExerciseId, order: bigint, resistancePosition: bigint): SelectorSpec => ({
	exercise,
	loadKind: "SelectorPosition",
	order,
	painRating: "NoPain",
	repetitions: 6n,
	rir: 2n,
	resistancePosition
})

test("the theory contains only the hard-cutover observation model", async () => {
	const specification = lower(FitnessLedger)
	const relationNames = new Set(specification.relations.map((relation) => relation.name))
	for (const forbidden of [
		"Equipment",
		"Routine",
		"RoutineWindow",
		"WorkoutTemplate",
		"CaffeineDoseCue",
		"CaffeineCutoffCue",
		"EBikeSegment",
		"ActivityCompletion",
		"AdjustmentKind",
		"SetupSetting",
		"WhoopWorkoutIdentity"
	]) {
		assert.equal(relationNames.has(forbidden), false, `${forbidden} leaked into the theory`)
	}
	for (const relation of specification.relations) {
		for (const field of relation.fields) {
			assert.equal(["valid", "value"].includes(field.name), false, `${relation.name} retains ${field.name}`)
		}
		for (const row of relation.closed?.rows ?? []) {
			assert.notEqual(row.handle, "Other", `${relation.name} retains an Other handle`)
		}
	}
	assert.deepEqual(
		Activity.data.fields.map((field) => field.name),
		["id", "person", "kind", "completedAt", "completedAtPrecision", "timezoneOffsetMinutes"]
	)
	assert.deepEqual(
		WorkSet.data.fields.map((field) => field.name),
		["id", "activity", "exercise", "loadKind", "order", "painRating"]
	)
	assert.deepEqual(
		SelectorWorkSet.data.fields.map((field) => field.name),
		["workSet", "repetitions", "rir", "resistancePosition"]
	)
	assert.equal(Exercise.axioms["cl-2403-leg-press"].loadKind, "SelectorPosition")
	assert.equal(Exercise.axioms["back-supported-neutral-db-overhead-press"].loadKind, "DumbbellPair")
	assert.equal(Exercise.axioms["bench-tsc-neck-extension"].loadKind, "TimedStaticContraction")
	assert.equal(MachineSlot.axioms["d-200-seat-height"].machine, "d-200")
	assert.equal(MachineSlot.axioms["d-400-lower-leg-roller"].machine, "d-400")
	assert.deepEqual(PainRating.data.handles, [
		"NoPain",
		"VeryMild",
		"Discomforting",
		"Tolerable",
		"Distressing",
		"VeryDistressing",
		"Intense",
		"VeryIntense",
		"UtterlyHorrible",
		"ExcruciatingUnbearable",
		"UnimaginableUnspeakable"
	])
	assert.deepEqual(
		PAIN_RATING_IDS.map((rating) => PainRating.axioms[rating].numericRating),
		Array.from({ length: 11 }, (_, rating) => BigInt(rating))
	)

	const database = await testDatabase("fitness-ledger-theory-")
	assert.equal(
		database.read((instance) => instance.count(Activity)),
		0n
	)
})

test("the primary profile construction permits exactly one person", async () => {
	const database = await testDatabase("fitness-ledger-single-profile-")
	assert.equal(
		database.read((instance) => instance.count(Person)),
		1n
	)
	assert.equal(
		database.read((instance) => instance.count(PrimaryProfile)),
		1n
	)
	const second = database.write((transaction) => {
		const person = reserved(transaction.reserve(Person, "id", 1n).at(0n))
		transaction.insert(Person, [
			{
				id: person,
				name: "Second Example",
				heightTenthsIn: 700n,
				birthDateEpochDay: 0n,
				sex: "Male"
			}
		])
		transaction.insert(PrimaryProfile, [{ person, slot: "Primary" }])
	})
	assert.equal(second.tag, "rejected")

	const profile = database.read((instance) => instance.scan(PrimaryProfile)[0])
	assert.ok(profile !== undefined)
	const detached = database.write((transaction) => transaction.delete(PrimaryProfile, [profile]))
	assert.equal(detached.tag, "rejected")
})

test("work-set parents can attach only to strength activities", async () => {
	const database = await testDatabase("fitness-ledger-activity-")
	const person = personId(database)
	const outcome = database.write((transaction) => {
		const activity = reserved(transaction.reserve(Activity, "id", 1n).at(0n))
		const workSet = reserved(transaction.reserve(WorkSet, "id", 1n).at(0n))
		transaction.insert(Activity, [
			{
				id: activity,
				person,
				kind: "EBike",
				completedAt: 2_000n,
				completedAtPrecision: "Millisecond",
				timezoneOffsetMinutes: 0n
			}
		])
		transaction.insert(EBikeActivity, [{ activity }])
		transaction.insert(WorkSet, [
			{
				id: workSet,
				activity,
				exercise: "cl-2403-leg-press",
				loadKind: "SelectorPosition",
				order: 1n,
				painRating: "NoPain"
			}
		])
		transaction.insert(SelectorWorkSet, [{ workSet, repetitions: 8n, rir: 2n, resistancePosition: 1n }])
	})
	assert.equal(outcome.tag, "rejected")
})

test("every work-set parent requires exactly the subtype selected by load kind", async () => {
	const missingDatabase = await testDatabase("fitness-ledger-missing-arm-")
	const missingPerson = personId(missingDatabase)
	const missing = missingDatabase.write((transaction) => {
		const activity = reserved(transaction.reserve(Activity, "id", 1n).at(0n))
		const workSet = reserved(transaction.reserve(WorkSet, "id", 1n).at(0n))
		transaction.insert(Activity, [
			{
				id: activity,
				person: missingPerson,
				kind: "Strength",
				completedAt: 1n,
				completedAtPrecision: "Minute",
				timezoneOffsetMinutes: 0n
			}
		])
		transaction.insert(StrengthActivity, [{ activity }])
		transaction.insert(WorkSet, [
			{
				id: workSet,
				activity,
				exercise: "cl-2403-leg-press",
				loadKind: "SelectorPosition",
				order: 1n,
				painRating: "NoPain"
			}
		])
	})
	assert.equal(missing.tag, "rejected")

	const wrongDatabase = await testDatabase("fitness-ledger-wrong-arm-")
	const wrongPerson = personId(wrongDatabase)
	const wrong = wrongDatabase.write((transaction) => {
		const activity = reserved(transaction.reserve(Activity, "id", 1n).at(0n))
		const workSet = reserved(transaction.reserve(WorkSet, "id", 1n).at(0n))
		transaction.insert(Activity, [
			{
				id: activity,
				person: wrongPerson,
				kind: "Strength",
				completedAt: 1n,
				completedAtPrecision: "Minute",
				timezoneOffsetMinutes: 0n
			}
		])
		transaction.insert(StrengthActivity, [{ activity }])
		transaction.insert(WorkSet, [
			{
				id: workSet,
				activity,
				exercise: "cl-2403-leg-press",
				loadKind: "SelectorPosition",
				order: 1n,
				painRating: "NoPain"
			}
		])
		transaction.insert(DumbbellWorkSet, [{ workSet, repetitions: 8n, rir: 2n, eachTenthsLb: 200n }])
	})
	assert.equal(wrong.tag, "rejected")
})

test("one direct transaction records selector, dumbbell, and TSC work", async () => {
	const database = await testDatabase("fitness-ledger-direct-")
	insertStrengthSets(database, [
		selector("cl-2403-leg-press", 1n, 3n),
		{
			exercise: "back-supported-neutral-db-overhead-press",
			loadKind: "DumbbellPair",
			order: 1n,
			painRating: "NoPain",
			repetitions: 7n,
			rir: 2n,
			eachTenthsLb: 200n
		},
		{
			exercise: "bench-tsc-neck-extension",
			loadKind: "TimedStaticContraction",
			order: 1n,
			painRating: "NoPain",
			durationSeconds: 90n
		}
	])
	assert.equal(
		database.read((instance) => instance.count(WorkSet)),
		3n
	)
	assert.equal(
		database.read((instance) => instance.count(SelectorWorkSet)),
		1n
	)
	assert.equal(
		database.read((instance) => instance.count(DumbbellWorkSet)),
		1n
	)
	assert.equal(
		database.read((instance) => instance.count(TscWorkSet)),
		1n
	)
})

test("an activity completion can be corrected atomically without rewriting its set tree", async () => {
	const database = await testDatabase("fitness-ledger-correct-completion-")
	const { activity, workSets } = insertStrengthSets(database, [selector("cl-2403-leg-press", 1n, 3n)])
	const before = database.read((instance) => instance.scan(Activity).find((candidate) => candidate.id === activity))
	assert.ok(before !== undefined)
	const corrected = database.write((transaction) => {
		transaction.delete(Activity, [before])
		transaction.insert(Activity, [
			{
				...before,
				completedAt: 2_000n,
				completedAtPrecision: "Millisecond",
				timezoneOffsetMinutes: -360n
			}
		])
	})
	assert.equal(corrected.tag, "accepted")
	assert.equal(
		database.read((instance) => instance.scan(Activity).find((candidate) => candidate.id === activity)?.completedAt),
		2_000n
	)
	assert.deepEqual(
		database.read((instance) => instance.scan(WorkSet).map((set) => set.id)),
		workSets
	)
})

test("the exercise-to-machine-slot applicability roster cannot shrink", async () => {
	const database = await testDatabase("fitness-ledger-sealed-applicability-")
	const applicability = database.read((instance) => instance.scan(ExerciseMachineSlot)[0])
	assert.ok(applicability !== undefined)
	const deleted = database.write((transaction) => transaction.delete(ExerciseMachineSlot, [applicability]))
	assert.equal(deleted.tag, "rejected")
})

test("machine geometry may change between sets independently of resistance", async () => {
	const database = await testDatabase("fitness-ledger-per-set-settings-")
	const { workSets } = insertStrengthSets(database, [
		selector("d-300-horizontal-chest-press", 1n, 3n),
		selector("d-300-horizontal-chest-press", 2n, 3n)
	])
	const first = workSets[0]
	const second = workSets[1]
	assert.ok(first !== undefined && second !== undefined)
	const outcome = database.write((transaction) => {
		transaction.insert(MachineSlotPosition, [
			{ slot: "d-300-seat-height", position: 1n },
			{ slot: "d-300-seat-height", position: 2n }
		])
		transaction.insert(WorkSetMachineSetting, [
			{
				workSet: first,
				exercise: "d-300-horizontal-chest-press",
				slot: "d-300-seat-height",
				position: 1n
			},
			{
				workSet: second,
				exercise: "d-300-horizontal-chest-press",
				slot: "d-300-seat-height",
				position: 2n
			}
		])
	})
	assert.equal(outcome.tag, "accepted")
	assert.deepEqual(
		database.read((instance) =>
			instance
				.scan(WorkSetMachineSetting)
				.sort((left, right) => Number(left.workSet - right.workSet))
				.map((setting) => [setting.position])
		),
		[[1n], [2n]]
	)
	assert.deepEqual(
		database.read((instance) =>
			instance
				.scan(SelectorWorkSet)
				.sort((left, right) => Number(left.workSet - right.workSet))
				.map((set) => set.resistancePosition)
		),
		[3n, 3n]
	)
})

test("one physical D-200 seat slot is reusable across its two exercises", async () => {
	const database = await testDatabase("fitness-ledger-shared-slot-")
	const { workSets } = insertStrengthSets(database, [
		selector("d-200-front-lat-pulldown", 1n, 6n),
		selector("d-200-chest-supported-mid-row", 1n, 3n)
	])
	const pulldown = workSets[0]
	const row = workSets[1]
	assert.ok(pulldown !== undefined && row !== undefined)
	const outcome = database.write((transaction) => {
		transaction.insert(MachineSlotPosition, [{ slot: "d-200-seat-height", position: 5n }])
		transaction.insert(WorkSetMachineSetting, [
			{
				workSet: pulldown,
				exercise: "d-200-front-lat-pulldown",
				slot: "d-200-seat-height",
				position: 5n
			},
			{
				workSet: row,
				exercise: "d-200-chest-supported-mid-row",
				slot: "d-200-seat-height",
				position: 5n
			}
		])
	})
	assert.equal(outcome.tag, "accepted")
})

test("exercise applicability is a whitelist but never a completeness requirement", async () => {
	const database = await testDatabase("fitness-ledger-applicability-")
	const { workSets } = insertStrengthSets(database, [
		selector("d-200-front-lat-pulldown", 1n, 6n),
		selector("d-200-chest-supported-mid-row", 1n, 3n)
	])
	const pulldown = workSets[0]
	const row = workSets[1]
	assert.ok(pulldown !== undefined && row !== undefined)
	assert.equal(
		database.read((instance) => instance.count(WorkSetMachineSetting)),
		0n
	)
	const catalog = database.write((transaction) =>
		transaction.insert(MachineSlotPosition, [
			{ slot: "d-200-chest-pad-position", position: 4n },
			{ slot: "d-200-thigh-pad-position", position: 4n }
		])
	)
	assert.equal(catalog.tag, "accepted")
	const chestOnPulldown = database.write((transaction) =>
		transaction.insert(WorkSetMachineSetting, [
			{
				workSet: pulldown,
				exercise: "d-200-front-lat-pulldown",
				slot: "d-200-chest-pad-position",
				position: 4n
			}
		])
	)
	assert.equal(chestOnPulldown.tag, "rejected")
	const thighOnRow = database.write((transaction) =>
		transaction.insert(WorkSetMachineSetting, [
			{
				workSet: row,
				exercise: "d-200-chest-supported-mid-row",
				slot: "d-200-thigh-pad-position",
				position: 4n
			}
		])
	)
	assert.equal(thighOnRow.tag, "rejected")
})

test("one set cannot record two positions for the same slot", async () => {
	const database = await testDatabase("fitness-ledger-one-position-")
	const { workSets } = insertStrengthSets(database, [selector("d-300-horizontal-chest-press", 1n, 3n)])
	const workSet = workSets[0]
	assert.ok(workSet !== undefined)
	const outcome = database.write((transaction) => {
		transaction.insert(MachineSlotPosition, [
			{ slot: "d-300-seat-height", position: 1n },
			{ slot: "d-300-seat-height", position: 2n }
		])
		transaction.insert(WorkSetMachineSetting, [
			{
				workSet,
				exercise: "d-300-horizontal-chest-press",
				slot: "d-300-seat-height",
				position: 1n
			},
			{
				workSet,
				exercise: "d-300-horizontal-chest-press",
				slot: "d-300-seat-height",
				position: 2n
			}
		])
	})
	assert.equal(outcome.tag, "rejected")
})

test("a position cataloged for another slot does not satisfy a setting", async () => {
	const database = await testDatabase("fitness-ledger-slot-position-")
	const { workSets } = insertStrengthSets(database, [selector("d-200-front-lat-pulldown", 1n, 6n)])
	const workSet = workSets[0]
	assert.ok(workSet !== undefined)
	const catalog = database.write((transaction) =>
		transaction.insert(MachineSlotPosition, [{ slot: "d-200-thigh-pad-position", position: 4n }])
	)
	assert.equal(catalog.tag, "accepted")
	const outcome = database.write((transaction) =>
		transaction.insert(WorkSetMachineSetting, [
			{
				workSet,
				exercise: "d-200-front-lat-pulldown",
				slot: "d-200-seat-height",
				position: 4n
			}
		])
	)
	assert.equal(outcome.tag, "rejected")
})

test("a setting exercise must equal its work-set parent's exercise", async () => {
	const database = await testDatabase("fitness-ledger-setting-parent-")
	const { workSets } = insertStrengthSets(database, [selector("d-200-front-lat-pulldown", 1n, 6n)])
	const workSet = workSets[0]
	assert.ok(workSet !== undefined)
	const outcome = database.write((transaction) => {
		transaction.insert(MachineSlotPosition, [{ slot: "d-200-seat-height", position: 5n }])
		transaction.insert(WorkSetMachineSetting, [
			{
				workSet,
				exercise: "d-200-chest-supported-mid-row",
				slot: "d-200-seat-height",
				position: 5n
			}
		])
	})
	assert.equal(outcome.tag, "rejected")
})
