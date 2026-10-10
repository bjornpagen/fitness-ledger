import {
	type ChangeDraft,
	ChangeSet,
	type DbError,
	type Fact,
	type QueryTemplate,
	type Uuid,
	type Violation
} from "@bjornpagen/bumbledb"
import { Effect } from "effect"
import { type FitnessDatabase, readRows } from "#application/database.ts"
import * as queries from "#application/queries.ts"
import {
	BenchBackrestAngle,
	BenchBackrestPosition,
	BenchSeatAdjustment,
	BenchSeatPosition,
	DumbbellWorkSet,
	FitnessLedger,
	type PainRatingId,
	SelectorWorkSet,
	Session,
	SessionEnd,
	SessionStart,
	TscWorkSet,
	WorkSet,
	WorkSetBench,
	WorkSetSetting
} from "#application/schema.ts"
import { type FitnessLedgerFailure, refuse } from "#mechanism/failure.ts"
import { type ControlId, type ExerciseId, exerciseById, type NumberingId } from "#policy/exercises.ts"

/* One consistent read of the whole (single-person, small) ledger, the typed rows a write adds or
 * removes, and the snapshot-witness write loop every op uses. */

export type SessionId = Fact<typeof Session>["id"]
export type ObservedTime = Omit<Fact<typeof SessionStart>, "session">

export interface Facts {
	readonly sessions: readonly SessionId[]
	readonly starts: readonly Fact<typeof SessionStart>[]
	readonly ends: readonly Fact<typeof SessionEnd>[]
	readonly workSets: readonly Fact<typeof WorkSet>[]
	readonly selector: readonly Fact<typeof SelectorWorkSet>[]
	readonly dumbbell: readonly Fact<typeof DumbbellWorkSet>[]
	readonly tsc: readonly Fact<typeof TscWorkSet>[]
	readonly settings: readonly Fact<typeof WorkSetSetting>[]
	readonly benches: readonly Fact<typeof WorkSetBench>[]
	readonly backrestAngles: readonly Fact<typeof BenchBackrestAngle>[]
	readonly backrestMarks: readonly Fact<typeof BenchBackrestPosition>[]
	readonly seatAdjustments: readonly Fact<typeof BenchSeatAdjustment>[]
	readonly seatMarks: readonly Fact<typeof BenchSeatPosition>[]
	/** Each control's numbering convention, read from the closed `Control` facts. */
	readonly numbering: ReadonlyMap<ControlId, NumberingId>
	/** Selector positions per weight stack, read from the closed `Machine` facts. */
	readonly stackPositions: ReadonlyMap<string, bigint>
}

export const readFacts = (database: FitnessDatabase) =>
	Effect.scoped(
		Effect.gen(function* () {
			const snapshot = yield* database.snapshot()
			const all = <A>(query: QueryTemplate<typeof FitnessLedger, Record<never, never>, A>) =>
				readRows(snapshot, query, {})
			const facts = yield* Effect.all({
				sessions: Effect.map(all(queries.sessions), (rows) => rows.map((row) => row.id)),
				starts: all(queries.sessionStarts),
				ends: all(queries.sessionEnds),
				workSets: all(queries.workSets),
				selector: Effect.map(all(queries.selectorWorkSets), (rows) =>
					rows.map((row) => ({
						workSet: row.id,
						repetitions: row.repetitions,
						resistancePosition: row.resistancePosition
					}))
				),
				dumbbell: Effect.map(all(queries.dumbbellWorkSets), (rows) =>
					rows.map((row) => ({ workSet: row.id, repetitions: row.repetitions, eachTenthsLb: row.eachTenthsLb }))
				),
				tsc: Effect.map(all(queries.tscWorkSets), (rows) =>
					rows.map((row) => ({ workSet: row.id, durationSeconds: row.durationSeconds }))
				),
				settings: Effect.map(all(queries.workSetSettings), (rows) =>
					rows.map((row) => ({
						workSet: row.workSet,
						exercise: row.exercise,
						control: row.control,
						position: row.position
					}))
				),
				benches: all(queries.workSetBenches),
				backrestAngles: all(queries.benchBackrestAngles),
				backrestMarks: all(queries.benchBackrestPositions),
				seatAdjustments: all(queries.benchSeatAdjustments),
				seatMarks: all(queries.benchSeatPositions),
				numbering: Effect.map(
					all(queries.controls),
					(rows) => new Map(rows.map((row) => [row.control, row.numbering] as const))
				),
				stackPositions: Effect.map(
					all(queries.machines),
					(rows) => new Map(rows.map((row) => [row.id, row.stackPositions] as const))
				)
			})
			return { facts, witness: snapshot.witness }
		})
	)

