import { existsSync } from "node:fs"
import { type Bumble, DbError } from "@bjornpagen/bumbledb"
import { regex } from "arkregex"
import { type Cause, Effect, Schema } from "effect"
import {
	type BenchInput,
	buildSet,
	type Finished,
	type NextSet,
	nextStep,
	poundsOf,
	recordedDefaults,
	type SetInput,
	stepDefaults
} from "#application/coach.ts"
import { createFitnessDatabase, type FitnessDatabase, openFitnessDatabase } from "#application/database.ts"
import {
	anchorOf,
	type Facts,
	insert,
	type ObservedTime,
	openSessions,
	type Plan,
	type RecordedSet,
	type Row,
	readFacts,
	recordedSets,
	remove,
	replace,
	rowKey,
	rowsOf,
	type SessionId,
	sessionsByRecency,
	write
} from "#application/facts.ts"
import { PAIN_RATING_IDS } from "#application/schema.ts"
import {
	formatObservedInstant,
	localMinuteToClock,
	offsetMinutesAt,
	parseInstant,
	timezoneOffsetMinutes
} from "#mechanism/dates.ts"
import { FitnessLedgerFailure, refuse, renderUnknownFailure } from "#mechanism/failure.ts"
import { observationId } from "#mechanism/identity.ts"
import { equipmentConfirmation, machineControls, weightStacks } from "#policy/equipment.ts"
import {
	controlsFor,
	DAY_IDS,
	EXERCISE_IDS,
	type ExerciseId,
	exerciseById,
	isSelectorExercise,
	machineById,
	selectorMachineByExercise
} from "#policy/exercises.ts"
import { exercisePrescriptionById, prescription } from "#policy/prescription.ts"

/* The op table: one JSON object in, one JSON object out. A write plans on one snapshot of the facts
 * and the theory judges the result; an identical re-run is no change. */

export interface Context {
	/** The BumbleDB store directory, inside private/. */
	readonly store: string
	/** Epoch milliseconds of "now": the default for every omitted time. */
	readonly now: bigint
}

type Failure = FitnessLedgerFailure | DbError

// ── time ──────────────────────────────────────────────────────────────────

const formatTime = (time: ObservedTime) => formatObservedInstant(time.at, time.timezoneOffsetMinutes, time.precision)
const localDay = (time: ObservedTime) =>
	formatObservedInstant(time.at, time.timezoneOffsetMinutes, "Minute").slice(0, 10)
const weekday = (time: ObservedTime) =>
	DAY_IDS[(new Date(Number(time.at + time.timezoneOffsetMinutes * 60_000n)).getUTCDay() + 6) % 7] ?? "Monday"

const invalid = (cause: unknown) =>
	cause instanceof FitnessLedgerFailure
		? cause
		: new FitnessLedgerFailure({ code: "InvalidInput", message: renderUnknownFailure(cause), cause })

/** Now, to the minute, at the prescription's time-zone offset at that instant. */
const nowObserved = (now: bigint) =>
	Effect.try({
		try: (): ObservedTime => {
			const at = now - (((now % 60_000n) + 60_000n) % 60_000n)
			return { at, precision: "Minute", timezoneOffsetMinutes: offsetMinutesAt(at, prescription.timeZone) }
		},
		catch: invalid
	})

/** An ISO time with its offset; minute precision unless it carries fractional seconds. */
const observedFrom = (text: string | undefined, now: bigint) =>
	text === undefined
		? nowObserved(now)
		: Effect.try({
				try: (): ObservedTime => ({
					at: parseInstant(text),
					precision: text.includes(".") ? "Millisecond" : "Minute",
					timezoneOffsetMinutes: timezoneOffsetMinutes(text)
				}),
				catch: invalid
			}).pipe(
				Effect.flatMap((time) =>
					time.at < 0n ? refuse("InvalidInput", `${text} is before 1970`) : Effect.succeed(time)
				)
			)

// ── sessions ──────────────────────────────────────────────────────────────

const startOf = (facts: Facts, session: SessionId) => facts.starts.find((row) => row.session === session)
const endOf = (facts: Facts, session: SessionId) => facts.ends.find((row) => row.session === session)
const setCount = (facts: Facts, session: SessionId) => facts.workSets.filter((row) => row.session === session).length

