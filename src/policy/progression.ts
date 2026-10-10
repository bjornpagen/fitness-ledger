import { type ExerciseId, isSelectorExercise, machineById, selectorMachineByExercise } from "#policy/exercises.ts"
import { exercisePrescriptionById, prescription } from "#policy/prescription.ts"

type TimePrecisionId = "Minute" | "Millisecond"

/**
 * One actual set of a dynamic exercise. `at`/`precision` are its session's anchor:
 * the SessionStart when recorded, otherwise the SessionEnd.
 */
export interface DynamicHistoryRow {
	readonly session: string
	readonly at: bigint
	readonly precision: TimePrecisionId
	readonly setNumber: bigint
	readonly repetitions: bigint
	readonly resistance: bigint
}

export interface ProgressionContext {
	/** Sessions holding this exercise's sets with neither a start nor an end. They cannot be ordered. */
	readonly unanchoredSessions: readonly string[]
	/** Every per-hand dumbbell weight recorded anywhere in the ledger, in tenths of a pound. */
	readonly recordedDumbbellWeights: readonly bigint[]
}

export type ProgressionAction =
	| "establish"
	| "hold"
	| "increase"
	| "decrease"
	| "confirm-next"
	| "top-of-stack"
	| "ambiguous"
	| "tsc"

/** A derived view of actual sets, never a stored streak or a recording format. */
export interface Progression {
	readonly action: ProgressionAction
	readonly resistance?: bigint
	readonly reason: string
}

function anchorStart(row: DynamicHistoryRow): bigint {
	return row.precision === "Minute" ? row.at - (((row.at % 60_000n) + 60_000n) % 60_000n) : row.at
}

function anchorEnd(row: DynamicHistoryRow): bigint {
	return anchorStart(row) + (row.precision === "Minute" ? 60_000n : 1n)
}

/** Order exposures only as far as the recorded clock precision can distinguish them. */
export function dynamicProgression(
	exercise: ExerciseId,
	history: readonly DynamicHistoryRow[],
	context: ProgressionContext
): Progression {
	const policy = exercisePrescriptionById[exercise]
	if (policy.loadKind === "TimedStaticContraction")
		return {
			action: "tsc",
			reason: "Keep the 45-degree setup and 30/30/30 protocol. Record actual duration and English pain."
		}
	if (context.unanchoredSessions.length > 0)
		return {
			action: "ambiguous",
			reason:
				"A session holding this exercise's sets has neither a start nor an end, so its exposures cannot be ordered."
		}
	const exposures = [...Map.groupBy(history, (row) => row.session).values()].sort((a, b) => {
		const left = a[0] === undefined ? 0n : anchorStart(a[0])
		const right = b[0] === undefined ? 0n : anchorStart(b[0])
		return left > right ? -1 : left < right ? 1 : 0
	})
	const current = exposures[0]
	const first = current?.[0]
	if (current === undefined || first === undefined)
		return {
			action: "establish",
			reason: "No actual exposure is recorded. Confirm a working resistance and equipment setup."
		}
	const previous = exposures[1]
	// A third exposure can overlap the second and change which two are consecutive.
	for (let index = 0; index < Math.min(2, exposures.length - 1); index++) {
		const newer = exposures[index]?.[0]
		const older = exposures[index + 1]?.[0]
		if (newer !== undefined && older !== undefined && anchorEnd(older) > anchorStart(newer))
			return {
				action: "ambiguous",
				reason: "Session times overlap at their recorded precision; consecutive exposures are ambiguous."
			}
	}
	const minimum = BigInt(prescription.strength.repetitionMinimum)
	const maximum = BigInt(prescription.strength.repetitionMaximum)
	const constant = (sets: readonly DynamicHistoryRow[]) => sets.every((row) => row.resistance === sets[0]?.resistance)
	const prescribed = (sets: readonly DynamicHistoryRow[]) =>
		Array.from({ length: policy.sets }, (_, index) => sets.find((row) => row.setNumber === BigInt(index + 1)))
	const qualifies = (sets: readonly DynamicHistoryRow[], repetitions: bigint) =>
		constant(sets) && prescribed(sets).every((row) => row !== undefined && row.repetitions >= repetitions)
	const resistance = first.resistance
	const previousResistance = previous?.[0]?.resistance
	if (
		previous !== undefined &&
		previousResistance !== undefined &&
		qualifies(previous, minimum) &&
		current.some((row) => row.resistance > previousResistance && row.repetitions < minimum)
	)
		return {
			action: "decrease",
			resistance: previousResistance,
			reason: "The increased resistance prevented five clean repetitions. Return to the preceding working resistance."
		}
	if (!constant(current))
		return {
			action: "ambiguous",
			reason: "The latest exposure used mixed resistances; it cannot establish a constant-load streak."
		}
	if (!qualifies(current, maximum))
		return {
			action: "hold",
			resistance,
			reason: "Every prescribed set must reach at least eight clean repetitions; missing sets cannot qualify."
		}
	if (previous === undefined || previousResistance !== resistance || !qualifies(previous, maximum))
		return {
			action: "hold",
			resistance,
			reason: "One qualifying exposure is recorded; two consecutive actual exposures at this resistance are required."
		}
	const qualified =
		"Every prescribed set reached at least eight clean repetitions at the same resistance on two consecutive actual exposures."
	if (isSelectorExercise(exercise)) {
		const stackPositions = machineById[selectorMachineByExercise[exercise]].stackPositions
		if (resistance + 1n > stackPositions)
			return {
				action: "top-of-stack",
				resistance,
				reason: `${qualified} The top of the stack is reached: position ${stackPositions} is the heaviest selector position.`
			}
		return { action: "increase", resistance: resistance + 1n, reason: qualified }
	}
	const next = [...new Set(context.recordedDumbbellWeights)]
		.filter((value) => value > resistance)
		.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[0]
	if (next === undefined)
		return {
			action: "confirm-next",
			resistance,
			reason: `${qualified} No heavier pair is recorded in the ledger; ask which heavier pair exists before increasing.`
		}
	return {
		action: "increase",
		resistance: next,
		reason: `${qualified} The next pair is the smallest heavier per-hand weight already recorded.`
	}
}
