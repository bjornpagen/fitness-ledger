import type { FitnessDatabase } from "#application/database.ts"
import {
	Activity,
	ActivityWhoopWorkout,
	BodyWeightMeasurement,
	HeartRateSummary,
	Measurement,
	Person,
	SleepInterval,
	WaistMeasurement,
	WhoopSleepIdentity,
	WhoopWorkout,
	WorkSet,
	WorkSetMachineSetting
} from "#application/schema.ts"
import { formatEpochDay, formatInstant, localMinuteToClock } from "#mechanism/dates.ts"
import { failFitnessLedger } from "#mechanism/failure.ts"
import { exercisePrescriptionById, prescription } from "#policy/prescription.ts"

const DAY_ORDER = new Map([
	["Monday", 1],
	["Tuesday", 2],
	["Wednesday", 3],
	["Thursday", 4],
	["Friday", 5],
	["Saturday", 6],
	["Sunday", 7]
])

function one<T>(values: readonly T[], label: string): T {
	const value = values[0]
	if (values.length !== 1 || value === undefined) {
		return failFitnessLedger(`expected exactly one ${label}; found ${values.length}`)
	}
	return value
}

function first<T>(values: readonly T[], label: string): T {
	const value = values[0]
	if (value === undefined) return failFitnessLedger(`expected at least one ${label}`)
	return value
}

function days(values: readonly string[]): string {
	const ordered = [...values].sort((left, right) => (DAY_ORDER.get(left) ?? 99) - (DAY_ORDER.get(right) ?? 99))
	if (ordered.length < 3) return ordered.join(" and ")
	return `${ordered.slice(0, -1).join(", ")}, and ${ordered.at(-1) ?? ""}`
}

function clock(minutes: number): string {
	return localMinuteToClock(BigInt(minutes))
}

export function renderPlan(): string {
	const strengthStart = first(prescription.strengthStarts, "strength start")
	const eBikeStart = first(prescription.eBikeStarts, "e-bike start")
	const finalExercise = prescription.strength.exerciseOrder.at(-1)
	const cadence = prescription.strength.cadence
	const lines = [
		`Forever fitness routine — ${prescription.timeZone}`,
		"",
		"Daily anchors",
		`Wake ${clock(prescription.daily.wakeMinute)} and immediately take ${prescription.daily.caffeineMilligrams} mg caffeine. Wind down ${clock(prescription.daily.windDownMinute)}. Lights out ${clock(prescription.daily.lightsOutMinute)}.`,
		`No caffeine after ${clock(prescription.daily.caffeineCutoffMinute)}.`,
		"",
		"Weekly schedule",
		`Strength: ${days(prescription.strengthStarts.map((start) => start.day))}, start ${clock(strengthStart.startMinute)}; finish after the complete prescription with no session-duration limit.`,
		`E-bike: ${days(prescription.eBikeStarts.map((start) => start.day))}, start ${clock(eBikeStart.startMinute)}; 60 prescribed minutes.`,
		"Wednesday and Sunday: no training.",
		"",
		"Strength workout — identical Monday and Thursday",
		"Begin directly with the prescribed work sets; there is no separate warm-up or ramp sequence.",
		"Complete every set for one exercise before moving to the next; the number is the mandatory execution order.",
		`Each dynamic repetition uses ${cadence.positiveSeconds} seconds for the positive phase, a smooth continuous turnaround with no deliberate pause, and ${cadence.negativeSeconds} seconds for the negative phase.`
	]
	for (const exerciseId of prescription.strength.exerciseOrder) {
		const exercise = exercisePrescriptionById[exerciseId]
		const rest = exerciseId === finalExercise ? "workout ends" : `rest ${prescription.strength.restSeconds}s`
		if (exercise.loadKind === "TimedStaticContraction") {
			const stageSeconds = prescription.strength.tsc.stageSeconds
			lines.push(
				`${exercise.order}. ${exercise.name} — ${exercise.sets} set × ${exercise.durationSeconds}s TSC (${stageSeconds}s moderate, ${stageSeconds}s near-maximal, ${stageSeconds}s hard but safe) — ${rest} — ${exercise.equipment}`,
				`   ${exercise.technique}`
			)
			continue
		}
		lines.push(
			`${exercise.order}. ${exercise.name} — ${exercise.sets} set${exercise.sets === 1 ? "" : "s"} × ${prescription.strength.repetitionMinimum}–${prescription.strength.repetitionMaximum} reps — target about ${prescription.strength.targetRir} RIR — ${cadence.positiveSeconds}s positive / ${cadence.negativeSeconds}s negative — ${rest} — ${exercise.equipment}`,
			`   ${exercise.technique}`
		)
	}
	lines.push(
		"",
		`Dynamic progression: increase one selector position or the smallest dumbbell step only after every prescribed set for that exercise reaches ${prescription.strength.repetitionMaximum} clean reps while still targeting about ${prescription.strength.targetRir} RIR on ${prescription.strength.promotionExposures} consecutive exposures.`,
		`If the increased resistance prevents ${prescription.strength.repetitionMinimum} clean reps, return to the preceding resistance at the next exposure.`,
		"TSC progression: keep the obstacle and body position fixed, ramp effort gradually across all three phases, and record only the duration and pain actually observed; do not invent a force value or RIR.",
		"Do not deliberately train to failure or use forced reps, negatives, drop sets, or other set-extending methods.",
		"",
		"E-bike session",
		`1. ${prescription.eBike.easyOpeningMinutes} minutes easy.`,
		`2. ${prescription.eBike.zone2Minutes} minutes in WHOOP Zone 2.`,
		`3. ${prescription.eBike.easyClosingMinutes} minutes easy.`
	)
	return lines.join("\n")
}

