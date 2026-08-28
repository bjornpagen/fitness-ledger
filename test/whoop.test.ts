import assert from "node:assert/strict"
import test from "node:test"
import { regex } from "arkregex"
import {
	Activity,
	ActivityWhoopWorkout,
	EBikeActivity,
	HeartRateSummary,
	HeartRateZoneDuration,
	HeartRateZonePartitionMember,
	Person,
	SleepInterval,
	StrengthActivity,
	WhoopSleepIdentity,
	WhoopWorkout
} from "#application/schema.ts"
import { syncWhoopSnapshot } from "#application/whoop.ts"
import { decodeWhoopSleepPage, decodeWhoopWorkoutPage } from "#mechanism/whoop-client.ts"
import { reserved, testDatabase } from "./helpers.ts"

const workoutPayload = {
	records: [
		{
			id: "ecfc6a15-4661-442f-a9a4-f160dd7afae8",
			user_id: 9012,
			created_at: "2026-09-02T02:01:00Z",
			updated_at: "2026-09-02T02:02:00Z",
			start: "2026-09-01T07:00:00-05:00",
			end: "2026-09-01T08:00:00-05:00",
			timezone_offset: "-05:00",
			sport_name: "cycling",
			score_state: "SCORED",
			score: {
				strain: 12.4,
				average_heart_rate: 132,
				max_heart_rate: 151,
				kilojoule: 999.9,
				percent_recorded: 94.2,
				distance_meter: 19_000,
				altitude_gain_meter: 120,
				zone_durations: {
					zone_zero_milli: 300_000,
					zone_one_milli: 300_000,
					zone_two_milli: 3_000_000,
					zone_three_milli: 0,
					zone_four_milli: 0,
					zone_five_milli: 0
				}
			}
		}
	],
	next_token: "next-page-token",
	server_decision: "discard me"
}

const sleepPayload = {
	records: [
		{
			id: "60d2c6c8-35b7-4d3a-9f05-7ea70d6c7a35",
			cycle_id: 12,
			user_id: 9012,
			created_at: "2026-09-02T12:00:00Z",
			updated_at: "2026-09-02T12:01:00Z",
			start: "2026-09-01T22:00:00-05:00",
			end: "2026-09-02T06:30:00-05:00",
			timezone_offset: "-05:00",
			nap: false,
			score_state: "SCORED",
			score: {
				sleep_performance_percentage: 92,
				sleep_efficiency_percentage: 89,
				sleep_needed: { baseline_milli: 28_800_000 },
				stage_summary: { total_in_bed_time_milli: 28_800_000 }
			}
		}
	]
}

test("WHOOP decoding keeps only the explicit trust boundary", () => {
	const page = decodeWhoopWorkoutPage(workoutPayload)
	assert.equal(page.records.length, 1)
	const score = page.records[0]?.score
	assert.ok(score !== undefined)
	assert.equal(score.average_heart_rate, 132)
	assert.equal(Object.hasOwn(score, "strain"), false)
	assert.equal(Object.hasOwn(score, "kilojoule"), false)
	assert.equal(Object.hasOwn(score, "percent_recorded"), false)
	assert.equal(Object.hasOwn(score, "distance_meter"), false)
	assert.equal(Object.hasOwn(page, "server_decision"), false)
	const sleep = decodeWhoopSleepPage(sleepPayload).records[0]
	assert.ok(sleep !== undefined)
	assert.equal(Object.hasOwn(sleep, "score"), false)
	assert.equal(Object.hasOwn(sleep, "cycle_id"), false)
})