const sessionView = (facts: Facts, session: SessionId) => {
	const start = startOf(facts, session)
	const end = endOf(facts, session)
	return {
		session,
		start: start === undefined ? null : formatTime(start),
		end: end === undefined ? null : formatTime(end),
		sets: setCount(facts, session)
	}
}

const theOpenSession = (facts: Facts) => {
	const open = openSessions(facts)
	const [session, ...others] = open
	if (session === undefined) return refuse("NoOpenSession", "No session is open; start one with session.start")
	if (others.length > 0)
		return refuse(
			"AmbiguousSession",
			`Sessions ${open.join(", ")} are all open; close the extra ones with session.fix {"session", "end"}`
		)
	return Effect.succeed(session)
}

/** A named session, else the open one, else the most recent. */
const targetSession = (facts: Facts, given: string | undefined) => {
	if (given !== undefined) {
		const session = facts.sessions.find((id) => id === given.toLowerCase())
		return session === undefined ? refuse("SessionMissing", `No session ${given}`) : Effect.succeed(session)
	}
	const open = openSessions(facts)
	const [only] = open
	if (only !== undefined && open.length === 1) return Effect.succeed(only)
	const latest = sessionsByRecency(facts)[0]
	return latest === undefined ? refuse("NoSession", "No session is recorded") : Effect.succeed(latest.session)
}

// ── views: plain JSON ─────────────────────────────────────────────────────

const benchView = (bench: Partial<BenchInput>) => ({
	...(bench.name === undefined ? {} : { name: bench.name }),
	...(bench.backrestAngle === undefined ? {} : { backrestAngle: bench.backrestAngle }),
	...(bench.backrestMark === undefined ? {} : { backrestMark: bench.backrestMark }),
	...(bench.seatAdjustable === undefined ? {} : { seatAdjustable: bench.seatAdjustable }),
	...(bench.seatMark === undefined ? {} : { seatMark: bench.seatMark })
})

const setView = (set: RecordedSet) => ({
	session: set.session,
	exercise: set.exercise,
	set: Number(set.setNumber),
	...(set.work.kind === "SelectorPosition"
		? { reps: Number(set.work.repetitions), pin: Number(set.work.pin) }
		: set.work.kind === "DumbbellPair"
			? { reps: Number(set.work.repetitions), weight: poundsOf(set.work.tenths) }
			: { seconds: Number(set.work.seconds) }),
	pain: set.pain,
	settings: Object.fromEntries([...set.settings].map(([control, position]) => [control, Number(position)])),
	...(set.bench === undefined ? {} : { bench: benchView(set.bench) })
})

const exerciseView = (exercise: ExerciseId) => {
	const policy = exercisePrescriptionById[exercise]
	const { cadence, repetitionMinimum, repetitionMaximum, restSeconds, tsc } = prescription.strength
	return {
		id: exercise,
		name: policy.name,
		equipment: policy.equipment,
		technique: policy.technique,
		sets: policy.sets,
		...(policy.loadKind === "TimedStaticContraction"
			? {
					seconds: policy.durationSeconds,
					protocol: `${tsc.stageSeconds} s moderate, ${tsc.stageSeconds} s near-maximal, ${tsc.stageSeconds} s hard but safe`
				}
			: {
					reps: `${repetitionMinimum}–${repetitionMaximum}`,
					tempo: `${cadence.positiveSeconds} s up, ${cadence.negativeSeconds} s down, smooth turnaround`
				}),
		restSeconds
	}
}

