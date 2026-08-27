import type { FitnessDatabase } from "#application/database.ts"
import {
	Activity,
	EBikeActivity,
	HeartRateSummary,
	HeartRateZoneDuration,
	Person,
	SleepInterval,
	StrengthActivity,
	WhoopSleepIdentity,
	WhoopWorkoutIdentity
} from "#application/schema.ts"
import { parseInstantSpan, parseTimezoneDesignator } from "#mechanism/dates.ts"
import { failFitnessLedger } from "#mechanism/failure.ts"
import type { WhoopSnapshot } from "#mechanism/whoop-client.ts"
import { acceptWhoopWorkout } from "#policy/whoop.ts"

function uuidBytes(value: string): Uint8Array {
	const hex = value.replaceAll("-", "")
	return Uint8Array.from({ length: 16 }, (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16))
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index])
}

function one<T>(values: readonly T[], label: string): T {
	const value = values[0]
	if (values.length !== 1 || value === undefined) {
		return failFitnessLedger(`expected exactly one ${label}; found ${values.length}`)
	}
	return value
}

function idAt(range: { readonly at: (offset: bigint) => bigint | undefined }, label: string): bigint {
	const id = range.at(0n)
	if (id === undefined) return failFitnessLedger(`failed to reserve ${label}`)
	return id
}

function reject(outcome: { readonly violations: readonly { readonly canonical: string }[] }): never {
	return failFitnessLedger(
		`BumbleDB rejected WHOOP data:\n${outcome.violations.map((violation) => violation.canonical).join("\n")}`
	)
}

export interface WhoopSyncSummary {
	readonly workoutsImported: number
	readonly workoutsSkipped: number
	readonly sleepsImported: number
	readonly sleepsSkipped: number
}

export function syncWhoopSnapshot(database: FitnessDatabase, snapshot: WhoopSnapshot): WhoopSyncSummary {
	const person = database.read((instance) => one(instance.scan(Person), "person"))
	let workoutsImported = 0
	let workoutsSkipped = 0
	let sleepsImported = 0
	let sleepsSkipped = 0

	for (const raw of snapshot.workouts) {
		const record = acceptWhoopWorkout(raw)
		if (record === undefined) {
			workoutsSkipped += 1
			continue
		}
		const externalId = uuidBytes(record.id)
		const state = database.read((instance) => ({
			identities: instance.scan(WhoopWorkoutIdentity),
			activities: instance.scan(Activity),
			summaries: instance.scan(HeartRateSummary)
		}))
		if (state.identities.some((identity) => bytesEqual(identity.externalId, externalId))) {
			workoutsSkipped += 1
			continue
		}
		const span = parseInstantSpan(record.start, record.end)
		const existing = state.activities.find(
			(activity) =>
				activity.person === person.id && activity.span.start === span.start && activity.span.end === span.end
		)
		if (existing !== undefined && existing.kind !== record.kind) {
			return failFitnessLedger(
				`WHOOP ${record.id} is ${record.kind}, but its exact activity interval is already ${existing.kind}`
			)
		}
		if (existing !== undefined && state.summaries.some((summary) => summary.activity === existing.id)) {
			return failFitnessLedger(`activity ${existing.id} already has a heart-rate summary but no WHOOP identity`)
		}
		const outcome = database.write((transaction) => {
			const activity = existing?.id ?? idAt(transaction.reserve(Activity, "id", 1n), "activity id")
			if (existing === undefined) {
				transaction.insert(Activity, [
					{
						id: activity,
						person: person.id,
						kind: record.kind,
						span,
						timezoneOffsetMinutes: parseTimezoneDesignator(record.timezoneOffset)
					}
				])
				if (record.kind === "Strength") transaction.insert(StrengthActivity, [{ activity }])
				else transaction.insert(EBikeActivity, [{ activity }])
			}
			transaction.insert(WhoopWorkoutIdentity, [{ activity, externalId }])
			transaction.insert(HeartRateSummary, [
				{
					activity,
					averageBpm: BigInt(record.averageHeartRate),
					maxBpm: BigInt(record.maxHeartRate),
					zones: { start: 0n, end: 6n }
				}
			])
			transaction.insert(
				HeartRateZoneDuration,
				record.zoneMilliseconds.map((milliseconds, zone) => ({
					activity,
					zone: { start: BigInt(zone), end: BigInt(zone + 1) },
					milliseconds: BigInt(milliseconds)
				}))
			)
			return activity
		})
		if (outcome.tag !== "accepted") reject(outcome)
		workoutsImported += 1
	}

	for (const record of snapshot.sleeps) {
		const externalId = uuidBytes(record.id)
		const state = database.read((instance) => ({
			identities: instance.scan(WhoopSleepIdentity),
			sleeps: instance.scan(SleepInterval)
		}))
		if (state.identities.some((identity) => bytesEqual(identity.externalId, externalId))) {
			sleepsSkipped += 1
			continue
		}
		const span = parseInstantSpan(record.start, record.end)
		const existing = state.sleeps.find(
			(sleep) => sleep.person === person.id && sleep.span.start === span.start && sleep.span.end === span.end
		)
		if (existing !== undefined && existing.nap !== record.nap) {
			return failFitnessLedger(`WHOOP ${record.id} nap classification conflicts with the exact stored sleep interval`)
		}
		const outcome = database.write((transaction) => {
			const sleep = existing?.id ?? idAt(transaction.reserve(SleepInterval, "id", 1n), "sleep id")
			if (existing === undefined) {
				transaction.insert(SleepInterval, [
					{
						id: sleep,
						person: person.id,
						span,
						timezoneOffsetMinutes: parseTimezoneDesignator(record.timezone_offset),
						nap: record.nap
					}
				])
			}
			transaction.insert(WhoopSleepIdentity, [{ sleep, externalId }])
			return sleep
		})
		if (outcome.tag !== "accepted") reject(outcome)
		sleepsImported += 1
	}

	return { workoutsImported, workoutsSkipped, sleepsImported, sleepsSkipped }
}