export function renderStatus(database: FitnessDatabase): string {
	return database.read((instance) => {
		const person = one(instance.scan(Person), "person")
		const activities = instance.scan(Activity).sort((left, right) => Number(left.completedAt - right.completedAt))
		const measurements = instance.scan(Measurement).sort((left, right) => Number(left.observedAt - right.observedAt))
		const bodyWeights = new Map(
			instance.scan(BodyWeightMeasurement).map((value) => [value.measurement, value.tenthsLb])
		)
		const waists = new Map(instance.scan(WaistMeasurement).map((value) => [value.measurement, value.tenthsIn]))
		const latestWeight = measurements.filter((measurement) => measurement.kind === "BodyWeight").at(-1)
		const latestWaist = measurements.filter((measurement) => measurement.kind === "Waist").at(-1)
		const heightInches = person.heightTenthsIn / 10n
		const heightFeet = heightInches / 12n
		const heightRemainder = heightInches % 12n
		const formatTenths = (value: bigint | undefined, unit: string): string =>
			value === undefined ? "none" : `${value / 10n}.${value % 10n} ${unit}`
		const workSets = instance.count(WorkSet)
		const machineSettings = instance.count(WorkSetMachineSetting)
		return [
			"Fitness ledger status",
			`Person: ${person.name} (${heightFeet} ft ${heightRemainder} in, born ${formatEpochDay(person.birthDateEpochDay)}, ${person.sex})`,
			`Prescription: fixed forever routine (${prescription.timeZone})`,
			`Strength activities: ${activities.filter((activity) => activity.kind === "Strength").length}`,
			`E-bike activities: ${activities.filter((activity) => activity.kind === "EBike").length}`,
			`Recorded work sets: ${workSets}`,
			`Sleep intervals: ${instance.count(SleepInterval)}`,
			`Latest body weight: ${formatTenths(latestWeight === undefined ? undefined : bodyWeights.get(latestWeight.id), "lb")}`,
			`Latest waist: ${formatTenths(latestWaist === undefined ? undefined : waists.get(latestWaist.id), "in")}`,
			`Recorded work-set machine settings: ${machineSettings}`,
			`WHOOP heart-rate summaries: ${instance.count(HeartRateSummary)}`,
			`WHOOP workouts: ${instance.count(WhoopWorkout)}`,
			`Activity–WHOOP links: ${instance.count(ActivityWhoopWorkout)}`,
			`WHOOP sleep identities: ${instance.count(WhoopSleepIdentity)}`,
			`Latest activity completion: ${activities.at(-1) === undefined ? "none" : formatInstant(activities.at(-1)?.completedAt ?? 0n)}`
		].join("\n")
	})
}
