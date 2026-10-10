import { Effect } from "effect"
import {
	anchorOf,
	type BenchSetup,
	type Facts,
	type RecordedSet,
	recordedSets,
	type SessionId,
	sessionsByRecency,
	type Work
} from "#application/facts.ts"
import type { PainRatingId } from "#application/schema.ts"
import { formatObservedInstant } from "#mechanism/dates.ts"
import { refuse } from "#mechanism/failure.ts"
import { naturalId } from "#mechanism/identity.ts"
import { machineControls, weightStackRule } from "#policy/equipment.ts"
import {
	type ControlId,
	controlById,
	controlsFor,
	type ExerciseId,
	exerciseById,
	isSelectorExercise,
	machineById,
	type NumberingId,
	numberingRules,
	selectorMachineByExercise
} from "#policy/exercises.ts"
import { exercisePrescriptionById, prescription } from "#policy/prescription.ts"
import { type DynamicHistoryRow, dynamicProgression } from "#policy/progression.ts"

/* The coaching step: which exercise and set come next, at which load and setup. Every unmentioned
 * value is the one on the last immediate set of the same exercise; a value never recorded is asked. */

export type Load =
	| { readonly kind: "SelectorPosition"; readonly pin: bigint }
	| { readonly kind: "DumbbellPair"; readonly tenths: bigint }
	| { readonly kind: "TimedStaticContraction"; readonly seconds: bigint }

export interface Ask {
	readonly field: string
	readonly question: string
}

export interface ControlStep {
	readonly control: ControlId
	readonly label: string
	readonly numbering: NumberingId
	readonly rule: string
	readonly position?: bigint
	readonly from?: string
}

export type BenchStep = Partial<BenchSetup> & { readonly from?: string }

export interface NextSet {
	readonly done: false
	readonly session: SessionId
	readonly exercise: ExerciseId
	readonly setNumber: bigint
	readonly load?: Load
	readonly action: string
	readonly reason: string
	readonly settings: readonly ControlStep[]
	readonly bench?: BenchStep
	readonly ask: readonly Ask[]
	readonly remaining: readonly ExerciseId[]
}

export interface Finished {
	readonly done: true
	readonly session: SessionId
	readonly remaining: readonly ExerciseId[]
}

const bySetNumber = (a: RecordedSet, b: RecordedSet) =>
	a.setNumber < b.setNumber ? -1 : a.setNumber > b.setNumber ? 1 : 0

/** Where a carried value came from, in words. */
export function describeSource(facts: Facts, set: RecordedSet, current: SessionId): string {
	if (set.session === current) return `set ${set.setNumber} this session`
	const anchor = anchorOf(facts, set.session)
	return anchor === undefined
		? `set ${set.setNumber} of an unanchored session`
		: `set ${set.setNumber} of the session ${anchor.fromStart ? "started" : "ended"} ${formatObservedInstant(anchor.at, anchor.timezoneOffsetMinutes, anchor.precision)}`
}

/**
 * The last immediate set of `exercise`: this session's latest set before `before`, otherwise the
 * latest set of the most recent anchored session that holds the exercise.
 */
export function lastImmediate(
	facts: Facts,
	sets: readonly RecordedSet[],
	session: SessionId,
	exercise: ExerciseId,
	before: bigint
): RecordedSet | undefined {
	const own = sets.filter((set) => set.exercise === exercise && set.session === session && set.setNumber < before)
	if (own.length > 0) return own.toSorted(bySetNumber).at(-1)
	for (const { session: other } of sessionsByRecency(facts)) {
		if (other === session) continue
		const earlier = sets.filter((set) => set.exercise === exercise && set.session === other)
		if (earlier.length > 0) return earlier.toSorted(bySetNumber).at(-1)
	}
	return undefined
}

const loadOf = (work: Work): Load =>
	work.kind === "SelectorPosition"
		? { kind: work.kind, pin: work.pin }
		: work.kind === "DumbbellPair"
			? { kind: work.kind, tenths: work.tenths }
			: { kind: work.kind, seconds: work.seconds }

