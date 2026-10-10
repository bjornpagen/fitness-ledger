import { Compute, query, v } from "@bjornpagen/bumbledb"
import {
	BenchBackrestAngle,
	BenchBackrestPosition,
	BenchSeatAdjustment,
	BenchSeatPosition,
	Control,
	DumbbellWorkSet,
	FitnessLedger,
	Machine,
	SelectorWorkSet,
	Session,
	SessionEnd,
	SessionStart,
	TscWorkSet,
	WorkSet,
	WorkSetBench,
	WorkSetSetting
} from "#application/schema.ts"

export const sessions = query(FitnessLedger).rule((rule) => {
	const { id } = v(Session)
	return rule.match(Session, { id }).find({ id })
})

export const sessionStarts = query(FitnessLedger).rule((rule) => {
	const fields = v(SessionStart)
	return rule.match(SessionStart, fields).find(fields)
})

export const sessionEnds = query(FitnessLedger).rule((rule) => {
	const fields = v(SessionEnd)
	return rule.match(SessionEnd, fields).find(fields)
})

/** Sessions without a SessionEnd: still in progress, or never closed. */
export const openSessions = query(FitnessLedger).rule((rule) => {
	const { id } = v(Session)
	return rule
		.match(Session, { id })
		.where(rule.not(SessionEnd, { session: id }))
		.find({ id })
})

/** Sessions with neither a start nor an end. Their sets cannot be ordered against other sessions. */
export const unanchoredSessions = query(FitnessLedger).rule((rule) => {
	const { id } = v(Session)
	return rule
		.match(Session, { id })
		.where(rule.not(SessionStart, { session: id }))
		.where(rule.not(SessionEnd, { session: id }))
		.find({ id })
})

/**
 * One anchor per anchored session: its SessionStart when recorded (`fromStart` true), otherwise its
 * SessionEnd (`fromStart` false). Open sessions with a start are anchored by that start.
 */
export const sessionAnchors = query(FitnessLedger)
	.rule((rule) => {
		const { session, at, precision, timezoneOffsetMinutes } = v(SessionStart)
		return rule
			.match(SessionStart, { session, at, precision, timezoneOffsetMinutes })
			.find({ session, at, precision, timezoneOffsetMinutes, fromStart: Compute.bool(true) })
	})
	.rule((rule) => {
		const { session, at, precision, timezoneOffsetMinutes } = v(SessionEnd)
		return rule
			.match(SessionEnd, { session, at, precision, timezoneOffsetMinutes })
			.where(rule.not(SessionStart, { session }))
			.find({ session, at, precision, timezoneOffsetMinutes, fromStart: Compute.bool(false) })
	})

const latestAnchorTime = query(FitnessLedger).rule((rule) => {
	const fields = v(sessionAnchors)
	return rule.match(sessionAnchors, fields).find({ at: rule.max(fields.at) })
})

/** All ties are returned; UUID generation order is not session chronology. */
export const latestSessionAnchors = query(FitnessLedger).rule((rule) => {
	const fields = v(sessionAnchors)
	const latest = v(latestAnchorTime)
	return rule
		.match(sessionAnchors, fields)
		.match(latestAnchorTime, latest)
		.where(rule.eq(fields.at, latest.at))
		.find(fields)
})

export const workSets = query(FitnessLedger).rule((rule) => {
	const fields = v(WorkSet)
	return rule.match(WorkSet, fields).find(fields)
})

export const workSetsInSession = query(FitnessLedger).rule((rule) => {
	const fields = v(WorkSet)
	return rule
		.match(WorkSet, fields)
		.where(rule.eq(fields.session, rule.param("session")))
		.find(fields)
})

export const selectorWorkSets = query(FitnessLedger).rule((rule) => {
	const { id, session, exercise, setNumber, painRating } = v(WorkSet)
	const { repetitions, resistancePosition } = v(SelectorWorkSet)
	return rule
		.match(WorkSet, { id, session, exercise, loadKind: "SelectorPosition", setNumber, painRating })
		.match(SelectorWorkSet, { workSet: id, repetitions, resistancePosition })
		.find({ id, session, exercise, setNumber, painRating, repetitions, resistancePosition })
})

export const dumbbellWorkSets = query(FitnessLedger).rule((rule) => {
	const { id, session, exercise, setNumber, painRating } = v(WorkSet)
	const { repetitions, eachTenthsLb } = v(DumbbellWorkSet)
	return rule
		.match(WorkSet, { id, session, exercise, loadKind: "DumbbellPair", setNumber, painRating })
		.match(DumbbellWorkSet, { workSet: id, repetitions, eachTenthsLb })
		.find({ id, session, exercise, setNumber, painRating, repetitions, eachTenthsLb })
})

export const tscWorkSets = query(FitnessLedger).rule((rule) => {
	const { id, session, exercise, setNumber, painRating } = v(WorkSet)
	const { durationSeconds } = v(TscWorkSet)
	return rule
		.match(WorkSet, { id, session, exercise, loadKind: "TimedStaticContraction", setNumber, painRating })
		.match(TscWorkSet, { workSet: id, durationSeconds })
		.find({ id, session, exercise, setNumber, painRating, durationSeconds })
})

