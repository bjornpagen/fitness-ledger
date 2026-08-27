import assert from "node:assert/strict"
import test from "node:test"
import { lower } from "@bjornpagen/bumbledb"
import {
	Activity,
	DumbbellWorkSet,
	EBikeActivity,
	Exercise,
	FitnessLedger,
	Person,
	SelectorWorkSet,
	SetupSetting,
	StrengthActivity,
	TscWorkSet
} from "#application/schema.ts"
import { parseInstant } from "#mechanism/dates.ts"
import { reserved, testDatabase } from "./helpers.ts"

test("the theory stores personal facts and only sealed exercise semantics", async () => {
	const specification = lower(FitnessLedger)
	const relationNames = new Set(specification.relations.map((relation) => relation.name))
	for (const forbidden of [
		"Equipment",
		"Routine",
		"RoutineWindow",
		"WorkoutTemplate",
		"CaffeineDoseCue",
		"CaffeineCutoffCue",
		"EBikeSegment"
	]) {
		assert.equal(relationNames.has(forbidden), false, `${forbidden} leaked into the personal-data theory`)
	}
	assert.equal(Exercise.axioms["cl-2403-leg-press"].loadKind, "SelectorPosition")
	assert.equal(Exercise.axioms["back-supported-neutral-db-overhead-press"].loadKind, "DumbbellPair")
	assert.equal(Exercise.axioms["bench-tsc-neck-extension"].loadKind, "TimedStaticContraction")
	assert.equal(Object.hasOwn(Exercise.axioms, "d-400-tsc-dorsiflexion"), false)

	const database = await testDatabase("fitness-ledger-theory-")
	assert.equal(
		database.read((instance) => instance.count(Activity)),
		0n
	)
})

test("work sets can attach only to strength activities", async () => {
	const database = await testDatabase("fitness-ledger-activity-")
	const person = database.read((instance) => instance.scan(Person)[0])
	assert.ok(person !== undefined)
	const outcome = database.write((transaction) => {
		const activity = reserved(transaction.reserve(Activity, "id", 1n).at(0n))
		const set = reserved(transaction.reserve(SelectorWorkSet, "id", 1n).at(0n))
		transaction.insert(Activity, [
			{
				id: activity,
				person: person.id,
				kind: "EBike",
				span: {
					start: parseInstant("2026-09-01T07:00:00-05:00"),
					end: parseInstant("2026-09-01T08:00:00-05:00")
				},
				timezoneOffsetMinutes: -300n
			}
		])
		transaction.insert(EBikeActivity, [{ activity }])
		transaction.insert(SelectorWorkSet, [
			{
				id: set,
				activity,
				exercise: "cl-2403-leg-press",
				order: 1n,
				repetitions: 10n,
				rir: 2n,
				pain: 0n,
				position: 1n
			}
		])
	})
	assert.equal(outcome.tag, "rejected")
})

test("closed exercise semantics reject the wrong work-set arm", async () => {
	const database = await testDatabase("fitness-ledger-load-kind-")
	const person = database.read((instance) => instance.scan(Person)[0])
	assert.ok(person !== undefined)
	const outcome = database.write((transaction) => {
		const activity = reserved(transaction.reserve(Activity, "id", 1n).at(0n))
		const set = reserved(transaction.reserve(DumbbellWorkSet, "id", 1n).at(0n))
		transaction.insert(Activity, [
			{
				id: activity,
				person: person.id,
				kind: "Strength",
				span: { start: 1n, end: 2n },
				timezoneOffsetMinutes: 0n
			}
		])
		transaction.insert(StrengthActivity, [{ activity }])
		transaction.insert(DumbbellWorkSet, [
			{
				id: set,
				activity,
				exercise: "cl-2403-leg-press",
				order: 1n,
				repetitions: 10n,
				rir: 2n,
				pain: 0n,
				eachTenthsLb: 200n
			}
		])
	})
	assert.equal(outcome.tag, "rejected")
})

test("one direct transaction records selector, dumbbell, and TSC work", async () => {
	const database = await testDatabase("fitness-ledger-direct-")
	const person = database.read((instance) => instance.scan(Person)[0])
	assert.ok(person !== undefined)
	const outcome = database.write((transaction) => {
		const activity = reserved(transaction.reserve(Activity, "id", 1n).at(0n))
		const selector = reserved(transaction.reserve(SelectorWorkSet, "id", 1n).at(0n))
		const dumbbell = reserved(transaction.reserve(DumbbellWorkSet, "id", 1n).at(0n))
		const tsc = reserved(transaction.reserve(TscWorkSet, "id", 1n).at(0n))
		transaction.insert(Activity, [
			{
				id: activity,
				person: person.id,
				kind: "Strength",
				span: { start: 1n, end: 2n },
				timezoneOffsetMinutes: 0n
			}
		])
		transaction.insert(StrengthActivity, [{ activity }])
		transaction.insert(SelectorWorkSet, [
			{
				id: selector,
				activity,
				exercise: "cl-2403-leg-press",
				order: 1n,
				repetitions: 10n,
				rir: 2n,
				pain: 0n,
				position: 3n
			}
		])
		transaction.insert(DumbbellWorkSet, [
			{
				id: dumbbell,
				activity,
				exercise: "back-supported-neutral-db-overhead-press",
				order: 1n,
				repetitions: 9n,
				rir: 2n,
				pain: 0n,
				eachTenthsLb: 200n
			}
		])
		transaction.insert(TscWorkSet, [
			{
				id: tsc,
				activity,
				exercise: "bench-tsc-neck-extension",
				order: 1n,
				durationSeconds: 90n,
				pain: 0n
			}
		])
	})
	assert.equal(outcome.tag, "accepted")
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

test("effective setup settings are pointwise and scoped to an exercise", async () => {
	const database = await testDatabase("fitness-ledger-setup-")
	const person = database.read((instance) => instance.scan(Person)[0])
	assert.ok(person !== undefined)
	const first = database.write((transaction) => {
		const pulldown = reserved(transaction.reserve(SetupSetting, "id", 1n).at(0n))
		const row = reserved(transaction.reserve(SetupSetting, "id", 1n).at(0n))
		transaction.insert(SetupSetting, [
			{
				id: pulldown,
				person: person.id,
				exercise: "d-200-front-lat-pulldown",
				kind: "Seat",
				value: "2",
				valid: { start: 0n, end: 100n }
			},
			{
				id: row,
				person: person.id,
				exercise: "d-200-chest-supported-mid-row",
				kind: "Seat",
				value: "4",
				valid: { start: 0n, end: 100n }
			}
		])
	})
	assert.equal(first.tag, "accepted")

	const overlap = database.write((transaction) => {
		const id = reserved(transaction.reserve(SetupSetting, "id", 1n).at(0n))
		transaction.insert(SetupSetting, [
			{
				id,
				person: person.id,
				exercise: "d-200-front-lat-pulldown",
				kind: "Seat",
				value: "3",
				valid: { start: 99n, end: 200n }
			}
		])
	})
	assert.equal(overlap.tag, "rejected")
	assert.deepEqual(
		database.read((instance) =>
			instance
				.scan(SetupSetting)
				.map((setting) => [setting.exercise, setting.value])
				.sort()
		),
		[
			["d-200-chest-supported-mid-row", "4"],
			["d-200-front-lat-pulldown", "2"]
		]
	)
})