test("WHOOP sync is idempotent provider evidence and stores a six-slot HR partition", async () => {
	const database = await testDatabase("fitness-ledger-whoop-")
	const snapshot = {
		workouts: decodeWhoopWorkoutPage(workoutPayload).records,
		sleeps: decodeWhoopSleepPage(sleepPayload).records
	}
	assert.deepEqual(syncWhoopSnapshot(database, snapshot), {
		workoutsImported: 1,
		workoutsSkipped: 0,
		sleepsImported: 1,
		sleepsSkipped: 0
	})
	assert.deepEqual(syncWhoopSnapshot(database, snapshot), {
		workoutsImported: 0,
		workoutsSkipped: 1,
		sleepsImported: 0,
		sleepsSkipped: 1
	})
	const counts = database.read((instance) => ({
		activities: instance.count(Activity),
		workouts: instance.count(WhoopWorkout),
		summaries: instance.count(HeartRateSummary),
		zones: instance.count(HeartRateZoneDuration),
		sleeps: instance.count(SleepInterval),
		sleepIds: instance.count(WhoopSleepIdentity),
		zoneRows: instance.scan(HeartRateZoneDuration).sort((left, right) => Number(left.zone.start - right.zone.start))
	}))
	assert.equal(counts.activities, 0n)
	assert.equal(counts.workouts, 1n)
	assert.equal(counts.summaries, 1n)
	assert.equal(counts.zones, 6n)
	assert.equal(counts.sleeps, 1n)
	assert.equal(counts.sleepIds, 1n)
	assert.deepEqual(
		counts.zoneRows.map((row) => row.zone),
		Array.from({ length: 6 }, (_, index) => ({ start: BigInt(index), end: BigInt(index + 1) }))
	)
	const firstZone = counts.zoneRows[0]
	assert.ok(firstZone !== undefined)
	const missingZone = database.write((transaction) => transaction.delete(HeartRateZoneDuration, [firstZone]))
	assert.equal(missingZone.tag, "rejected")
	const summary = database.read((instance) => instance.scan(HeartRateSummary)[0])
	assert.ok(summary !== undefined)
	const missingSummary = database.write((transaction) => transaction.delete(HeartRateSummary, [summary]))
	assert.equal(missingSummary.tag, "rejected")
	const partition = database.read((instance) => instance.scan(HeartRateZonePartitionMember)[0])
	assert.ok(partition !== undefined)
	const shortenedPartition = database.write((transaction) => {
		transaction.delete(HeartRateZonePartitionMember, [partition])
		transaction.insert(HeartRateZonePartitionMember, [{ id: "SixZones", zones: { start: 0n, end: 5n } }])
	})
	assert.equal(shortenedPartition.tag, "rejected")

	const person = database.read((instance) => instance.scan(Person)[0])
	assert.ok(person !== undefined)
	const bareExternalId = Uint8Array.from(summary.externalId)
	bareExternalId[15] = (bareExternalId[15] ?? 0) ^ 1
	const bareWorkout = database.write((transaction) =>
		transaction.insert(WhoopWorkout, [
			{
				externalId: bareExternalId,
				person: person.id,
				kind: "EBike",
				span: { start: 1n, end: 2n },
				timezoneOffsetMinutes: 0n
			}
		])
	)
	assert.equal(bareWorkout.tag, "rejected")
})

test("WHOOP UUID idempotency rejects a changed trusted payload", async () => {
	const database = await testDatabase("fitness-ledger-whoop-conflict-")
	const original = decodeWhoopWorkoutPage(workoutPayload).records
	syncWhoopSnapshot(database, { workouts: original, sleeps: [] })
	const changedPayload = structuredClone(workoutPayload)
	const changedRecord = changedPayload.records[0]
	assert.ok(changedRecord !== undefined)
	changedRecord.score.average_heart_rate = 140
	const changed = decodeWhoopWorkoutPage(changedPayload).records
	assert.throws(
		() => syncWhoopSnapshot(database, { workouts: changed, sleeps: [] }),
		regex.as<string>("conflicts with its stored trusted payload")
	)
	assert.equal(
		database.read((instance) => instance.scan(HeartRateSummary)[0]?.averageBpm),
		132n
	)
})

test("WHOOP sleep identity and exact-span reuse require the entire trusted payload", async () => {
	const database = await testDatabase("fitness-ledger-whoop-sleep-conflict-")
	const original = decodeWhoopSleepPage(sleepPayload).records
	syncWhoopSnapshot(database, { workouts: [], sleeps: original })

	const changedIdentityPayload = structuredClone(sleepPayload)
	const changedIdentity = changedIdentityPayload.records[0]
	assert.ok(changedIdentity !== undefined)
	changedIdentity.nap = true
	assert.throws(
		() => syncWhoopSnapshot(database, { workouts: [], sleeps: decodeWhoopSleepPage(changedIdentityPayload).records }),
		regex.as<string>("conflicts with its stored trusted payload")
	)

	const conflictingSpanPayload = structuredClone(sleepPayload)
	const conflictingSpan = conflictingSpanPayload.records[0]
	assert.ok(conflictingSpan !== undefined)
	conflictingSpan.id = "70d2c6c8-35b7-4d3a-9f05-7ea70d6c7a35"
	conflictingSpan.timezone_offset = "-06:00"
	assert.throws(
		() => syncWhoopSnapshot(database, { workouts: [], sleeps: decodeWhoopSleepPage(conflictingSpanPayload).records }),
		regex.as<string>("conflicts with the exact stored sleep interval")
	)
	assert.deepEqual(
		database.read((instance) => instance.scan(SleepInterval).map((sleep) => [sleep.timezoneOffsetMinutes, sleep.nap])),
		[[-300n, false]]
	)
})