const stepView = (step: NextSet | Finished) => {
	if (step.done)
		return {
			done: true,
			session: step.session,
			remaining: step.remaining,
			suggestion: "Every prescribed set is recorded: session.end"
		}
	const load = step.load
	return {
		done: false,
		session: step.session,
		exercise: exerciseView(step.exercise),
		set: Number(step.setNumber),
		load: {
			...(load === undefined
				? {}
				: load.kind === "SelectorPosition"
					? { pin: Number(load.pin) }
					: load.kind === "DumbbellPair"
						? { weight: poundsOf(load.tenths) }
						: { seconds: Number(load.seconds) }),
			action: step.action,
			reason: step.reason
		},
		...(isSelectorExercise(step.exercise)
			? {
					stack: {
						machine: selectorMachineByExercise[step.exercise],
						positions: Number(machineById[selectorMachineByExercise[step.exercise]].stackPositions),
						plates: weightStacks[selectorMachineByExercise[step.exercise]].composition,
						decals: weightStacks[selectorMachineByExercise[step.exercise]].decals
					}
				}
			: {}),
		settings: step.settings.map((setting) => ({
			control: setting.control,
			label: setting.label,
			position: setting.position === undefined ? null : Number(setting.position),
			from: setting.from ?? null,
			numbering: setting.numbering,
			rule: setting.rule
		})),
		...(step.bench === undefined ? {} : { bench: { ...benchView(step.bench), from: step.bench.from ?? null } }),
		ask: step.ask,
		remaining: step.remaining
	}
}

// ── inputs ────────────────────────────────────────────────────────────────

const PositiveInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))
const Text = Schema.String.check(Schema.isMinLength(1))
const Exercise = Schema.Literals(EXERCISE_IDS)
const Instant = Schema.String
const SessionInput = Schema.String
const Bench = Schema.Struct({
	name: Schema.optionalKey(Text),
	backrestAngle: Schema.optionalKey(Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 90 }))),
	backrestMark: Schema.optionalKey(Text),
	seatAdjustable: Schema.optionalKey(Schema.Boolean),
	seatMark: Schema.optionalKey(Text)
})
const SetFields = {
	reps: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
	pin: Schema.optionalKey(PositiveInt),
	weight: Schema.optionalKey(Schema.String.check(Schema.isPattern(regex("^\\d{1,4}(\\.\\d)?$")))),
	seconds: Schema.optionalKey(PositiveInt),
	pain: Schema.optionalKey(Schema.Literals(PAIN_RATING_IDS)),
	settings: Schema.optionalKey(Schema.Record(Schema.String, PositiveInt)),
	bench: Schema.optionalKey(Bench)
}
const Nothing = Schema.Struct({})
const RecordInput = Schema.Struct({
	exercise: Schema.optionalKey(Exercise),
	set: Schema.optionalKey(PositiveInt),
	session: Schema.optionalKey(SessionInput),
	...SetFields
})
const FixInput = Schema.Struct({
	exercise: Exercise,
	set: PositiveInt,
	session: Schema.optionalKey(SessionInput),
	...SetFields
})
const SetKey = Schema.Struct({ exercise: Exercise, set: PositiveInt, session: Schema.optionalKey(SessionInput) })

const setInput = (input: typeof RecordInput.Type | typeof FixInput.Type): SetInput => input

// ── the ops ───────────────────────────────────────────────────────────────

const withDatabase = <A, R>(context: Context, use: (database: FitnessDatabase) => Effect.Effect<A, Failure, R>) =>
	Effect.scoped(
		Effect.gen(function* () {
			if (!existsSync(context.store))
				return yield* refuse("NoLedger", `No ledger at ${context.store}; create it once with db.create`)
			return yield* use(yield* openFitnessDatabase(context.store))
		})
	)

const reading = <A, R>(context: Context, read: (facts: Facts) => Effect.Effect<A, Failure, R>) =>
	withDatabase(context, (database) => Effect.flatMap(readFacts(database), ({ facts }) => read(facts)))

/** A set write: `{outcome, recorded, next}`, with `next` read after the write. */
const writingSet = <A extends object>(
	context: Context,
	plan: (facts: Facts) => Effect.Effect<Plan<A>, FitnessLedgerFailure>
) =>
	withDatabase(context, (database) =>
		Effect.gen(function* () {
			const { outcome, result } = yield* write(database, plan)
			const { facts } = yield* readFacts(database)
			const open = openSessions(facts)
			const [session] = open
			return {
				outcome,
				...result,
				next: session === undefined || open.length > 1 ? null : stepView(nextStep(facts, session))
			}
		})
	)