// ── sessions ──────────────────────────────────────────────────────────────

export interface Anchor extends ObservedTime {
	readonly fromStart: boolean
}

/** A session's anchor: its start when recorded, otherwise its end. */
export function anchorOf(facts: Facts, session: SessionId): Anchor | undefined {
	const start = facts.starts.find((row) => row.session === session)
	if (start !== undefined) return { ...observedOf(start), fromStart: true }
	const end = facts.ends.find((row) => row.session === session)
	return end === undefined ? undefined : { ...observedOf(end), fromStart: false }
}

export const observedOf = (row: ObservedTime): ObservedTime => ({
	at: row.at,
	precision: row.precision,
	timezoneOffsetMinutes: row.timezoneOffsetMinutes
})

export const openSessions = (facts: Facts) =>
	facts.sessions.filter((session) => !facts.ends.some((row) => row.session === session))

/** Anchored sessions, newest first. Ties keep a stable order by id; UUIDs are never chronology. */
export function sessionsByRecency(facts: Facts): readonly { session: SessionId; anchor: Anchor }[] {
	return facts.sessions
		.flatMap((session) => {
			const anchor = anchorOf(facts, session)
			return anchor === undefined ? [] : [{ session, anchor }]
		})
		.toSorted((a, b) =>
			a.anchor.at === b.anchor.at ? a.session.localeCompare(b.session) : a.anchor.at > b.anchor.at ? -1 : 1
		)
}

// ── sets ──────────────────────────────────────────────────────────────────

export type Work =
	| { readonly kind: "SelectorPosition"; readonly pin: bigint; readonly repetitions: bigint }
	| { readonly kind: "DumbbellPair"; readonly tenths: bigint; readonly repetitions: bigint }
	| { readonly kind: "TimedStaticContraction"; readonly seconds: bigint }

export interface BenchSetup {
	readonly name: string
	readonly backrestAngle?: number
	readonly backrestMark?: string
	readonly seatAdjustable?: boolean
	readonly seatMark?: string
}

/** One work set with everything recorded on it. */
export interface RecordedSet {
	readonly id: Uuid
	readonly session: SessionId
	readonly exercise: ExerciseId
	readonly setNumber: bigint
	readonly pain: PainRatingId
	readonly work: Work
	readonly settings: ReadonlyMap<ControlId, bigint>
	readonly bench?: BenchSetup
}

function workOf(facts: Facts, set: Fact<typeof WorkSet>): Work | undefined {
	const selector = facts.selector.find((row) => row.workSet === set.id)
	if (selector !== undefined)
		return { kind: "SelectorPosition", pin: selector.resistancePosition, repetitions: selector.repetitions }
	const dumbbell = facts.dumbbell.find((row) => row.workSet === set.id)
	if (dumbbell !== undefined)
		return { kind: "DumbbellPair", tenths: dumbbell.eachTenthsLb, repetitions: dumbbell.repetitions }
	const tsc = facts.tsc.find((row) => row.workSet === set.id)
	return tsc === undefined ? undefined : { kind: "TimedStaticContraction", seconds: tsc.durationSeconds }
}

function benchOf(facts: Facts, workSet: Uuid): BenchSetup | undefined {
	const bench = facts.benches.find((row) => row.workSet === workSet)
	if (bench === undefined) return undefined
	const angle = facts.backrestAngles.find((row) => row.workSet === workSet)
	const mark = facts.backrestMarks.find((row) => row.workSet === workSet)
	const seat = facts.seatAdjustments.find((row) => row.workSet === workSet)
	const seatMark = facts.seatMarks.find((row) => row.workSet === workSet)
	return {
		name: bench.bench,
		...(angle === undefined ? {} : { backrestAngle: angle.degrees }),
		...(mark === undefined ? {} : { backrestMark: mark.mark }),
		...(seat === undefined ? {} : { seatAdjustable: seat.adjustable }),
		...(seatMark === undefined ? {} : { seatMark: seatMark.mark })
	}
}