test("one activity may link to multiple same-person same-kind WHOOP fragments", async () => {
	const database = await testDatabase("fitness-ledger-whoop-link-")
	const fragmentPayload = structuredClone(workoutPayload)
	const fragment = fragmentPayload.records[0]
	assert.ok(fragment !== undefined)
	fragment.id = "fcfc6a15-4661-442f-a9a4-f160dd7afae8"
	fragment.start = "2026-09-01T08:00:00-05:00"
	fragment.end = "2026-09-01T08:05:00-05:00"
	const snapshot = {
		workouts: [...decodeWhoopWorkoutPage(workoutPayload).records, ...decodeWhoopWorkoutPage(fragmentPayload).records],
		sleeps: []
	}
	syncWhoopSnapshot(database, snapshot)
	const state = database.read((instance) => ({
		person: instance.scan(Person)[0],
		workouts: instance.scan(WhoopWorkout).sort((left, right) => Number(left.span.start - right.span.start))
	}))
	const person = state.person
	const firstWorkout = state.workouts[0]
	const secondWorkout = state.workouts[1]
	assert.ok(person !== undefined && firstWorkout !== undefined && secondWorkout !== undefined)

	const mismatchedKind = database.write((transaction) => {
		const activity = reserved(transaction.reserve(Activity, "id", 1n).at(0n))
		transaction.insert(Activity, [
			{
				id: activity,
				person: person.id,
				kind: "Strength",
				completedAt: firstWorkout.span.end,
				completedAtPrecision: "Millisecond",
				timezoneOffsetMinutes: firstWorkout.timezoneOffsetMinutes
			}
		])
		transaction.insert(StrengthActivity, [{ activity }])
		transaction.insert(ActivityWhoopWorkout, [
			{ activity, externalId: firstWorkout.externalId, person: person.id, kind: "Strength" }
		])
	})
	assert.equal(mismatchedKind.tag, "rejected")

	const first = database.write((transaction) => {
		const activity = reserved(transaction.reserve(Activity, "id", 1n).at(0n))
		transaction.insert(Activity, [
			{
				id: activity,
				person: person.id,
				kind: "EBike",
				completedAt: secondWorkout.span.end,
				completedAtPrecision: "Millisecond",
				timezoneOffsetMinutes: secondWorkout.timezoneOffsetMinutes
			}
		])
		transaction.insert(EBikeActivity, [{ activity }])
		transaction.insert(ActivityWhoopWorkout, [
			{ activity, externalId: firstWorkout.externalId, person: person.id, kind: "EBike" },
			{ activity, externalId: secondWorkout.externalId, person: person.id, kind: "EBike" }
		])
		return activity
	})
	assert.equal(first.tag, "accepted")
	if (first.tag !== "accepted") return
	assert.equal(
		database.read((instance) => instance.count(ActivityWhoopWorkout)),
		2n
	)

	const duplicateProviderLink = database.write((transaction) => {
		const activity = reserved(transaction.reserve(Activity, "id", 1n).at(0n))
		transaction.insert(Activity, [
			{
				id: activity,
				person: person.id,
				kind: "EBike",
				completedAt: secondWorkout.span.end + 1n,
				completedAtPrecision: "Millisecond",
				timezoneOffsetMinutes: secondWorkout.timezoneOffsetMinutes
			}
		])
		transaction.insert(EBikeActivity, [{ activity }])
		transaction.insert(ActivityWhoopWorkout, [
			{ activity, externalId: firstWorkout.externalId, person: person.id, kind: "EBike" }
		])
	})
	assert.equal(duplicateProviderLink.tag, "rejected")
})
