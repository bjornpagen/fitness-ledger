import assert from "node:assert/strict"
import test from "node:test"
import type { ExerciseId } from "#policy/exercises.ts"
import { type DynamicHistoryRow, dynamicProgression, type ProgressionContext } from "#policy/progression.ts"

const legPress = "cl-2403-seated-leg-press"
const press = "back-supported-neutral-db-overhead-press"
const none: ProgressionContext = { unanchoredSessions: [], recordedDumbbellWeights: [] }
const MINUTE = 60_000n

/** One session's sets, anchored at `at` (its SessionStart if recorded, otherwise its SessionEnd). */
const exposure = (
	session: string,
	at: bigint,
	resistance = 3n,
	repetitions = [8n, 8n],
	precision: DynamicHistoryRow["precision"] = "Millisecond"
): DynamicHistoryRow[] =>
	repetitions.map((count, index) => ({
		session,
		at,
		precision,
		setNumber: BigInt(index + 1),
		repetitions: count,
		resistance
	}))

const progress = (history: readonly DynamicHistoryRow[], exercise: ExerciseId = legPress, context = none) =>
	dynamicProgression(exercise, history, context)

test("two consecutive qualifying exposures move one selector position heavier", () => {
	const history = [...exposure("newer", 30n * MINUTE), ...exposure("older", MINUTE, 3n, [10n, 9n])]
	const result = progress(history)
	assert.equal(result.action, "increase")
	assert.equal(result.resistance, 4n)
	// Exposures are ordered by their session anchors, never by input order or session identifiers.
	assert.deepEqual(progress(history.toReversed()), result)
	const relabeled = [...exposure("a-newer", 30n * MINUTE), ...exposure("z-older", MINUTE, 3n, [10n, 9n])]
	assert.deepEqual(progress(relabeled), result)
})

test("the selector increase stops at the machine's top of stack", () => {
	const atTop = (exercise: ExerciseId, resistance: bigint) =>
		progress([...exposure("old", MINUTE, resistance), ...exposure("new", 10n * MINUTE, resistance)], exercise)
	assert.deepEqual(
		[atTop(legPress, 20n).action, atTop(legPress, 20n).resistance],
		["increase", 21n],
		"CL-2403 has 21 selector positions"
	)
	const legTop = atTop(legPress, 21n)
	assert.equal(legTop.action, "top-of-stack")
	assert.equal(legTop.resistance, 21n)
	assert.ok(legTop.reason.includes("position 21 is the heaviest"))
	assert.equal(atTop("d-200-lat-pulldown", 21n).action, "top-of-stack")
	assert.equal(atTop("d-300-chest-press", 15n).resistance, 16n)
	const chestTop = atTop("d-300-chest-press", 16n)
	assert.equal(chestTop.action, "top-of-stack")
	assert.ok(chestTop.reason.includes("position 16 is the heaviest"))
	assert.equal(atTop("d-400-hamstring-curl", 16n).action, "top-of-stack")
	assert.equal(atTop("d-600-abdominals", 16n).action, "top-of-stack")
})

test("the next dumbbell pair is the smallest heavier weight already recorded, otherwise confirm-next", () => {
	const history = [...exposure("old", MINUTE, 200n), ...exposure("new", 10n * MINUTE, 200n)]
	const recorded = { unanchoredSessions: [], recordedDumbbellWeights: [150n, 300n, 250n, 250n, 200n] }
	const next = progress(history, press, recorded)
	assert.equal(next.action, "increase")
	assert.equal(next.resistance, 250n)
	const unknown = progress(history, press, { unanchoredSessions: [], recordedDumbbellWeights: [150n, 200n] })
	assert.equal(unknown.action, "confirm-next")
	assert.equal(unknown.resistance, 200n)
	assert.ok(unknown.reason.includes("ask which heavier pair exists"))
	assert.equal(progress(history, press).action, "confirm-next")
})

test("a partial or intervening unsuccessful exposure breaks promotion eligibility", () => {
	const earlier = exposure("earlier", MINUTE)
	assert.equal(progress([...earlier, ...exposure("partial", 10n * MINUTE, 3n, [8n])]).action, "hold")
	assert.equal(
		progress([...earlier, ...exposure("bad", 10n * MINUTE, 3n, [7n, 8n]), ...exposure("new", 20n * MINUTE)]).action,
		"hold"
	)
	const single = progress(exposure("only", MINUTE))
	assert.equal(single.action, "hold")
	assert.equal(single.resistance, 3n)
	assert.equal(progress([]).action, "establish")
})

