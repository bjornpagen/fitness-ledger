import type { FitnessDatabase } from "#application/database.ts"
import {
	HeartRateSummary,
	HeartRateZoneDuration,
	Person,
	SleepInterval,
	WhoopSleepIdentity,
	WhoopWorkout
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

function intervalEqual(
	left: { readonly start: bigint; readonly end: bigint },
	right: { readonly start: bigint; readonly end: bigint }
): boolean {
	return left.start === right.start && left.end === right.end
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
		const span = parseInstantSpan(record.start, record.end)
		const timezoneOffsetMinutes = parseTimezoneDesignator(record.timezoneOffset)
		const expectedZones = record.zoneMilliseconds.map((milliseconds, zone) => ({
			externalId,
			zone: { start: BigInt(zone), end: BigInt(zone + 1) },
			milliseconds: BigInt(milliseconds)
		}))
		const state = database.read((instance) => ({
			workouts: instance.scan(WhoopWorkout),
			summaries: instance.scan(HeartRateSummary),
			zones: instance.scan(HeartRateZoneDuration)
		}))
		const existing = state.workouts.find((workout) => bytesEqual(workout.externalId, externalId))
		if (existing !== undefined) {
			const summary = state.summaries.find((candidate) => bytesEqual(candidate.externalId, externalId))
			const zones = state.zones
				.filter((zone) => bytesEqual(zone.externalId, externalId))
				.sort((left, right) => Number(left.zone.start - right.zone.start))
			const exact =
				existing.person === person.id &&
				existing.kind === record.kind &&
				intervalEqual(existing.span, span) &&
				existing.timezoneOffsetMinutes === timezoneOffsetMinutes &&
				summary !== undefined &&
				summary.averageBpm === BigInt(record.averageHeartRate) &&
				summary.maxBpm === BigInt(record.maxHeartRate) &&
				intervalEqual(summary.zones, { start: 0n, end: 6n }) &&
				zones.length === expectedZones.length &&
				zones.every((zone, index) => {
					const expected = expectedZones[index]
					return (
						expected !== undefined &&
						intervalEqual(zone.zone, expected.zone) &&
						zone.milliseconds === expected.milliseconds
					)
				})
			if (!exact) return failFitnessLedger(`WHOOP workout ${record.id} conflicts with its stored trusted payload`)
			workoutsSkipped += 1
			continue
		}
		const outcome = database.write((transaction) => {
			transaction.insert(WhoopWorkout, [
				{
					externalId,
					person: person.id,
					kind: record.kind,
					span,
					timezoneOffsetMinutes
				}
			])
			transaction.insert(HeartRateSummary, [
				{
					externalId,
					averageBpm: BigInt(record.averageHeartRate),
					maxBpm: BigInt(record.maxHeartRate),
					zones: { start: 0n, end: 6n }
				}
			])
			transaction.insert(HeartRateZoneDuration, expectedZones)
		})
		if (outcome.tag !== "accepted") reject(outcome)
		workoutsImported += 1
	}

	for (const record of snapshot.sleeps) {
		const externalId = uuidBytes(record.id)
		const span = parseInstantSpan(record.start, record.end)
		const timezoneOffsetMinutes = parseTimezoneDesignator(record.timezone_offset)
		const state = database.read((instance) => ({
			identities: instance.scan(WhoopSleepIdentity),
			sleeps: instance.scan(SleepInterval)
		}))
		const identity = state.identities.find((candidate) => bytesEqual(candidate.externalId, externalId))
		if (identity !== undefined) {
			const sleep = state.sleeps.find((candidate) => candidate.id === identity.sleep)
			const exact =
				sleep !== undefined &&
				sleep.person === person.id &&
				intervalEqual(sleep.span, span) &&
				sleep.timezoneOffsetMinutes === timezoneOffsetMinutes &&
				sleep.nap === record.nap
			if (!exact) return failFitnessLedger(`WHOOP sleep ${record.id} conflicts with its stored trusted payload`)
			sleepsSkipped += 1
			continue
		}
		const existing = state.sleeps.find(
			(sleep) => sleep.person === person.id && sleep.span.start === span.start && sleep.span.end === span.end
		)
		if (
			existing !== undefined &&
			(existing.nap !== record.nap || existing.timezoneOffsetMinutes !== timezoneOffsetMinutes)
		) {
			return failFitnessLedger(`WHOOP sleep ${record.id} conflicts with the exact stored sleep interval`)
		}
		const outcome = database.write((transaction) => {
			const sleep = existing?.id ?? idAt(transaction.reserve(SleepInterval, "id", 1n), "sleep id")
			if (existing === undefined) {
				transaction.insert(SleepInterval, [
					{
						id: sleep,
						person: person.id,
						span,
						timezoneOffsetMinutes,
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
