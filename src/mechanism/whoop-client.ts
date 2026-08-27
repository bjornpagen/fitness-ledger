import { regex } from "arkregex"
import { Schema } from "effect"
import { parseInstant, parseInstantSpan } from "#mechanism/dates.ts"
import { failFitnessLedger, succeeds } from "#mechanism/failure.ts"

const UuidSchema = Schema.String.check(
	Schema.isPattern(regex("^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", "i"))
)
const InstantStringSchema = Schema.String.check(
	Schema.makeFilter((value) => succeeds(() => parseInstant(value)), { message: "Expected an ISO instant." })
)
const TimezoneOffsetSchema = Schema.String.check(Schema.isPattern(regex("^(?:Z|[+-]\\d{2}:\\d{2})$")))
const NonnegativeMillisecondsSchema = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const HeartRateSchema = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 300 }))

const ZoneDurationsSchema = Schema.Struct({
	zone_zero_milli: NonnegativeMillisecondsSchema,
	zone_one_milli: NonnegativeMillisecondsSchema,
	zone_two_milli: NonnegativeMillisecondsSchema,
	zone_three_milli: NonnegativeMillisecondsSchema,
	zone_four_milli: NonnegativeMillisecondsSchema,
	zone_five_milli: NonnegativeMillisecondsSchema
})

const WorkoutScoreSchema = Schema.Struct({
	average_heart_rate: HeartRateSchema,
	max_heart_rate: HeartRateSchema,
	zone_durations: ZoneDurationsSchema
})

const WhoopWorkoutSchema = Schema.Struct({
	id: UuidSchema,
	start: InstantStringSchema,
	end: InstantStringSchema,
	timezone_offset: TimezoneOffsetSchema,
	sport_name: Schema.String,
	score_state: Schema.Literals(["SCORED", "PENDING_SCORE", "UNSCORABLE"]),
	score: Schema.optionalKey(WorkoutScoreSchema)
})

const WhoopSleepSchema = Schema.Struct({
	id: UuidSchema,
	start: InstantStringSchema,
	end: InstantStringSchema,
	timezone_offset: TimezoneOffsetSchema,
	nap: Schema.Boolean
})

export const WhoopWorkoutPageSchema = Schema.Struct({
	records: Schema.Array(WhoopWorkoutSchema),
	next_token: Schema.optionalKey(Schema.String)
})

export const WhoopSleepPageSchema = Schema.Struct({
	records: Schema.Array(WhoopSleepSchema),
	next_token: Schema.optionalKey(Schema.String)
})

export type WhoopWorkout = (typeof WhoopWorkoutSchema)["Type"]
export type WhoopSleep = (typeof WhoopSleepSchema)["Type"]
export type WhoopWorkoutPage = (typeof WhoopWorkoutPageSchema)["Type"]
export type WhoopSleepPage = (typeof WhoopSleepPageSchema)["Type"]

export const decodeWhoopWorkoutPage = Schema.decodeUnknownSync(WhoopWorkoutPageSchema)
export const decodeWhoopSleepPage = Schema.decodeUnknownSync(WhoopSleepPageSchema)

export interface WhoopSnapshot {
	readonly workouts: readonly WhoopWorkout[]
	readonly sleeps: readonly WhoopSleep[]
}

async function fetchPage(url: URL, accessToken: string): Promise<unknown> {
	const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
	if (!response.ok) return failFitnessLedger(`WHOOP ${url.pathname} returned HTTP ${response.status}`)
	return response.json()
}

async function fetchCollection<T>(
	path: "/v2/activity/workout" | "/v2/activity/sleep",
	accessToken: string,
	start: string,
	end: string,
	decode: (input: unknown) => { readonly records: readonly T[]; readonly next_token?: string }
): Promise<readonly T[]> {
	const records: T[] = []
	let nextToken: string | undefined
	do {
		const url = new URL(`https://api.prod.whoop.com/developer${path}`)
		url.searchParams.set("limit", "25")
		url.searchParams.set("start", start)
		url.searchParams.set("end", end)
		if (nextToken !== undefined) url.searchParams.set("nextToken", nextToken)
		const page = decode(await fetchPage(url, accessToken))
		records.push(...page.records)
		nextToken = page.next_token
	} while (nextToken !== undefined)
	return records
}

export async function fetchWhoopSnapshot(accessToken: string, start: string, end: string): Promise<WhoopSnapshot> {
	parseInstantSpan(start, end)
	const [workouts, sleeps] = await Promise.all([
		fetchCollection("/v2/activity/workout", accessToken, start, end, decodeWhoopWorkoutPage),
		fetchCollection("/v2/activity/sleep", accessToken, start, end, decodeWhoopSleepPage)
	])
	return { workouts, sleeps }
}