const status = (_input: typeof Nothing.Type, context: Context) =>
	reading(context, (facts) =>
		Effect.gen(function* () {
			const today = yield* nowObserved(context.now)
			const day = weekday(today)
			const strength = prescription.strengthStarts.find((start) => start.day === day)
			const open = openSessions(facts)
			const latest = sessionsByRecency(facts).find(({ session }) => endOf(facts, session) !== undefined)
			const blockers = [
				...(open.length > 1
					? [`Sessions ${open.join(", ")} are all open; close the extra ones with session.fix {"session", "end"}`]
					: []),
				...open.flatMap((session) => {
					const start = startOf(facts, session)
					if (start === undefined)
						return [`Session ${session} has no start; record it with session.fix {"session", "start"}`]
					return localDay(start) < localDay(today)
						? [
								`Session ${session} started ${formatTime(start)} is still open; record when it ended with session.end {"at"}`
							]
						: []
				})
			]
			return {
				today: { date: localDay(today), weekday: day, time: formatTime(today) },
				strengthToday: strength !== undefined,
				...(strength === undefined ? {} : { strengthStart: localMinuteToClock(BigInt(strength.startMinute)) }),
				open: open.map((session) => sessionView(facts, session)),
				latest: latest === undefined ? null : sessionView(facts, latest.session),
				blockers
			}
		})
	)

const plan = () =>
	Effect.succeed({
		timeZone: prescription.timeZone,
		strengthStarts: prescription.strengthStarts.map((start) => ({
			day: start.day,
			start: localMinuteToClock(BigInt(start.startMinute))
		})),
		noSessionDurationLimit: true,
		warmUp: "none: begin directly with the prescribed work sets",
		order: "recommended order, a suggestion only; any order changes nothing",
		restSeconds: prescription.strength.restSeconds,
		equipment: equipmentConfirmation,
		progression: `After every prescribed set reaches at least ${prescription.strength.repetitionMaximum} clean reps at the same load on ${prescription.strength.promotionExposures} consecutive sessions, one pin heavier (until the top of the stack) or the smallest heavier dumbbell pair already recorded. If the heavier load prevents ${prescription.strength.repetitionMinimum} clean reps, return to the preceding load.`,
		exercises: prescription.strength.recommendedOrder.map((exercise) => ({
			...exerciseView(exercise),
			loadKind: exerciseById[exercise].loadKind,
			usesBench: exerciseById[exercise].usesBench,
			controls: controlsFor(exercise).map((control) => ({ control, label: machineControls[control].label }))
		}))
	})

const createDatabase = (_input: typeof Nothing.Type, context: Context) =>
	Effect.gen(function* () {
		if (existsSync(context.store)) return yield* refuse("StoreExists", `A ledger already exists at ${context.store}`)
		yield* Effect.scoped(createFitnessDatabase(context.store))
		return { outcome: "committed", store: context.store }
	})

const startSession = (input: { readonly at?: string }, context: Context) =>
	withDatabase(context, (database) =>
		Effect.gen(function* () {
			const id = yield* observationId
			const when = yield* observedFrom(input.at, context.now)
			const { outcome, result } = yield* write(database, (facts) =>
				Effect.gen(function* () {
					if (openSessions(facts).length > 0) {
						const session = yield* theOpenSession(facts)
						const start = startOf(facts, session)
						if (start !== undefined && localDay(start) < localDay(when))
							return yield* refuse(
								"StaleSession",
								`Session ${session} started ${formatTime(start)} is still open; record when it ended with session.end {"at"} first`
							)
						return { edits: [], result: sessionView(facts, session) }
					}
					return {
						edits: insert(
							{ relation: "Session", fact: { id } },
							{ relation: "SessionStart", fact: { session: id, ...when } }
						),
						result: { session: id, start: formatTime(when), end: null, sets: 0 }
					}
				})
			)
			return { outcome, ...result }
		})
	)

const sameTime = (a: ObservedTime | undefined, b: ObservedTime | undefined) =>
	a === undefined || b === undefined
		? a === b
		: a.at === b.at && a.precision === b.precision && a.timezoneOffsetMinutes === b.timezoneOffsetMinutes