export function recordedSets(facts: Facts): readonly RecordedSet[] {
	return facts.workSets.flatMap((set) => {
		const work = workOf(facts, set)
		if (work === undefined) return []
		const bench = benchOf(facts, set.id)
		return [
			{
				id: set.id,
				session: set.session,
				exercise: set.exercise,
				setNumber: set.setNumber,
				pain: set.painRating,
				work,
				settings: new Map(
					facts.settings.filter((row) => row.workSet === set.id).map((row) => [row.control, row.position] as const)
				),
				...(bench === undefined ? {} : { bench })
			}
		]
	})
}

// ── rows a write adds or removes ──────────────────────────────────────────

export type Row =
	| { readonly relation: "Session"; readonly fact: Fact<typeof Session> }
	| { readonly relation: "SessionStart"; readonly fact: Fact<typeof SessionStart> }
	| { readonly relation: "SessionEnd"; readonly fact: Fact<typeof SessionEnd> }
	| { readonly relation: "WorkSet"; readonly fact: Fact<typeof WorkSet> }
	| { readonly relation: "SelectorWorkSet"; readonly fact: Fact<typeof SelectorWorkSet> }
	| { readonly relation: "DumbbellWorkSet"; readonly fact: Fact<typeof DumbbellWorkSet> }
	| { readonly relation: "TscWorkSet"; readonly fact: Fact<typeof TscWorkSet> }
	| { readonly relation: "WorkSetSetting"; readonly fact: Fact<typeof WorkSetSetting> }
	| { readonly relation: "WorkSetBench"; readonly fact: Fact<typeof WorkSetBench> }
	| { readonly relation: "BenchBackrestAngle"; readonly fact: Fact<typeof BenchBackrestAngle> }
	| { readonly relation: "BenchBackrestPosition"; readonly fact: Fact<typeof BenchBackrestPosition> }
	| { readonly relation: "BenchSeatAdjustment"; readonly fact: Fact<typeof BenchSeatAdjustment> }
	| { readonly relation: "BenchSeatPosition"; readonly fact: Fact<typeof BenchSeatPosition> }

export type Edit = { readonly op: "insert" | "delete"; readonly row: Row }

type Draft = ChangeDraft<typeof FitnessLedger>

function stage(draft: Draft, { op, row }: Edit): Effect.Effect<void, DbError> {
	switch (row.relation) {
		case "Session":
			return op === "insert" ? draft.insert(Session, [row.fact]) : draft.delete(Session, [row.fact])
		case "SessionStart":
			return op === "insert" ? draft.insert(SessionStart, [row.fact]) : draft.delete(SessionStart, [row.fact])
		case "SessionEnd":
			return op === "insert" ? draft.insert(SessionEnd, [row.fact]) : draft.delete(SessionEnd, [row.fact])
		case "WorkSet":
			return op === "insert" ? draft.insert(WorkSet, [row.fact]) : draft.delete(WorkSet, [row.fact])
		case "SelectorWorkSet":
			return op === "insert" ? draft.insert(SelectorWorkSet, [row.fact]) : draft.delete(SelectorWorkSet, [row.fact])
		case "DumbbellWorkSet":
			return op === "insert" ? draft.insert(DumbbellWorkSet, [row.fact]) : draft.delete(DumbbellWorkSet, [row.fact])
		case "TscWorkSet":
			return op === "insert" ? draft.insert(TscWorkSet, [row.fact]) : draft.delete(TscWorkSet, [row.fact])
		case "WorkSetSetting":
			return op === "insert" ? draft.insert(WorkSetSetting, [row.fact]) : draft.delete(WorkSetSetting, [row.fact])
		case "WorkSetBench":
			return op === "insert" ? draft.insert(WorkSetBench, [row.fact]) : draft.delete(WorkSetBench, [row.fact])
		case "BenchBackrestAngle":
			return op === "insert"
				? draft.insert(BenchBackrestAngle, [row.fact])
				: draft.delete(BenchBackrestAngle, [row.fact])
		case "BenchBackrestPosition":
			return op === "insert"
				? draft.insert(BenchBackrestPosition, [row.fact])
				: draft.delete(BenchBackrestPosition, [row.fact])
		case "BenchSeatAdjustment":
			return op === "insert"
				? draft.insert(BenchSeatAdjustment, [row.fact])
				: draft.delete(BenchSeatAdjustment, [row.fact])
		case "BenchSeatPosition":
			return op === "insert" ? draft.insert(BenchSeatPosition, [row.fact]) : draft.delete(BenchSeatPosition, [row.fact])
	}
}

