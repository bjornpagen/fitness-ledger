import assert from "node:assert/strict"
import test from "node:test"
import {
	Activity,
	ActivityWhoopWorkout,
	EBikeActivity,
	HeartRateSummary,
	HeartRateZoneDuration,
	Person,
	SleepInterval,
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
})

test("a conversational activity links explicitly and one-to-one to WHOOP evidence", async () => {
	const database = await testDatabase("fitness-ledger-whoop-link-")
	const snapshot = {
		workouts: decodeWhoopWorkoutPage(workoutPayload).records,
		sleeps: []
	}
	syncWhoopSnapshot(database, snapshot)
	const state = database.read((instance) => ({
		person: instance.scan(Person)[0],
		workout: instance.scan(WhoopWorkout)[0]
	}))
	const person = state.person
	const workout = state.workout
	assert.ok(person !== undefined && workout !== undefined)
	const first = database.write((transaction) => {
		const activity = reserved(transaction.reserve(Activity, "id", 1n).at(0n))
		transaction.insert(Activity, [
			{
				id: activity,
				person: person.id,
				kind: "EBike",
				completedAt: workout.span.end,
				completedAtPrecision: "Millisecond",
				timezoneOffsetMinutes: workout.timezoneOffsetMinutes
			}
		])
		transaction.insert(EBikeActivity, [{ activity }])
		transaction.insert(ActivityWhoopWorkout, [{ activity, externalId: workout.externalId }])
		return activity
	})
	assert.equal(first.tag, "accepted")
	if (first.tag !== "accepted") return

	const duplicateProviderLink = database.write((transaction) => {
		const activity = reserved(transaction.reserve(Activity, "id", 1n).at(0n))
		transaction.insert(Activity, [
			{
				id: activity,
				person: person.id,
				kind: "EBike",
				completedAt: workout.span.end + 1n,
				completedAtPrecision: "Millisecond",
				timezoneOffsetMinutes: workout.timezoneOffsetMinutes
			}
		])
		transaction.insert(EBikeActivity, [{ activity }])
		transaction.insert(ActivityWhoopWorkout, [{ activity, externalId: workout.externalId }])
	})
	assert.equal(duplicateProviderLink.tag, "rejected")

	const otherExternalId = Uint8Array.from(workout.externalId)
	otherExternalId[15] = (otherExternalId[15] ?? 0) ^ 1
	const duplicateActivityLink = database.write((transaction) => {
		transaction.insert(WhoopWorkout, [
			{
				externalId: otherExternalId,
				person: person.id,
				kind: "EBike",
				span: { start: workout.span.start + 1n, end: workout.span.end + 1n },
				timezoneOffsetMinutes: workout.timezoneOffsetMinutes
			}
		])
		transaction.insert(ActivityWhoopWorkout, [{ activity: first.value.value, externalId: otherExternalId }])
	})
	assert.equal(duplicateActivityLink.tag, "rejected")
})