/**
 * A session from stated boundaries only, for a session recorded after the fact: nothing defaults
 * to now and an open session does not matter. A session with exactly these boundaries is returned
 * unchanged, so a re-run is no change.
 */
const addSession = (input: { readonly start?: string; readonly end?: string }, context: Context) =>
	withDatabase(context, (database) =>
		Effect.gen(function* () {
			if (input.start === undefined && input.end === undefined)
				return yield* refuse("InvalidInput", "Give start, end or both, as stated by the user")
			const id = yield* observationId
			const start = input.start === undefined ? undefined : yield* observedFrom(input.start, context.now)
			const end = input.end === undefined ? undefined : yield* observedFrom(input.end, context.now)
			const { outcome, result } = yield* write(database, (facts) => {
				const same = facts.sessions.find(
					(session) => sameTime(startOf(facts, session), start) && sameTime(endOf(facts, session), end)
				)
				if (same !== undefined) return Effect.succeed({ edits: [], result: sessionView(facts, same) })
				const rows: Row[] = [{ relation: "Session", fact: { id } }]
				if (start !== undefined) rows.push({ relation: "SessionStart", fact: { session: id, ...start } })
				if (end !== undefined) rows.push({ relation: "SessionEnd", fact: { session: id, ...end } })
				return Effect.succeed({
					edits: insert(...rows),
					result: {
						session: id,
						start: start === undefined ? null : formatTime(start),
						end: end === undefined ? null : formatTime(end),
						sets: 0
					}
				})
			})
			return { outcome, ...result }
		})
	)

const endSession = (input: { readonly at?: string }, context: Context) =>
	withDatabase(context, (database) =>
		Effect.gen(function* () {
			const when = yield* observedFrom(input.at, context.now)
			const { outcome, result } = yield* write(database, (facts) =>
				Effect.gen(function* () {
					if (openSessions(facts).length === 0) {
						const ended = facts.ends.find((row) => row.at === when.at)
						if (ended === undefined)
							return yield* refuse("NoOpenSession", "No session is open; correct a recorded end with session.fix")
						return { edits: [], result: sessionView(facts, ended.session) }
					}
					const session = yield* theOpenSession(facts)
					return {
						edits: insert({ relation: "SessionEnd", fact: { session, ...when } }),
						result: { ...sessionView(facts, session), end: formatTime(when) }
					}
				})
			)
			return { outcome, ...result }
		})
	)

const fixSession = (
	input: { readonly session?: string; readonly start?: string; readonly end?: string },
	context: Context
) =>
	withDatabase(context, (database) =>
		Effect.gen(function* () {
			if (input.start === undefined && input.end === undefined)
				return yield* refuse("InvalidInput", "Give start, end or both")
			const start = input.start === undefined ? undefined : yield* observedFrom(input.start, context.now)
			const end = input.end === undefined ? undefined : yield* observedFrom(input.end, context.now)
			const { outcome, result } = yield* write(database, (facts) =>
				Effect.gen(function* () {
					const session = yield* targetSession(facts, input.session)
					const before: Row[] = []
					const after: Row[] = []
					const oldStart = startOf(facts, session)
					const oldEnd = endOf(facts, session)
					if (start !== undefined) {
						if (oldStart !== undefined) before.push({ relation: "SessionStart", fact: oldStart })
						after.push({ relation: "SessionStart", fact: { session, ...start } })
					}
					if (end !== undefined) {
						if (oldEnd !== undefined) before.push({ relation: "SessionEnd", fact: oldEnd })
						after.push({ relation: "SessionEnd", fact: { session, ...end } })
					}
					const view = sessionView(facts, session)
					return {
						edits: replace(before, after),
						result: {
							...view,
							...(start === undefined ? {} : { start: formatTime(start) }),
							...(end === undefined ? {} : { end: formatTime(end) })
						}
					}
				})
			)
			return { outcome, ...result }
		})
	)

const next = (input: { readonly exercise?: ExerciseId }, context: Context) =>
	reading(context, (facts) =>
		Effect.map(theOpenSession(facts), (session) => stepView(nextStep(facts, session, input.exercise)))
	)

const findSet = (facts: Facts, session: SessionId, exercise: ExerciseId, setNumber: bigint) =>
	recordedSets(facts).find((set) => set.session === session && set.exercise === exercise && set.setNumber === setNumber)