test("extra sets cannot substitute for missing prescribed sets or create another exposure", () => {
	const one = exposure("one", MINUTE, 3n, [8n, 8n, 8n, 8n])
	assert.equal(progress(one).action, "hold")
	const shifted = exposure("new", 10n * MINUTE).map((row) => ({ ...row, setNumber: row.setNumber + 1n }))
	assert.equal(progress([...one, ...shifted]).action, "hold")
})

test("mixed resistance including an extra set cannot establish a constant-load streak", () => {
	const extra = exposure("new", 10n * MINUTE, 4n)[0]
	assert.ok(extra)
	assert.equal(
		progress([...exposure("old", MINUTE), ...exposure("new", 10n * MINUTE), { ...extra, setNumber: 3n }]).action,
		"ambiguous"
	)
})

test("an increase that prevents five repetitions returns to the preceding working resistance", () => {
	const result = progress([...exposure("old", MINUTE), ...exposure("new", 10n * MINUTE, 4n, [4n])])
	assert.equal(result.action, "decrease")
	assert.equal(result.resistance, 3n)
	const reducedMidExercise = exposure("new", 10n * MINUTE, 4n, [4n, 7n]).map((row) =>
		row.setNumber === 2n ? { ...row, resistance: 3n } : row
	)
	assert.equal(progress([...exposure("old", MINUTE), ...reducedMidExercise]).action, "decrease")
	assert.equal(
		progress([...exposure("old", MINUTE, 3n, [4n, 4n]), ...exposure("new", 10n * MINUTE, 4n, [4n])]).action,
		"hold"
	)
	const dumbbells = progress(
		[...exposure("old", MINUTE, 200n), ...exposure("new", 10n * MINUTE, 250n, [4n, 3n])],
		press,
		{ unanchoredSessions: [], recordedDumbbellWeights: [200n, 250n] }
	)
	assert.equal(dumbbells.action, "decrease")
	assert.equal(dumbbells.resistance, 200n)
})

test("session anchors compare at their recorded precision; overlaps and ties stay ambiguous", () => {
	const minute = exposure("older", 0n, 3n, [8n, 8n], "Minute")
	// A minute-precision anchor covers [0, 60 s); a precise anchor inside it cannot be ordered against it.
	assert.equal(progress([...minute, ...exposure("new", 30_000n)]).action, "ambiguous")
	const imprecise = exposure("minute", 59_000n, 3n, [8n, 8n], "Minute")
	assert.equal(progress([...imprecise, ...exposure("precise", 30_000n)]).action, "ambiguous")
	assert.equal(progress([...minute, ...exposure("new", MINUTE)]).action, "increase")
	// Two sessions anchored in the same minute.
	assert.equal(
		progress([...exposure("a", MINUTE, 3n, [8n, 8n], "Minute"), ...exposure("b", MINUTE, 3n, [8n, 8n], "Minute")])
			.action,
		"ambiguous"
	)
	// A tie for the preceding exposure is ambiguous even when the latest is distinct.
	assert.equal(
		progress([...exposure("a", 1n), ...exposure("b", 1n), ...exposure("c", 10n * MINUTE)]).action,
		"ambiguous"
	)
})

test("a session with neither a start nor an end cannot be ordered", () => {
	const history = [...exposure("old", MINUTE), ...exposure("new", 10n * MINUTE)]
	const result = progress(history, legPress, { unanchoredSessions: ["unanchored"], recordedDumbbellWeights: [] })
	assert.equal(result.action, "ambiguous")
	assert.equal(result.resistance, undefined)
	assert.ok(result.reason.includes("neither a start nor an end"))
})

test("timed static contractions keep their protocol and never progress a resistance", () => {
	const result = progress([], "bench-tsc-neck-extension")
	assert.equal(result.action, "tsc")
	assert.equal(result.resistance, undefined)
	assert.ok(result.reason.includes("30/30/30"))
	assert.equal(
		progress([], "bench-tsc-neck-flexion", { unanchoredSessions: ["x"], recordedDumbbellWeights: [] }).action,
		"tsc"
	)
})