/** Every distinct per-hand dumbbell weight recorded anywhere in the ledger. */
export const recordedDumbbellWeights = query(FitnessLedger).rule((rule) => {
	const { workSet, repetitions, eachTenthsLb } = v(DumbbellWorkSet)
	return rule.match(DumbbellWorkSet, { workSet, repetitions, eachTenthsLb }).find({ eachTenthsLb })
})

/** One exercise's selector sets in anchored sessions, with the session anchor. */
export const selectorHistory = query(FitnessLedger).rule((rule) => {
	const sets = v(selectorWorkSets)
	const { at, precision, timezoneOffsetMinutes, fromStart } = v(sessionAnchors)
	return rule
		.match(selectorWorkSets, sets)
		.match(sessionAnchors, { session: sets.session, at, precision, timezoneOffsetMinutes, fromStart })
		.where(rule.eq(sets.exercise, rule.param("exercise")))
		.find({ ...sets, at, precision, timezoneOffsetMinutes, fromStart })
})

export const dumbbellHistory = query(FitnessLedger).rule((rule) => {
	const sets = v(dumbbellWorkSets)
	const { at, precision, timezoneOffsetMinutes, fromStart } = v(sessionAnchors)
	return rule
		.match(dumbbellWorkSets, sets)
		.match(sessionAnchors, { session: sets.session, at, precision, timezoneOffsetMinutes, fromStart })
		.where(rule.eq(sets.exercise, rule.param("exercise")))
		.find({ ...sets, at, precision, timezoneOffsetMinutes, fromStart })
})

export const tscHistory = query(FitnessLedger).rule((rule) => {
	const sets = v(tscWorkSets)
	const { at, precision, timezoneOffsetMinutes, fromStart } = v(sessionAnchors)
	return rule
		.match(tscWorkSets, sets)
		.match(sessionAnchors, { session: sets.session, at, precision, timezoneOffsetMinutes, fromStart })
		.where(rule.eq(sets.exercise, rule.param("exercise")))
		.find({ ...sets, at, precision, timezoneOffsetMinutes, fromStart })
})

/** One exercise's sets whose session has neither a start nor an end. */
export const unanchoredWorkSets = query(FitnessLedger).rule((rule) => {
	const fields = v(WorkSet)
	return rule
		.match(WorkSet, fields)
		.where(rule.eq(fields.exercise, rule.param("exercise")))
		.where(rule.not(SessionStart, { session: fields.session }))
		.where(rule.not(SessionEnd, { session: fields.session }))
		.find(fields)
})

/** Weight-stack sizes from the closed Machine facts. */
export const machines = query(FitnessLedger).rule((rule) => {
	const { id, stackPositions } = v(Machine)
	return rule.match(Machine, { id, stackPositions }).find({ id, stackPositions })
})

/** Every machine control with its machine and numbering convention, from the closed Control facts. */
export const controls = query(FitnessLedger).rule((rule) => {
	const { id, machine, numbering } = v(Control)
	return rule.match(Control, { id, machine, numbering }).find({ control: id, machine, numbering })
})

/** Each recorded setting together with its physical control, machine and numbering convention. */
export const workSetSettings = query(FitnessLedger).rule((rule) => {
	const { workSet, exercise, control, position } = v(WorkSetSetting)
	const { machine, numbering } = v(Control)
	return rule
		.match(WorkSetSetting, { workSet, exercise, control, position })
		.match(Control, { id: control, machine, numbering })
		.find({ workSet, exercise, control, machine, numbering, position })
})

export const workSetSettingsForExercise = query(FitnessLedger).rule((rule) => {
	const fields = v(workSetSettings)
	return rule
		.match(workSetSettings, fields)
		.where(rule.eq(fields.exercise, rule.param("exercise")))
		.find(fields)
})

export const workSetBenches = query(FitnessLedger).rule((rule) => {
	const fields = v(WorkSetBench)
	return rule.match(WorkSetBench, fields).find(fields)
})
export const benchBackrestAngles = query(FitnessLedger).rule((rule) => {
	const fields = v(BenchBackrestAngle)
	return rule.match(BenchBackrestAngle, fields).find(fields)
})
export const benchBackrestPositions = query(FitnessLedger).rule((rule) => {
	const fields = v(BenchBackrestPosition)
	return rule.match(BenchBackrestPosition, fields).find(fields)
})
export const benchSeatAdjustments = query(FitnessLedger).rule((rule) => {
	const fields = v(BenchSeatAdjustment)
	return rule.match(BenchSeatAdjustment, fields).find(fields)
})
export const benchSeatPositions = query(FitnessLedger).rule((rule) => {
	const fields = v(BenchSeatPosition)
	return rule.match(BenchSeatPosition, fields).find(fields)
})

export const sessionCount = query(FitnessLedger).rule((rule) => {
	const { id } = v(Session)
	return rule.match(Session, { id }).find({ count: rule.count() })
})
export const openSessionCount = query(FitnessLedger).rule((rule) => {
	const { id } = v(Session)
	return rule
		.match(Session, { id })
		.where(rule.not(SessionEnd, { session: id }))
		.find({ count: rule.count() })
})
export const workSetCount = query(FitnessLedger).rule((rule) =>
	rule.match(WorkSet, v(WorkSet)).find({ count: rule.count() })
)
export const settingCount = query(FitnessLedger).rule((rule) =>
	rule.match(WorkSetSetting, v(WorkSetSetting)).find({ count: rule.count() })
)