const sameRows = (a: RecordedSet, b: RecordedSet) =>
	rowsOf(a).map(rowKey).toSorted().join("\n") === rowsOf(b).map(rowKey).toSorted().join("\n")

/**
 * A set of a closed session, recorded exactly as given: nothing is defaulted, carried forward or
 * derived, and omitted settings and bench facts stay absent.
 */
const exactSet = (facts: Facts, session: SessionId, input: typeof RecordInput.Type) =>
	Effect.gen(function* () {
		const exercise = input.exercise
		const kind = exercise === undefined ? undefined : exerciseById[exercise].loadKind
		const load = kind === "SelectorPosition" ? "pin" : kind === "DumbbellPair" ? "weight" : "seconds"
		const missing = [
			...(exercise === undefined ? ["exercise"] : []),
			...(input.set === undefined ? ["set"] : []),
			...(kind !== undefined && input[load] === undefined ? [load] : []),
			...(kind !== undefined && kind !== "TimedStaticContraction" && input.reps === undefined ? ["reps"] : []),
			...(input.pain === undefined ? ["pain"] : [])
		]
		if (exercise === undefined || input.set === undefined || input.pain === undefined || missing.length > 0)
			return yield* refuse(
				"InvalidInput",
				`Session ${session} has ended, so the set is recorded exactly as given; it needs ${missing.join(", ")}`
			)
		const target = { session, exercise, setNumber: BigInt(input.set) }
		const set = yield* buildSet(facts, target, { pain: input.pain, settings: new Map() }, setInput(input), false)
		const existing = findSet(facts, session, exercise, target.setNumber)
		if (existing === undefined) return { edits: insert(...rowsOf(set)), result: { recorded: setView(set) } }
		if (!sameRows(set, existing))
			return yield* refuse(
				"SetExists",
				`Set ${input.set} of ${exercise} is already recorded with other facts; correct it with set.fix`
			)
		return { edits: [], result: { recorded: setView(existing) } }
	})

const recordSet = (input: typeof RecordInput.Type, context: Context) =>
	writingSet(context, (facts) =>
		Effect.gen(function* () {
			const named = input.session === undefined ? undefined : yield* targetSession(facts, input.session)
			if (named !== undefined && endOf(facts, named) !== undefined) return yield* exactSet(facts, named, input)
			const session = named ?? (yield* theOpenSession(facts))
			const step = nextStep(facts, session, input.exercise, input.set === undefined ? undefined : BigInt(input.set))
			if (step.done)
				return yield* refuse(
					"SessionComplete",
					"Every prescribed set is recorded. Name the exercise for an extra set, or end with session.end"
				)
			const target = { session, exercise: step.exercise, setNumber: step.setNumber }
			const existing = findSet(facts, session, step.exercise, step.setNumber)
			if (existing !== undefined) {
				const again = yield* buildSet(facts, target, recordedDefaults(existing), setInput(input), false)
				if (!sameRows(again, existing))
					return yield* refuse(
						"SetExists",
						`Set ${step.setNumber} of ${step.exercise} is already recorded with other facts; correct it with set.fix`
					)
				return { edits: [], result: { recorded: setView(existing) } }
			}
			const set = yield* buildSet(facts, target, stepDefaults(step), setInput(input), true)
			return { edits: insert(...rowsOf(set)), result: { recorded: setView(set) } }
		})
	)

const fixSet = (input: typeof FixInput.Type, context: Context) =>
	writingSet(context, (facts) =>
		Effect.gen(function* () {
			const session = yield* targetSession(facts, input.session)
			const setNumber = BigInt(input.set)
			const existing = findSet(facts, session, input.exercise, setNumber)
			if (existing === undefined)
				return yield* refuse("SetMissing", `No set ${input.set} of ${input.exercise} in session ${session}`)
			const fixed = yield* buildSet(
				facts,
				{ session, exercise: input.exercise, setNumber },
				recordedDefaults(existing),
				setInput(input),
				false
			)
			return { edits: replace(rowsOf(existing), rowsOf(fixed)), result: { recorded: setView(fixed) } }
		})
	)

