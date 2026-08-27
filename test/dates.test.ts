import assert from "node:assert/strict"
import test from "node:test"
import {
	addLocalDays,
	calendarDateToEpochDay,
	formatEpochDay,
	parseInstant,
	scheduledSpan,
	time,
	timezoneOffsetAt,
	weekday,
	zonedLocalToInstant
} from "#mechanism/dates.ts"

const overnight = { start: 22n * 60n, end: 24n * 60n + 6n * 60n + 30n }

test("civil dates and exact offset timestamps reject normalization tricks", () => {
	assert.equal(formatEpochDay(calendarDateToEpochDay("1990-04-12")), "1990-04-12")
	assert.equal(weekday("2026-08-31"), "Monday")
	assert.equal(addLocalDays("2026-12-31", 1), "2027-01-01")
	assert.equal(parseInstant("2026-08-31T07:00:00-05:00"), parseInstant("2026-08-31T12:00:00Z"))
	assert.throws(() => calendarDateToEpochDay("2026-02-30"))
	assert.throws(() => parseInstant("2026-08-31T07:00:00"))
	assert.throws(() => parseInstant("2026-13-01T07:00:00-05:00"))
})

test("America/Chicago wall times preserve the routine across DST", () => {
	const spring = scheduledSpan("2026-03-07", overnight, "America/Chicago")
	const fall = scheduledSpan("2026-10-31", overnight, "America/Chicago")
	assert.equal(spring.end - spring.start, (7n * 60n + 30n) * time.millisecondsPerMinute)
	assert.equal(fall.end - fall.start, (9n * 60n + 30n) * time.millisecondsPerMinute)
	const summerMorning = zonedLocalToInstant("2026-08-31", "07:00", "America/Chicago")
	const winterMorning = zonedLocalToInstant("2026-12-07", "07:00", "America/Chicago")
	assert.equal(timezoneOffsetAt(summerMorning, "America/Chicago"), -300n)
	assert.equal(timezoneOffsetAt(winterMorning, "America/Chicago"), -360n)
})
