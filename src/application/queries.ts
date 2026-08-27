import { query, v } from "@bjornpagen/bumbledb"
import {
	Activity,
	DumbbellWorkSet,
	FitnessLedger,
	Measurement,
	Person,
	SelectorWorkSet,
	SetupSetting,
	SleepInterval,
	TscWorkSet
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
	const { id, person, kind, span, timezoneOffsetMinutes } = v(Activity)
	return rule.match(Activity, { id, person, kind, span, timezoneOffsetMinutes }).find({
		id,
		person,
		kind,
		span,
		timezoneOffsetMinutes
	})
})

export const selectorWorkSets = query(FitnessLedger).rule((rule) => {
	const { id, activity, exercise, order, repetitions, rir, pain, position } = v(SelectorWorkSet)
	return rule.match(SelectorWorkSet, { id, activity, exercise, order, repetitions, rir, pain, position }).find({
		id,
		activity,
		exercise,
		order,
		repetitions,
		rir,
		pain,
		position
	})
})

export const dumbbellWorkSets = query(FitnessLedger).rule((rule) => {
	const { id, activity, exercise, order, repetitions, rir, pain, eachTenthsLb } = v(DumbbellWorkSet)
	return rule
		.match(DumbbellWorkSet, { id, activity, exercise, order, repetitions, rir, pain, eachTenthsLb })
		.find({ id, activity, exercise, order, repetitions, rir, pain, eachTenthsLb })
})

export const tscWorkSets = query(FitnessLedger).rule((rule) => {
	const { id, activity, exercise, order, durationSeconds, pain } = v(TscWorkSet)
	return rule
		.match(TscWorkSet, { id, activity, exercise, order, durationSeconds, pain })
		.find({ id, activity, exercise, order, durationSeconds, pain })
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

export const setupAt = query(FitnessLedger).rule((rule) => {
	const { person, exercise, kind, value, valid } = v(SetupSetting)
	return rule
		.match(SetupSetting, { person, exercise, kind, value, valid })
		.where(rule.pointIn(rule.param("at"), valid))
		.find({ person, exercise, kind, value, valid })
})