const removeSet = (input: typeof SetKey.Type, context: Context) =>
	writingSet(context, (facts) =>
		Effect.gen(function* () {
			const session = yield* targetSession(facts, input.session)
			const existing = findSet(facts, session, input.exercise, BigInt(input.set))
			const removed: ReturnType<typeof setView> | null = existing === undefined ? null : setView(existing)
			return { edits: existing === undefined ? [] : remove(...rowsOf(existing)), result: { removed } }
		})
	)

const history = (input: { readonly exercise: ExerciseId; readonly limit?: number }, context: Context) =>
	reading(context, (facts) => {
		const sets = recordedSets(facts).filter((set) => set.exercise === input.exercise)
		const held = new Set(sets.map((set) => set.session))
		const anchored = sessionsByRecency(facts).filter(({ session }) => held.has(session))
		const unanchored = [...held].filter((session) => anchorOf(facts, session) === undefined)
		const open = new Set(openSessions(facts))
		return Effect.succeed({
			exercise: input.exercise,
			sessions: [...anchored.map(({ session }) => session), ...unanchored].slice(0, input.limit ?? 3).map((session) => {
				const anchor = anchorOf(facts, session)
				return {
					session,
					at: anchor === undefined ? null : formatTime(anchor),
					anchor: anchor === undefined ? null : anchor.fromStart ? "start" : "end",
					open: open.has(session),
					sets: sets
						.filter((set) => set.session === session)
						.toSorted((a, b) => (a.setNumber < b.setNumber ? -1 : 1))
						.map(setView)
				}
			})
		})
	})

// ── the table ─────────────────────────────────────────────────────────────

export interface Op {
	readonly summary: string
	readonly run: (payload: unknown, context: Context) => Effect.Effect<unknown, Failure, Bumble>
}

const op = <S extends Schema.ConstraintDecoder<unknown>>(
	summary: string,
	input: S,
	run: (input: S["Type"], context: Context) => Effect.Effect<unknown, Failure, Bumble>
): Op => ({
	summary,
	run: (payload, context) =>
		Effect.flatMap(
			Effect.fromResult(Schema.decodeUnknownResult(input, { onExcessProperty: "error", errors: "all" })(payload)).pipe(
				Effect.mapError((error) => new FitnessLedgerFailure({ code: "InvalidInput", message: error.message }))
			),
			(value) => run(value, context)
		)
})

export const ops: { readonly [name: string]: Op } = {
	status: op(
		"Today in America/Chicago, whether strength is scheduled, the open and latest sessions, and blockers",
		Nothing,
		status
	),
	plan: op("The prescription, exercises in recommended order", Nothing, plan),
	"db.create": op("Create the empty ledger once; refuses an existing one", Nothing, createDatabase),
	"session.start": op(
		"Open a session (at defaults to now); an open session is returned unchanged",
		Schema.Struct({ at: Schema.optionalKey(Instant) }),
		startSession
	),
	next: op(
		"The next set: exercise, set number, pin or weight, every control and bench setting, and what to ask",
		Schema.Struct({ exercise: Schema.optionalKey(Exercise) }),
		next
	),
	"set.record": op(
		"Record one set; unmentioned values are the ones next announces, pain NoPain. A named ended session records exactly what is given. Returns the next step",
		RecordInput,
		recordSet
	),
	"set.fix": op("Replace fields of one recorded set; the rest keep their recorded values", FixInput, fixSet),
	"set.remove": op("Delete a mistaken set with its settings and bench facts", SetKey, removeSet),
	"session.add": op(
		"Record a session after the fact from its stated start, end or both; nothing defaults to now",
		Schema.Struct({ start: Schema.optionalKey(Instant), end: Schema.optionalKey(Instant) }),
		addSession
	),
	"session.end": op(
		"Record the open session's end (at defaults to now)",
		Schema.Struct({ at: Schema.optionalKey(Instant) }),
		endSession
	),
	"session.fix": op(
		"Correct a session's start or end time",
		Schema.Struct({
			session: Schema.optionalKey(SessionInput),
			start: Schema.optionalKey(Instant),
			end: Schema.optionalKey(Instant)
		}),
		fixSession
	),
	history: op(
		"The last sessions' sets of one exercise, with settings and bench facts",
		Schema.Struct({ exercise: Exercise, limit: Schema.optionalKey(PositiveInt) }),
		history
	)
}