const resistanceOf = (work: Work): bigint | undefined =>
	work.kind === "SelectorPosition" ? work.pin : work.kind === "DumbbellPair" ? work.tenths : undefined

function loadAsk(exercise: ExerciseId): Ask {
	if (!isSelectorExercise(exercise))
		return { field: "weight", question: 'Which dumbbell weight in each hand, in pounds (for example "12.5")?' }
	const machine = selectorMachineByExercise[exercise]
	return {
		field: "pin",
		question: `Which selector pin? ${weightStackRule} The ${machine} stack has ${machineById[machine].stackPositions} positions.`
	}
}

/** Progression for an exercise's first set this session, falling back to the last immediate set. */
function firstSetLoad(
	facts: Facts,
	sets: readonly RecordedSet[],
	session: SessionId,
	exercise: ExerciseId,
	last?: RecordedSet
) {
	const anchored = new Map(sessionsByRecency(facts).map(({ session: id, anchor }) => [id, anchor] as const))
	const history = sets.flatMap<DynamicHistoryRow>((set) => {
		const anchor = anchored.get(set.session)
		const resistance = resistanceOf(set.work)
		if (set.exercise !== exercise || set.session === session || anchor === undefined || resistance === undefined)
			return []
		if (set.work.kind === "TimedStaticContraction") return []
		return [
			{
				session: set.session,
				at: anchor.at,
				precision: anchor.precision,
				setNumber: set.setNumber,
				repetitions: set.work.repetitions,
				resistance
			}
		]
	})
	const unanchoredSessions = [
		...new Set(
			sets
				.filter((set) => set.exercise === exercise && set.session !== session && !anchored.has(set.session))
				.map((set) => set.session)
		)
	]
	const progression = dynamicProgression(exercise, history, {
		unanchoredSessions,
		recordedDumbbellWeights: facts.dumbbell.map((row) => row.eachTenthsLb)
	})
	const decided = ["increase", "hold", "decrease", "top-of-stack"].includes(progression.action)
	if (decided && progression.resistance !== undefined)
		return {
			action: progression.action,
			reason: progression.reason,
			load: isSelectorExercise(exercise)
				? { kind: "SelectorPosition" as const, pin: progression.resistance }
				: { kind: "DumbbellPair" as const, tenths: progression.resistance }
		}
	if (last !== undefined)
		return {
			action: progression.action,
			reason: `${progression.reason} Starting from the last set's load.`,
			load: loadOf(last.work)
		}
	return { action: progression.action, reason: progression.reason }
}

function controlSteps(facts: Facts, exercise: ExerciseId, last: RecordedSet | undefined, session: SessionId) {
	return controlsFor(exercise).map((control): ControlStep => {
		const numbering = facts.numbering.get(control) ?? controlById[control].numbering
		const position = last?.settings.get(control)
		return {
			control,
			label: machineControls[control].label,
			numbering,
			rule: numberingRules[numbering],
			...(position === undefined || last === undefined ? {} : { position, from: describeSource(facts, last, session) })
		}
	})
}

function controlAsk(step: ControlStep): Ask {
	return {
		field: `settings.${step.control}`,
		question:
			step.numbering === "Unconfirmed"
				? `${step.label}: is a number printed at the engaged position? Record it; otherwise agree a counting rule with the user and add it to the theory before recording.`
				: `${step.label} position? ${step.rule}`
	}
}

/** What a bench set still needs: a bench, a backrest angle or mark, and its seat facts. */
function benchAsks(exercise: ExerciseId, bench: Partial<BenchSetup> | undefined): Ask[] {
	const tsc = exerciseById[exercise].loadKind === "TimedStaticContraction"
	const asks: Ask[] = []
	if (bench?.name === undefined)
		asks.push({ field: "bench.name", question: "Which bench? Use the user's own name for it." })
	if (bench?.backrestAngle === undefined && bench?.backrestMark === undefined)
		asks.push({
			field: "bench.backrestAngle",
			question: `Backrest angle in degrees, or its reproducible mark (bench.backrestMark)?${tsc ? " The neck work is prescribed at 45 degrees." : ""}`
		})
	if (bench?.seatAdjustable === undefined)
		asks.push({ field: "bench.seatAdjustable", question: "Is the bench seat fixed or adjustable?" })
	else if (bench.seatAdjustable && bench.seatMark === undefined)
		asks.push({ field: "bench.seatMark", question: "Which seat mark?" })
	return asks
}

