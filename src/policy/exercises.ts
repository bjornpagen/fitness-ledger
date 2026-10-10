export const LOAD_KIND_IDS = ["SelectorPosition", "DumbbellPair", "TimedStaticContraction"] as const

/** Closed roster. Its order is part of the theory fingerprint, never the recommended training order. */
export const EXERCISE_IDS = [
	"cl-2403-seated-leg-press",
	"d-200-lat-pulldown",
	"d-300-chest-press",
	"d-200-mid-row",
	"back-supported-neutral-db-overhead-press",
	"d-400-hamstring-curl",
	"d-600-lower-back",
	"d-600-abdominals",
	"cl-2403-calf-press",
	"bench-tsc-neck-extension",
	"bench-tsc-neck-flexion"
] as const

export const MACHINE_IDS = ["cl-2403", "d-200", "d-300", "d-400", "d-600"] as const

export const NUMBERING_IDS = ["Printed", "CountFromMostUpright", "Unconfirmed"] as const

/** HOIST's own control names, one per physical adjustment. */
export const CONTROL_IDS = [
	"cl-2403-back-adjuster",
	"cl-2403-seat-slide-adjuster",
	"d-200-seat-pad-adjuster",
	"d-200-thigh-pad-adjuster",
	"d-200-horizontal-chest-pad-adjuster",
	"d-300-seat-pad-adjuster",
	"d-300-back-pad-adjuster",
	"d-400-back-adjuster",
	"d-400-range-of-motion",
	"d-400-leg-length",
	"d-400-thigh-brace",
	"d-600-range-of-motion",
	"d-600-foot-rest"
] as const

export const DAY_IDS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const

export type LoadKindId = (typeof LOAD_KIND_IDS)[number]
export type ExerciseId = (typeof EXERCISE_IDS)[number]
export type MachineId = (typeof MACHINE_IDS)[number]
export type NumberingId = (typeof NUMBERING_IDS)[number]
export type ControlId = (typeof CONTROL_IDS)[number]
export type DayId = (typeof DAY_IDS)[number]

export const exerciseById = {
	"cl-2403-seated-leg-press": { loadKind: "SelectorPosition", usesBench: false },
	"d-200-lat-pulldown": { loadKind: "SelectorPosition", usesBench: false },
	"d-300-chest-press": { loadKind: "SelectorPosition", usesBench: false },
	"d-200-mid-row": { loadKind: "SelectorPosition", usesBench: false },
	"back-supported-neutral-db-overhead-press": { loadKind: "DumbbellPair", usesBench: true },
	"d-400-hamstring-curl": { loadKind: "SelectorPosition", usesBench: false },
	"d-600-lower-back": { loadKind: "SelectorPosition", usesBench: false },
	"d-600-abdominals": { loadKind: "SelectorPosition", usesBench: false },
	"cl-2403-calf-press": { loadKind: "SelectorPosition", usesBench: false },
	"bench-tsc-neck-extension": { loadKind: "TimedStaticContraction", usesBench: true },
	"bench-tsc-neck-flexion": { loadKind: "TimedStaticContraction", usesBench: true }
} as const satisfies { readonly [Id in ExerciseId]: { readonly loadKind: LoadKindId; readonly usesBench: boolean } }

export type SelectorExerciseId = {
	readonly [Id in ExerciseId]: (typeof exerciseById)[Id]["loadKind"] extends "SelectorPosition" ? Id : never
}[ExerciseId]

/**
 * Selector positions per weight stack: the top plate plus every plate below it.
 * CL-2403: 41 lb top plate + 20 × 20 lb. D-200: top plate + 20 × 20 lb.
 * D-300: top plate + 4 × 12.5 lb + 11 × 20 lb. D-400 and D-600: top plate + 15 × 20 lb.
 */
export const machineById = {
	"cl-2403": { stackPositions: 21n },
	"d-200": { stackPositions: 21n },
	"d-300": { stackPositions: 16n },
	"d-400": { stackPositions: 16n },
	"d-600": { stackPositions: 16n }
} as const satisfies { readonly [Id in MachineId]: { readonly stackPositions: bigint } }

export function isSelectorExercise(exercise: ExerciseId): exercise is SelectorExerciseId {
	return exerciseById[exercise].loadKind === "SelectorPosition"
}

/** The weight stack each selector exercise loads. */
export const selectorMachineByExercise = {
	"cl-2403-seated-leg-press": "cl-2403",
	"d-200-lat-pulldown": "d-200",
	"d-300-chest-press": "d-300",
	"d-200-mid-row": "d-200",
	"d-400-hamstring-curl": "d-400",
	"d-600-lower-back": "d-600",
	"d-600-abdominals": "d-600",
	"cl-2403-calf-press": "cl-2403"
} as const satisfies { readonly [Id in SelectorExerciseId]: MachineId }

/**
 * The full statement of each numbering convention named by a closed Numbering handle. Which convention a
 * control uses is part of the theory on purpose: the convention fixes what its stored numbers mean.
 */
export const numberingRules = {
	Printed: "Record the number printed or engraved at the engaged position.",
	CountFromMostUpright: "No printed numbers. Hole 1 is the most upright position; count upward as the pad reclines.",
	Unconfirmed:
		"HOIST does not document this control's numbering. Record a printed number if one is visible; otherwise stop, agree a counting rule with the user, and add that convention to the theory before recording."
} as const satisfies { readonly [Id in NumberingId]: string }

export const controlById = {
	// The installed unit has no printed numbers; hole 1 is most upright.
	"cl-2403-back-adjuster": { machine: "cl-2403", numbering: "CountFromMostUpright" },
	"cl-2403-seat-slide-adjuster": { machine: "cl-2403", numbering: "Unconfirmed" },
	"d-200-seat-pad-adjuster": { machine: "d-200", numbering: "Printed" },
	"d-200-thigh-pad-adjuster": { machine: "d-200", numbering: "Printed" },
	"d-200-horizontal-chest-pad-adjuster": { machine: "d-200", numbering: "Printed" },
	"d-300-seat-pad-adjuster": { machine: "d-300", numbering: "Printed" },
	"d-300-back-pad-adjuster": { machine: "d-300", numbering: "Printed" },
	"d-400-back-adjuster": { machine: "d-400", numbering: "Printed" },
	"d-400-range-of-motion": { machine: "d-400", numbering: "Printed" },
	"d-400-leg-length": { machine: "d-400", numbering: "Unconfirmed" },
	"d-400-thigh-brace": { machine: "d-400", numbering: "Unconfirmed" },
	"d-600-range-of-motion": { machine: "d-600", numbering: "Printed" },
	"d-600-foot-rest": { machine: "d-600", numbering: "Unconfirmed" }
} as const satisfies { readonly [Id in ControlId]: { readonly machine: MachineId; readonly numbering: NumberingId } }

/**
 * The controls a set of `exercise` may record: every control on the machine that exercise uses. Two
 * exercises on one machine therefore share exactly the same controls. Non-machine exercises have none.
 */
export function controlsFor(exercise: ExerciseId): readonly ControlId[] {
	if (!isSelectorExercise(exercise)) return []
	const machine = selectorMachineByExercise[exercise]
	return CONTROL_IDS.filter((control) => controlById[control].machine === machine)
}