export const summaries = () => Object.entries(ops).map(([name, entry]) => ({ op: name, summary: entry.summary }))

/** Decode the payload against the op's input, then run it. */
export const run = (name: string, payload: unknown, context: Context) =>
	Effect.suspend(() => {
		const entry = Object.hasOwn(ops, name) ? ops[name] : undefined
		if (entry === undefined) return refuse("UnknownOp", `No op "${name}". Ops: ${Object.keys(ops).join(", ")}`)
		return entry.run(payload, context)
	})

/** One JSON object from the command line. */
export const parsePayload = (text: string | undefined) =>
	text === undefined
		? Effect.succeed({})
		: Effect.try({
				try: (): unknown => JSON.parse(text),
				catch: () => new FitnessLedgerFailure({ code: "InvalidJson", message: `Not JSON: ${text}` })
			}).pipe(
				Effect.flatMap((value) =>
					typeof value === "object" && value !== null && !Array.isArray(value)
						? Effect.succeed(value)
						: refuse("InvalidJson", "Give one JSON object")
				)
			)

/** Engine refusal kinds the ledger names, wherever they arise. */
const engineRefusals: { readonly [kind: string]: { readonly code: string; readonly message: string } } = {
	FingerprintMismatch: {
		code: "LedgerSchemaMismatch",
		message: "The ledger was written under a different theory than this code's; it cannot be opened"
	},
	SchemaMismatch: {
		code: "LedgerSchemaMismatch",
		message: "The ledger was written under a different theory than this code's; it cannot be opened"
	},
	DestinationExists: { code: "StoreExists", message: "A ledger already exists there; db.create never replaces one" },
	Locked: { code: "LedgerBusy", message: "Another process holds the ledger; run the op again when it finishes" },
	Full: { code: "StoreFull", message: "The ledger reached its storage ceiling" },
	Capacity: { code: "QueryTooLarge", message: "A read exceeded the engine's in-memory limit" }
}

/** A BumbleDB failure as `{code, message}`: a named refusal, else `DbError` with its tag and kind. */
function describeDbError(error: DbError) {
	const reason = error.reason
	const detail = "message" in reason ? `: ${reason.message}` : ""
	if (reason._tag === "DirectoryBusy" || reason._tag === "WriterBusy")
		return { code: "LedgerBusy", message: "Another process holds the ledger; run the op again when it finishes" }
	const opening = error.operation === "Db.open"
	if (opening && (reason._tag === "Io" || (reason._tag === "Engine" && ["Io", "NotABumbleDb"].includes(reason.kind))))
		return { code: "NoLedger", message: `No readable ledger at the store path; create it once with db.create${detail}` }
	if (reason._tag === "Engine") {
		const named = Object.hasOwn(engineRefusals, reason.kind) ? engineRefusals[reason.kind] : undefined
		if (named !== undefined) return { code: named.code, message: `${named.message}${detail}` }
		return { code: "DbError", message: `${error.operation}: Engine ${reason.kind}${detail}` }
	}
	const kind = "kind" in reason ? ` ${reason.kind}` : ""
	return { code: "DbError", message: `${error.operation}: ${reason._tag}${kind}${detail}` }
}

/** A failure as `{code, message}`: a refusal's own, or a database or unexpected error's. */
export function describeFailure(cause: Cause.Cause<unknown>) {
	const failures = cause.reasons.map((reason) => {
		const error = reason._tag === "Fail" ? reason.error : reason._tag === "Die" ? reason.defect : undefined
		if (error instanceof FitnessLedgerFailure) return { code: error.code, message: error.message }
		if (error instanceof DbError) return describeDbError(error)
		if (reason._tag === "Interrupt") return { code: "Interrupted", message: "The op was interrupted" }
		return { code: "Unexpected", message: renderUnknownFailure(error) }
	})
	return failures[0] ?? { code: "Unexpected", message: "The op failed without a reason" }
}