const firstUnused = (used: readonly bigint[]) => {
	let number = 1n
	while (used.includes(number)) number++
	return number
}

/** The next set of the open session: the exercise in progress, else the first unfinished one in recommended order. */
export function nextStep(
	facts: Facts,
	session: SessionId,
	chosen?: ExerciseId,
	setNumber?: bigint
): NextSet | Finished {
	const sets = recordedSets(facts)
	const own = sets.filter((set) => set.session === session)
	const count = (exercise: ExerciseId) => own.filter((set) => set.exercise === exercise).length
	const unfinished = prescription.strength.recommendedOrder.filter(
		(exercise) => count(exercise) < exercisePrescriptionById[exercise].sets
	)
	const exercise = chosen ?? unfinished.find((candidate) => count(candidate) > 0) ?? unfinished[0]
	if (exercise === undefined) return { done: true, session, remaining: [] }
	const number = setNumber ?? firstUnused(own.filter((set) => set.exercise === exercise).map((set) => set.setNumber))
	const last = lastImmediate(facts, sets, session, exercise, number)
	const policy = exercisePrescriptionById[exercise]
	const previous = last?.session === session ? last : undefined
	const decided =
		policy.loadKind === "TimedStaticContraction"
			? {
					action: "tsc",
					reason: `One ${policy.durationSeconds}-second contraction: 30 seconds moderate, 30 near-maximal, 30 hard but safe.`,
					load: { kind: "TimedStaticContraction" as const, seconds: BigInt(policy.durationSeconds) }
				}
			: previous !== undefined
				? {
						action: "same",
						reason: `Same load as set ${previous.setNumber}: the load stays constant across an exercise's sets.`,
						load: loadOf(previous.work)
					}
				: firstSetLoad(facts, sets, session, exercise, last)
	const settings = controlSteps(facts, exercise, last, session)
	const carriedBench: Partial<BenchSetup> | undefined = exerciseById[exercise].usesBench
		? (last?.bench ?? {})
		: undefined
	const bench: BenchStep | undefined =
		carriedBench === undefined
			? undefined
			: { ...carriedBench, ...(last?.bench === undefined ? {} : { from: describeSource(facts, last, session) }) }
	const ask = [
		...(decided.load === undefined ? [loadAsk(exercise)] : []),
		...settings.filter((step) => step.position === undefined).map(controlAsk),
		...(carriedBench === undefined ? [] : benchAsks(exercise, carriedBench))
	]
	return {
		done: false,
		session,
		exercise,
		setNumber: number,
		...(decided.load === undefined ? {} : { load: decided.load }),
		action: decided.action,
		reason: decided.reason,
		settings,
		...(bench === undefined ? {} : { bench }),
		ask,
		remaining: unfinished.filter((candidate) => candidate !== exercise)
	}
}

// ── turning an utterance into a set ───────────────────────────────────────

export interface BenchInput {
	readonly name?: string
	readonly backrestAngle?: number
	readonly backrestMark?: string
	readonly seatAdjustable?: boolean
	readonly seatMark?: string
}

export interface SetInput {
	readonly reps?: number
	readonly pin?: number
	readonly weight?: string
	readonly seconds?: number
	readonly pain?: PainRatingId
	readonly settings?: { readonly [control: string]: number }
	readonly bench?: BenchInput
}

/** What an unmentioned value becomes: the step's carried setup for a new set, the recorded value for a fix. */
export interface Defaults {
	readonly load?: Load
	readonly repetitions?: bigint
	readonly pain: PainRatingId
	readonly settings: ReadonlyMap<ControlId, bigint>
	readonly bench?: Partial<BenchSetup>
}