export const insert = (...rows: readonly Row[]): Edit[] => rows.map((row) => ({ op: "insert", row }))
export const remove = (...rows: readonly Row[]): Edit[] => rows.map((row) => ({ op: "delete", row }))

/** Equal rows print identically however they were assembled; bigints print as decimals. */
export const rowKey = (row: Row) =>
	`${row.relation}:${JSON.stringify(
		Object.entries(row.fact).toSorted(([a], [b]) => a.localeCompare(b)),
		(_, value: unknown) => (typeof value === "bigint" ? `${value}n` : value)
	)}`

/** Replace `before` with `after`, touching only the rows that differ. */
export function replace(before: readonly Row[], after: readonly Row[]): Edit[] {
	const old = new Set(before.map(rowKey))
	const next = new Set(after.map(rowKey))
	return [
		...remove(...before.filter((row) => !next.has(rowKey(row)))),
		...insert(...after.filter((row) => !old.has(rowKey(row))))
	]
}

/** Every fact of one recorded set. */
export function rowsOf(set: RecordedSet): Row[] {
	const workSet = set.id
	const rows: Row[] = [
		{
			relation: "WorkSet",
			fact: {
				id: workSet,
				session: set.session,
				exercise: set.exercise,
				loadKind: exerciseById[set.exercise].loadKind,
				setNumber: set.setNumber,
				painRating: set.pain
			}
		}
	]
	const work = set.work
	if (work.kind === "SelectorPosition")
		rows.push({
			relation: "SelectorWorkSet",
			fact: { workSet, repetitions: work.repetitions, resistancePosition: work.pin }
		})
	if (work.kind === "DumbbellPair")
		rows.push({
			relation: "DumbbellWorkSet",
			fact: { workSet, repetitions: work.repetitions, eachTenthsLb: work.tenths }
		})
	if (work.kind === "TimedStaticContraction")
		rows.push({ relation: "TscWorkSet", fact: { workSet, durationSeconds: work.seconds } })
	for (const [control, position] of set.settings)
		rows.push({ relation: "WorkSetSetting", fact: { workSet, exercise: set.exercise, control, position } })
	const bench = set.bench
	if (bench !== undefined) {
		rows.push({ relation: "WorkSetBench", fact: { workSet, exercise: set.exercise, bench: bench.name } })
		if (bench.backrestAngle !== undefined)
			rows.push({ relation: "BenchBackrestAngle", fact: { workSet, degrees: bench.backrestAngle } })
		if (bench.backrestMark !== undefined)
			rows.push({ relation: "BenchBackrestPosition", fact: { workSet, mark: bench.backrestMark } })
		if (bench.seatAdjustable !== undefined)
			rows.push({ relation: "BenchSeatAdjustment", fact: { workSet, adjustable: bench.seatAdjustable } })
		if (bench.seatMark !== undefined)
			rows.push({ relation: "BenchSeatPosition", fact: { workSet, mark: bench.seatMark } })
	}
	return rows
}

// ── the write loop ────────────────────────────────────────────────────────

export interface Plan<A> {
	readonly edits: readonly Edit[]
	readonly result: A
}

const render = (violations: readonly Violation[]) =>
	violations.map((violation) => `${violation._tag}: ${violation.spelling}`).join("\n")

/**
 * Plan on one snapshot and apply against exactly that state. If another write landed in between,
 * plan once more on the new state. No edits is no change, and nothing is applied.
 */
export const write = <A, R>(
	database: FitnessDatabase,
	plan: (facts: Facts) => Effect.Effect<Plan<A>, FitnessLedgerFailure, R>
) =>
	Effect.gen(function* () {
		for (let attempt = 1; ; attempt++) {
			const { facts, witness } = yield* readFacts(database)
			const planned = yield* plan(facts)
			if (planned.edits.length === 0) return { outcome: "no-change" as const, result: planned.result }
			const outcome = yield* Effect.scoped(
				Effect.gen(function* () {
					const draft = yield* ChangeSet.builder(FitnessLedger)
					for (const edit of planned.edits) yield* stage(draft, edit)
					return yield* database.apply(yield* draft.finish(), witness)
				})
			)
			if (outcome._tag === "Moved" && attempt < 2) continue
			if (outcome._tag === "Moved") return yield* refuse("Moved", "The ledger kept changing; run the op again")
			if (outcome._tag === "Rejected") return yield* refuse("LawRefused", render(outcome.violations))
			return {
				outcome: outcome.changed ? ("committed" as const) : ("no-change" as const),
				result: planned.result
			}
		}
	})
