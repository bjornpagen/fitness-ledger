import { regex } from "arkregex"
import { failFitnessLedger } from "#mechanism/failure.ts"

const DATE = regex("^(\\d{4})-(\\d{2})-(\\d{2})$")
const TIME = regex("^(\\d{2}):(\\d{2})$")
const INSTANT = regex(
	"^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})(?::(\\d{2})(?:\\.(\\d{1,3}))?)?(Z|[+-]\\d{2}:\\d{2})$"
)
const TIMEZONE_OFFSET = regex("^[+-]\\d{2}:\\d{2}$")
const MILLISECONDS_PER_MINUTE = 60_000
const MILLISECONDS_PER_DAY = 86_400_000

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const
export type DayName = (typeof DAY_NAMES)[number]

interface CalendarParts {
	readonly year: number
	readonly month: number
	readonly day: number
}

function integer(value: string | undefined, label: string): number {
	if (value === undefined) return failFitnessLedger(`missing ${label}`)
	const parsed = Number(value)
	if (!Number.isSafeInteger(parsed)) return failFitnessLedger(`invalid ${label}`)
	return parsed
}

function calendarParts(value: string): CalendarParts {
	const match = DATE.exec(value)
	if (match === null) return failFitnessLedger(`invalid date ${value}; expected YYYY-MM-DD`)
	const year = integer(match[1], "year")
	const month = integer(match[2], "month")
	const day = integer(match[3], "day")
	const check = new Date(Date.UTC(year, month - 1, day))
	if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
		return failFitnessLedger(`invalid calendar date ${value}`)
	}
	return { year, month, day }
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

export function parseTimezoneDesignator(value: string): bigint {
	return BigInt(offsetFromDesignator(value))
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
	const naive = Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
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

export function parseInstantSpan(start: string, end: string): { readonly start: bigint; readonly end: bigint } {
	const span = { start: parseInstant(start), end: parseInstant(end) }
	if (span.end <= span.start) return failFitnessLedger(`end ${end} must be later than start ${start}`)
	return span
}

export function timezoneOffsetMinutes(value: string): bigint {
	const match = INSTANT.exec(value)
	if (match === null || match[8] === undefined) {
		return failFitnessLedger(`invalid instant ${value}; include an explicit Z or ±HH:MM offset`)
	}
	return BigInt(offsetFromDesignator(match[8]))
}

export function formatInstant(epochMilliseconds: bigint): string {
	const numeric = Number(epochMilliseconds)
	if (!Number.isSafeInteger(numeric))
		return failFitnessLedger(`instant ${epochMilliseconds} is outside the JavaScript date range`)
	return new Date(numeric).toISOString()
}

export function weekday(value: string): DayName {
	const { year, month, day } = calendarParts(value)
	const result = DAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
	if (result === undefined) return failFitnessLedger(`unable to derive weekday for ${value}`)
	return result
}

export function calendarDateToEpochDay(value: string): bigint {
	const { year, month, day } = calendarParts(value)
	return BigInt(Math.floor(Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY))
}

export function formatEpochDay(epochDay: bigint): string {
	return new Date(Number(epochDay) * MILLISECONDS_PER_DAY).toISOString().slice(0, 10)
}

export function addLocalDays(value: string, count: number): string {
	if (!Number.isSafeInteger(count)) return failFitnessLedger("day count must be an integer")
	const { year, month, day } = calendarParts(value)
	return new Date(Date.UTC(year, month - 1, day + count)).toISOString().slice(0, 10)
}

function parseClock(value: string): { readonly hour: number; readonly minute: number } {
	const match = TIME.exec(value)
	if (match === null) return failFitnessLedger(`invalid local time ${value}; expected HH:MM`)
	const hour = integer(match[1], "hour")
	const minute = integer(match[2], "minute")
	if (hour > 23 || minute > 59) return failFitnessLedger(`invalid local time ${value}`)
	return { hour, minute }
}

function localPartsAt(
	epochMilliseconds: number,
	timeZone: string
): Required<CalendarParts> & { readonly hour: number; readonly minute: number } {
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23"
	})
	const values = new Map(formatter.formatToParts(new Date(epochMilliseconds)).map((part) => [part.type, part.value]))
	return {
		year: integer(values.get("year"), "formatted year"),
		month: integer(values.get("month"), "formatted month"),
		day: integer(values.get("day"), "formatted day"),
		hour: integer(values.get("hour"), "formatted hour"),
		minute: integer(values.get("minute"), "formatted minute")
	}
}

export function zonedLocalToInstant(date: string, time: string, timeZone: string): bigint {
	const calendar = calendarParts(date)
	const clock = parseClock(time)
	const desired = Date.UTC(calendar.year, calendar.month - 1, calendar.day, clock.hour, clock.minute)
	let candidate = desired
	for (let attempt = 0; attempt < 4; attempt += 1) {
		const local = localPartsAt(candidate, timeZone)
		const represented = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute)
		candidate += desired - represented
	}
	const resolved = localPartsAt(candidate, timeZone)
	if (
		resolved.year !== calendar.year ||
		resolved.month !== calendar.month ||
		resolved.day !== calendar.day ||
		resolved.hour !== clock.hour ||
		resolved.minute !== clock.minute
	) {
		return failFitnessLedger(`${date} ${time} does not resolve uniquely as a local wall time in ${timeZone}`)
	}
	return BigInt(candidate)
}

export function timezoneOffsetAt(epochMilliseconds: bigint, timeZone: string): bigint {
	const numeric = Number(epochMilliseconds)
	if (!Number.isSafeInteger(numeric)) return failFitnessLedger("instant is outside the JavaScript date range")
	const local = localPartsAt(numeric, timeZone)
	const represented = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute)
	return BigInt(Math.round((represented - numeric) / MILLISECONDS_PER_MINUTE))
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

export function scheduledSpan(
	startDate: string,
	localMinutes: { readonly start: bigint; readonly end: bigint },
	timeZone: string
): { readonly start: bigint; readonly end: bigint } {
	const resolveMinute = (value: bigint): bigint => {
		const dayOffset = Number(value / 1440n)
		const minute = value % 1440n
		const clock = `${(minute / 60n).toString().padStart(2, "0")}:${(minute % 60n).toString().padStart(2, "0")}`
		return zonedLocalToInstant(addLocalDays(startDate, dayOffset), clock, timeZone)
	}
	return { start: resolveMinute(localMinutes.start), end: resolveMinute(localMinutes.end) }
}

export const time = {
	millisecondsPerDay: BigInt(MILLISECONDS_PER_DAY),
	millisecondsPerMinute: BigInt(MILLISECONDS_PER_MINUTE)
} as const