/** "12.5" pounds per hand as tenths of a pound. */
export const tenthsOf = (pounds: string) => {
	const [whole = "0", tenth = "0"] = pounds.split(".")
	return BigInt(whole) * 10n + BigInt(tenth)
}
export const poundsOf = (tenths: bigint) => `${tenths / 10n}${tenths % 10n === 0n ? "" : `.${tenths % 10n}`}`

/** A changed bench, backrest or seat replaces the old one whole; another bench's marks never carry. */
function mergeBench(base: Partial<BenchSetup> | undefined, input: BenchInput | undefined): Partial<BenchSetup> {
	if (input === undefined) return mergeBench(base, {})
	const sameBench = input.name === undefined || base?.name === undefined || input.name === base.name
	const kept = sameBench ? (base ?? {}) : {}
	const name = input.name ?? base?.name
	const backrest =
		input.backrestAngle !== undefined || input.backrestMark !== undefined
			? {
					...(input.backrestAngle === undefined ? {} : { backrestAngle: input.backrestAngle }),
					...(input.backrestMark === undefined ? {} : { backrestMark: input.backrestMark })
				}
			: {
					...(kept.backrestAngle === undefined ? {} : { backrestAngle: kept.backrestAngle }),
					...(kept.backrestMark === undefined ? {} : { backrestMark: kept.backrestMark })
				}
	const seatAdjustable = input.seatAdjustable ?? (input.seatMark === undefined ? undefined : true)
	const seat =
		seatAdjustable !== undefined
			? { seatAdjustable, ...(input.seatMark === undefined ? {} : { seatMark: input.seatMark }) }
			: {
					...(kept.seatAdjustable === undefined ? {} : { seatAdjustable: kept.seatAdjustable }),
					...(kept.seatMark === undefined ? {} : { seatMark: kept.seatMark })
				}
	return { ...(name === undefined ? {} : { name }), ...backrest, ...seat }
}

/**
 * One set from an utterance: explicit values win, everything else comes from `defaults`. A live
 * recording (`live`) refuses `NeedsInput` while any value has never been recorded.
 */
