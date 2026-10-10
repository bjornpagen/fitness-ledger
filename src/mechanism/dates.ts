import { regex } from "arkregex"
import { failFitnessLedger } from "#mechanism/failure.ts"

const INSTANT = regex(
	"^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})(?::(\\d{2})(?:\\.(\\d{1,3}))?)?(Z|[+-]\\d{2}:\\d{2})$"
)
const TIMEZONE_OFFSET = regex("^[+-]\\d{2}:\\d{2}$")
const MILLISECONDS_PER_MINUTE = 60_000
const MAX_DATE_MILLISECONDS = 8_640_000_000_000_000

function utcMilliseconds(
	year: number,
	month: number,
	day: number,
	hour = 0,
	minute = 0,
	second = 0,
	millisecond = 0
): number {
	const date = new Date(0)
	date.setUTCFullYear(year, month, day)
	date.setUTCHours(hour, minute, second, millisecond)
	return date.getTime()
}

function dateNumber(value: bigint): number {
	const numeric = Number(value)
	if (!Number.isSafeInteger(numeric) || Math.abs(numeric) > MAX_DATE_MILLISECONDS) {
		return failFitnessLedger("instant is outside the JavaScript date range")
	}
	return numeric
}

function integer(value: string | undefined, label: string): number {
	if (value === undefined) return failFitnessLedger(`missing ${label}`)
	const parsed = Number(value)
	if (!Number.isSafeInteger(parsed)) return failFitnessLedger(`invalid ${label}`)
	return parsed
}

function offsetFromDesignator(value: string): number {
	if (value === "Z") return 0
	if (!TIMEZONE_OFFSET.test(value)) return failFitnessLedger(`invalid timezone offset ${value}`)
	const sign = value[0] === "-" ? -1 : 1
	const hour = Number(value.slice(1, 3))
	const minute = Number(value.slice(4, 6))
	if (hour > 23 || minute > 59) return failFitnessLedger(`invalid timezone offset ${value}`)
	return sign * (hour * 60 + minute)
}

export function parseInstant(value: string): bigint {
	const match = INSTANT.exec(value)
	if (match === null) return failFitnessLedger(`invalid instant ${value}; include an explicit Z or ±HH:MM offset`)
	const year = integer(match[1], "year")
	const month = integer(match[2], "month")
	const day = integer(match[3], "day")
	const hour = integer(match[4], "hour")
	const minute = integer(match[5], "minute")
	const second = match[6] === undefined ? 0 : integer(match[6], "second")
	const millisecond = match[7] === undefined ? 0 : Number(match[7].padEnd(3, "0"))
	const offset = offsetFromDesignator(match[8] ?? "")
	if (hour > 23 || minute > 59 || second > 59) return failFitnessLedger(`invalid clock time in ${value}`)
	const naive = utcMilliseconds(year, month - 1, day, hour, minute, second, millisecond)
	const check = new Date(naive)
	if (
		check.getUTCFullYear() !== year ||
		check.getUTCMonth() !== month - 1 ||
		check.getUTCDate() !== day ||
		check.getUTCHours() !== hour ||
		check.getUTCMinutes() !== minute ||
		check.getUTCSeconds() !== second
	) {
		return failFitnessLedger(`invalid calendar instant ${value}`)
	}
	return BigInt(naive - offset * MILLISECONDS_PER_MINUTE)
}

export function timezoneOffsetMinutes(value: string): bigint {
	parseInstant(value)
	const match = INSTANT.exec(value)
	if (match === null || match[8] === undefined) {
		return failFitnessLedger(`invalid instant ${value}; include an explicit Z or ±HH:MM offset`)
	}
	return BigInt(offsetFromDesignator(match[8]))
}

export function formatInstant(epochMilliseconds: bigint): string {
	return new Date(dateNumber(epochMilliseconds)).toISOString()
}

export function formatObservedInstant(value: bigint, offset: bigint, precision: "Minute" | "Millisecond"): string {
	if (offset < -1439n || offset > 1439n) return failFitnessLedger("invalid observed timezone offset")
	const absolute = offset < 0n ? -offset : offset
	const designator =
		offset === 0n
			? "Z"
			: `${offset < 0n ? "-" : "+"}${(absolute / 60n).toString().padStart(2, "0")}:${(absolute % 60n).toString().padStart(2, "0")}`
	const local = formatInstant(value + offset * BigInt(MILLISECONDS_PER_MINUTE))
	return `${precision === "Minute" ? local.slice(0, 16) : local.slice(0, -1)}${designator}`
}

export function localMinuteToClock(localMinute: bigint): string {
	if (localMinute < 0n) return failFitnessLedger("local minute cannot be negative")
	const dayOffset = localMinute / 1440n
	const minuteOfDay = localMinute % 1440n
	const hour = minuteOfDay / 60n
	const minute = minuteOfDay % 60n
	const clock = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
	return dayOffset === 0n ? clock : `${clock}+${dayOffset}d`
}

const LONG_OFFSET = regex("^GMT(?:([+-])(\\d{2}):(\\d{2}))?$")

/** The UTC offset, in minutes, that an IANA time zone observes at one instant (daylight saving included). */
export function offsetMinutesAt(epochMilliseconds: bigint, timeZone: string): bigint {
	const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(
		new Date(dateNumber(epochMilliseconds))
	)
	const name = parts.find((part) => part.type === "timeZoneName")?.value ?? ""
	const match = LONG_OFFSET.exec(name)
	if (match === null) return failFitnessLedger(`cannot read the ${timeZone} offset from ${name}`)
	if (match[1] === undefined) return 0n
	const minutes = BigInt(integer(match[2], "offset hour") * 60 + integer(match[3], "offset minute"))
	return match[1] === "-" ? -minutes : minutes
}
