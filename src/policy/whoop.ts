import type { WhoopWorkout } from "#mechanism/whoop-client.ts"

export interface AcceptedWhoopWorkout {
	readonly id: string
	readonly start: string
	readonly end: string
	readonly timezoneOffset: string
	readonly kind: "Strength" | "EBike"
	readonly averageHeartRate: number
	readonly maxHeartRate: number
	readonly zoneMilliseconds: readonly [number, number, number, number, number, number]
}

function classifySport(sportName: string): AcceptedWhoopWorkout["kind"] | undefined {
	const normalized = sportName.trim().toLowerCase()
	if (["weightlifting", "weight lifting", "strength trainer", "powerlifting"].includes(normalized)) return "Strength"
	if (["cycling", "e-bike", "ebike", "commuting", "mountain biking"].includes(normalized)) return "EBike"
	return undefined
}

export function acceptWhoopWorkout(record: WhoopWorkout): AcceptedWhoopWorkout | undefined {
	const score = record.score
	const kind = classifySport(record.sport_name)
	if (record.score_state !== "SCORED" || score === undefined || kind === undefined) return undefined
	return {
		id: record.id,
		start: record.start,
		end: record.end,
		timezoneOffset: record.timezone_offset,
		kind,
		averageHeartRate: score.average_heart_rate,
		maxHeartRate: score.max_heart_rate,
		zoneMilliseconds: [
			score.zone_durations.zone_zero_milli,
			score.zone_durations.zone_one_milli,
			score.zone_durations.zone_two_milli,
			score.zone_durations.zone_three_milli,
			score.zone_durations.zone_four_milli,
			score.zone_durations.zone_five_milli
		]
	}
}
