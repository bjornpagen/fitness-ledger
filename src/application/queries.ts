import { query, v } from "@bjornpagen/bumbledb"
import {
	Activity,
	ActivityWhoopWorkout,
	DumbbellWorkSet,
	FitnessLedger,
	MachineSlotPosition,
	Measurement,
	Person,
	SelectorWorkSet,
	SleepInterval,
	TscWorkSet,
	WhoopWorkout,
	WorkSet,
	WorkSetMachineSetting
} from "#application/schema.ts"

export const profiles = query(FitnessLedger).rule((rule) => {
	const { id, name, heightTenthsIn, birthDateEpochDay, sex } = v(Person)
	return rule.match(Person, { id, name, heightTenthsIn, birthDateEpochDay, sex }).find({
		id,
		name,
		heightTenthsIn,
		birthDateEpochDay,
		sex
	})
})

export const activities = query(FitnessLedger).rule((rule) => {
	const { id, person, kind, completedAt, completedAtPrecision, timezoneOffsetMinutes } = v(Activity)
	return rule
		.match(Activity, { id, person, kind, completedAt, completedAtPrecision, timezoneOffsetMinutes })
		.find({ id, person, kind, completedAt, completedAtPrecision, timezoneOffsetMinutes })
})

export const selectorWorkSets = query(FitnessLedger).rule((rule) => {
	const { id, activity, exercise, order, painRating } = v(WorkSet)
	const { repetitions, rir, resistancePosition } = v(SelectorWorkSet)
	return rule
		.match(WorkSet, { id, activity, exercise, loadKind: "SelectorPosition", order, painRating })
		.match(SelectorWorkSet, { workSet: id, repetitions, rir, resistancePosition })
		.find({ id, activity, exercise, order, repetitions, rir, painRating, resistancePosition })
})

export const dumbbellWorkSets = query(FitnessLedger).rule((rule) => {
	const { id, activity, exercise, order, painRating } = v(WorkSet)
	const { repetitions, rir, eachTenthsLb } = v(DumbbellWorkSet)
	return rule
		.match(WorkSet, { id, activity, exercise, loadKind: "DumbbellPair", order, painRating })
		.match(DumbbellWorkSet, { workSet: id, repetitions, rir, eachTenthsLb })
		.find({ id, activity, exercise, order, repetitions, rir, painRating, eachTenthsLb })
})

export const tscWorkSets = query(FitnessLedger).rule((rule) => {
	const { id, activity, exercise, order, painRating } = v(WorkSet)
	const { durationSeconds } = v(TscWorkSet)
	return rule
		.match(WorkSet, { id, activity, exercise, loadKind: "TimedStaticContraction", order, painRating })
		.match(TscWorkSet, { workSet: id, durationSeconds })
		.find({ id, activity, exercise, order, durationSeconds, painRating })
})

export const workSetMachineSettings = query(FitnessLedger).rule((rule) => {
	const { workSet, exercise, slot, position } = v(WorkSetMachineSetting)
	return rule
		.match(WorkSetMachineSetting, { workSet, exercise, slot, position })
		.find({ workSet, exercise, slot, position })
})

export const machineSlotPositions = query(FitnessLedger).rule((rule) => {
	const { slot, position } = v(MachineSlotPosition)
	return rule.match(MachineSlotPosition, { slot, position }).find({ slot, position })
})

export const whoopWorkouts = query(FitnessLedger).rule((rule) => {
	const { externalId, person, kind, span, timezoneOffsetMinutes } = v(WhoopWorkout)
	return rule
		.match(WhoopWorkout, { externalId, person, kind, span, timezoneOffsetMinutes })
		.find({ externalId, person, kind, span, timezoneOffsetMinutes })
})

export const activityWhoopWorkouts = query(FitnessLedger).rule((rule) => {
	const { activity, externalId, person, kind } = v(ActivityWhoopWorkout)
	return rule.match(ActivityWhoopWorkout, { activity, externalId, person, kind }).find({
		activity,
		externalId,
		person,
		kind
	})
})

export const sleeps = query(FitnessLedger).rule((rule) => {
	const { id, person, span, timezoneOffsetMinutes, nap } = v(SleepInterval)
	return rule.match(SleepInterval, { id, person, span, timezoneOffsetMinutes, nap }).find({
		id,
		person,
		span,
		timezoneOffsetMinutes,
		nap
	})
})

export const measurements = query(FitnessLedger).rule((rule) => {
	const { id, person, observedAt, kind } = v(Measurement)
	return rule.match(Measurement, { id, person, observedAt, kind }).find({ id, person, observedAt, kind })
})