export function buildSet(
	facts: Facts,
	target: { readonly session: SessionId; readonly exercise: ExerciseId; readonly setNumber: bigint },
	defaults: Defaults,
	input: SetInput,
	live: boolean
) {
	return Effect.gen(function* () {
		const { exercise } = target
		const policy = exercisePrescriptionById[exercise]
		const kind = policy.loadKind
		const allowed: Record<typeof kind, readonly string[]> = {
			SelectorPosition: ["pin", "reps"],
			DumbbellPair: ["weight", "reps"],
			TimedStaticContraction: ["seconds"]
		}
		const given = (["reps", "pin", "weight", "seconds"] as const).filter((field) => input[field] !== undefined)
		const stray = given.filter((field) => !allowed[kind].includes(field))
		if (stray.length > 0)
			return yield* refuse(
				"InvalidInput",
				`${exercise} records ${allowed[kind].join(" and ")}, not ${stray.join(" or ")}`
			)
		const controls = controlsFor(exercise)
		const unknown = Object.keys(input.settings ?? {}).filter((control) => !controls.some((id) => id === control))
		if (unknown.length > 0)
			return yield* refuse(
				"InvalidInput",
				`${exercise} has ${controls.length === 0 ? "no machine controls" : `the controls ${controls.join(", ")}`}; not ${unknown.join(", ")}`
			)
		if (input.bench !== undefined && !exerciseById[exercise].usesBench)
			return yield* refuse("InvalidInput", `${exercise} uses no bench`)
		if (input.bench?.seatAdjustable === false && input.bench.seatMark !== undefined)
			return yield* refuse("InvalidInput", "A fixed seat has no seat mark")

		const defaultLoad = defaults.load
		const repetitions = input.reps === undefined ? defaults.repetitions : BigInt(input.reps)
		const resistance =
			kind === "SelectorPosition"
				? input.pin === undefined
					? defaultLoad?.kind === kind
						? defaultLoad.pin
						: undefined
					: BigInt(input.pin)
				: kind === "DumbbellPair"
					? input.weight === undefined
						? defaultLoad?.kind === kind
							? defaultLoad.tenths
							: undefined
						: tenthsOf(input.weight)
					: undefined
		const seconds =
			input.seconds !== undefined
				? BigInt(input.seconds)
				: defaultLoad?.kind === "TimedStaticContraction"
					? defaultLoad.seconds
					: BigInt(prescription.strength.tsc.totalSeconds)
		const work: Work | undefined =
			kind === "TimedStaticContraction"
				? { kind, seconds }
				: resistance === undefined || repetitions === undefined
					? undefined
					: kind === "SelectorPosition"
						? { kind, pin: resistance, repetitions }
						: { kind, tenths: resistance, repetitions }
		const asks: Ask[] = []
		if (kind !== "TimedStaticContraction" && repetitions === undefined)
			asks.push({ field: "reps", question: "How many clean reps?" })
		if (kind !== "TimedStaticContraction" && resistance === undefined) asks.push(loadAsk(exercise))

		const settings = new Map<ControlId, bigint>()
		for (const control of controls) {
			const explicit = input.settings?.[control]
			const position = explicit === undefined ? defaults.settings.get(control) : BigInt(explicit)
			if (position !== undefined) settings.set(control, position)
			else if (live) {
				const numbering = facts.numbering.get(control) ?? controlById[control].numbering
				asks.push(
					controlAsk({ control, label: machineControls[control].label, numbering, rule: numberingRules[numbering] })
				)
			}
		}
		const bench = exerciseById[exercise].usesBench ? mergeBench(defaults.bench, input.bench) : undefined
		if (live && bench !== undefined) asks.push(...benchAsks(exercise, bench))
		if (!live && input.bench !== undefined && bench?.name === undefined)
			return yield* refuse("InvalidInput", "Name the bench: bench facts belong to a named bench")
		if (asks.length > 0 || work === undefined)
			return yield* refuse(
				"NeedsInput",
				`Ask the user, then record again with these fields:\n${asks.map((ask) => `${ask.field}: ${ask.question}`).join("\n")}`
			)
		if (work.kind === "DumbbellPair" && work.tenths === 0n)
			return yield* refuse("InvalidInput", "A dumbbell weight is more than 0 pounds")
		if (work.kind === "SelectorPosition" && isSelectorExercise(exercise)) {
			const machine = selectorMachineByExercise[exercise]
			const positions = facts.stackPositions.get(machine) ?? machineById[machine].stackPositions
			if (work.pin > positions)
				return yield* refuse("InvalidInput", `Pin ${work.pin} is beyond the ${positions}-position ${machine} stack`)
		}
		const set: RecordedSet = {
			id: naturalId("set", target.session, exercise, `${target.setNumber}`),
			session: target.session,
			exercise,
			setNumber: target.setNumber,
			pain: input.pain ?? defaults.pain,
			work,
			settings,
			...(bench?.name === undefined ? {} : { bench: { ...bench, name: bench.name } })
		}
		return set
	})
}

/** The defaults `next` announces for a new set. */
export const stepDefaults = (step: NextSet): Defaults => ({
	...(step.load === undefined ? {} : { load: step.load }),
	pain: "NoPain",
	settings: new Map(
		step.settings.flatMap((setting) =>
			setting.position === undefined ? [] : [[setting.control, setting.position] as const]
		)
	),
	...(step.bench === undefined ? {} : { bench: step.bench })
})

/** A recorded set's own values, for a fix or a re-run. */
export const recordedDefaults = (set: RecordedSet): Defaults => ({
	load: loadOf(set.work),
	...(set.work.kind === "TimedStaticContraction" ? {} : { repetitions: set.work.repetitions }),
	pain: set.pain,
	settings: set.settings,
	...(set.bench === undefined ? {} : { bench: set.bench })
})
