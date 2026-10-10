import assert from "node:assert/strict"
import test from "node:test"
import {
	formatInstant,
	formatObservedInstant,
	localMinuteToClock,
	offsetMinutesAt,
	parseInstant,
	timezoneOffsetMinutes
} from "#mechanism/dates.ts"

test("exact offset timestamps reject normalization tricks", () => {
	assert.equal(parseInstant("2026-08-31T07:00:00-05:00"), parseInstant("2026-08-31T12:00:00Z"))
	assert.equal(timezoneOffsetMinutes("2026-08-31T07:00:00-05:00"), -300n)
	assert.equal(timezoneOffsetMinutes("2026-08-31T12:00:00Z"), 0n)
	assert.throws(() => parseInstant("2026-08-31T07:00:00"))
	assert.throws(() => parseInstant("2026-13-01T07:00:00-05:00"))
	assert.throws(() => parseInstant("2026-02-30T07:00:00-05:00"))
	assert.throws(() => parseInstant("2026-08-31T24:00:00-05:00"))
	assert.throws(() => parseInstant("2026-08-31T07:00:00-24:00"))
	assert.throws(() => timezoneOffsetMinutes("2026-02-30T07:00:00-05:00"))
})

test("instants preserve seconds, fractional seconds, and pre-epoch values", () => {
	const base = parseInstant("2026-09-07T07:00:00-05:00")
	for (const [suffix, milliseconds] of [
		["00.000", 0n],
		["29.999", 29_999n],
		["30.001", 30_001n],
		["45.125", 45_125n],
		["59.999", 59_999n]
	] as const)
		assert.equal(parseInstant(`2026-09-07T07:00:${suffix}-05:00`) - base, milliseconds)
	assert.equal(parseInstant("1969-12-31T17:59:59.999-06:00"), -1n)
	assert.equal(timezoneOffsetMinutes("1969-12-31T17:59:59.999-06:00"), -360n)
})

test("a repeated local wall time is distinguished only by its explicit offset", () => {
	assert.equal(parseInstant("2026-11-01T01:30:00-06:00") - parseInstant("2026-11-01T01:30:00-05:00"), 3_600_000n)
})

test("date range checks and four-digit early years never silently normalize", () => {
	for (const date of ["0000-02-29", "0001-01-01", "0099-12-31", "2000-02-29", "9999-12-31"])
		assert.equal(formatInstant(parseInstant(`${date}T00:00:00Z`)), `${date}T00:00:00.000Z`)
	assert.throws(() => parseInstant("0001-02-29T00:00:00Z"))
	assert.throws(() => formatInstant(8_640_000_000_000_001n))
})

test("observed time formatting respects supplied offset and precision", () => {
	const instant = parseInstant("2026-09-06T09:17:44.125-05:00")
	assert.equal(formatObservedInstant(instant, -300n, "Millisecond"), "2026-09-06T09:17:44.125-05:00")
	assert.equal(formatObservedInstant(instant, -300n, "Minute"), "2026-09-06T09:17-05:00")
	assert.equal(formatObservedInstant(instant, 0n, "Minute"), "2026-09-06T14:17Z")
	assert.throws(() => formatObservedInstant(instant, 1440n, "Minute"))
})

test("local minutes render as a wall clock with any day offset", () => {
	assert.equal(localMinuteToClock(7n * 60n), "07:00")
	assert.equal(localMinuteToClock(24n * 60n + 30n), "00:30+1d")
	assert.throws(() => localMinuteToClock(-1n))
})

test("a time zone's offset follows daylight saving at each instant", () => {
	assert.equal(offsetMinutesAt(parseInstant("2026-10-12T12:00:00Z"), "America/Chicago"), -300n)
	assert.equal(offsetMinutesAt(parseInstant("2026-11-02T12:00:00Z"), "America/Chicago"), -360n)
	// The fall-back hour: 01:30 happens twice, first at -05:00, then at -06:00.
	assert.equal(offsetMinutesAt(parseInstant("2026-11-01T01:30:00-05:00"), "America/Chicago"), -300n)
	assert.equal(offsetMinutesAt(parseInstant("2026-11-01T01:30:00-06:00"), "America/Chicago"), -360n)
	assert.equal(offsetMinutesAt(parseInstant("2026-10-12T12:00:00Z"), "UTC"), 0n)
	assert.equal(offsetMinutesAt(parseInstant("2026-10-12T12:00:00Z"), "Asia/Kolkata"), 330n)
})
