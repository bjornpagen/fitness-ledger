export const LOAD_KIND_IDS = ["SelectorPosition", "DumbbellPair", "TimedStaticContraction"] as const

export const EXERCISE_IDS = [
	"cl-2403-leg-press",
	"d-200-front-lat-pulldown",
	"d-300-horizontal-chest-press",
	"d-200-chest-supported-mid-row",
	"back-supported-neutral-db-overhead-press",
	"d-400-seated-leg-curl",
	"d-600-lower-back-extension",
	"d-600-abdominal-flexion",
	"cl-2403-straight-leg-calf-press",
	"bench-tsc-neck-extension",
	"bench-tsc-neck-flexion"
] as const

export const MACHINE_IDS = ["cl-2403", "d-200", "d-300", "d-400", "d-600"] as const

export const MACHINE_SLOT_IDS = [
	"cl-2403-back-pad-angle",
	"cl-2403-fore-aft-seat-slide",
	"d-200-seat-height",
	"d-200-thigh-pad-position",
	"d-200-chest-pad-position",
	"d-300-seat-height",
	"d-300-back-pad-position",
	"d-400-back-pad-position",
	"d-400-starting-range-cam",
	"d-400-lower-leg-roller",
	"d-400-thigh-stabilization-roller",
	"d-600-starting-range-cam",
	"d-600-footrest-position"
] as const

export const EXERCISE_MACHINE_SLOT_IDS = [
	"cl-2403-leg-press--cl-2403-back-pad-angle",
	"cl-2403-leg-press--cl-2403-fore-aft-seat-slide",
	"cl-2403-straight-leg-calf-press--cl-2403-back-pad-angle",
	"cl-2403-straight-leg-calf-press--cl-2403-fore-aft-seat-slide",
	"d-200-front-lat-pulldown--d-200-seat-height",
	"d-200-front-lat-pulldown--d-200-thigh-pad-position",
	"d-200-chest-supported-mid-row--d-200-seat-height",
	"d-200-chest-supported-mid-row--d-200-chest-pad-position",
	"d-300-horizontal-chest-press--d-300-seat-height",
	"d-300-horizontal-chest-press--d-300-back-pad-position",
	"d-400-seated-leg-curl--d-400-back-pad-position",
	"d-400-seated-leg-curl--d-400-starting-range-cam",
	"d-400-seated-leg-curl--d-400-lower-leg-roller",
	"d-400-seated-leg-curl--d-400-thigh-stabilization-roller",
	"d-600-lower-back-extension--d-600-starting-range-cam",
	"d-600-lower-back-extension--d-600-footrest-position",
	"d-600-abdominal-flexion--d-600-starting-range-cam",
	"d-600-abdominal-flexion--d-600-footrest-position"
] as const

export const DAY_IDS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const

export type LoadKindId = (typeof LOAD_KIND_IDS)[number]
export type ExerciseId = (typeof EXERCISE_IDS)[number]
export type MachineId = (typeof MACHINE_IDS)[number]
export type MachineSlotId = (typeof MACHINE_SLOT_IDS)[number]
export type ExerciseMachineSlotId = (typeof EXERCISE_MACHINE_SLOT_IDS)[number]
export type DayId = (typeof DAY_IDS)[number]

export const exerciseLoadKindById = {
	"cl-2403-leg-press": { loadKind: "SelectorPosition" },
	"d-200-front-lat-pulldown": { loadKind: "SelectorPosition" },
	"d-300-horizontal-chest-press": { loadKind: "SelectorPosition" },
	"d-200-chest-supported-mid-row": { loadKind: "SelectorPosition" },
	"back-supported-neutral-db-overhead-press": { loadKind: "DumbbellPair" },
	"d-400-seated-leg-curl": { loadKind: "SelectorPosition" },
	"d-600-lower-back-extension": { loadKind: "SelectorPosition" },
	"d-600-abdominal-flexion": { loadKind: "SelectorPosition" },
	"cl-2403-straight-leg-calf-press": { loadKind: "SelectorPosition" },
	"bench-tsc-neck-extension": { loadKind: "TimedStaticContraction" },
	"bench-tsc-neck-flexion": { loadKind: "TimedStaticContraction" }
} satisfies { readonly [Id in ExerciseId]: { readonly loadKind: LoadKindId } }

export const machineSlotById = {
	"cl-2403-back-pad-angle": { machine: "cl-2403" },
	"cl-2403-fore-aft-seat-slide": { machine: "cl-2403" },
	"d-200-seat-height": { machine: "d-200" },
	"d-200-thigh-pad-position": { machine: "d-200" },
	"d-200-chest-pad-position": { machine: "d-200" },
	"d-300-seat-height": { machine: "d-300" },
	"d-300-back-pad-position": { machine: "d-300" },
	"d-400-back-pad-position": { machine: "d-400" },
	"d-400-starting-range-cam": { machine: "d-400" },
	"d-400-lower-leg-roller": { machine: "d-400" },
	"d-400-thigh-stabilization-roller": { machine: "d-400" },
	"d-600-starting-range-cam": { machine: "d-600" },
	"d-600-footrest-position": { machine: "d-600" }
} satisfies { readonly [Id in MachineSlotId]: { readonly machine: MachineId } }

export const exerciseMachineSlotById = {
	"cl-2403-leg-press--cl-2403-back-pad-angle": {
		exercise: "cl-2403-leg-press",
		slot: "cl-2403-back-pad-angle"
	},
	"cl-2403-leg-press--cl-2403-fore-aft-seat-slide": {
		exercise: "cl-2403-leg-press",
		slot: "cl-2403-fore-aft-seat-slide"
	},
	"cl-2403-straight-leg-calf-press--cl-2403-back-pad-angle": {
		exercise: "cl-2403-straight-leg-calf-press",
		slot: "cl-2403-back-pad-angle"
	},
	"cl-2403-straight-leg-calf-press--cl-2403-fore-aft-seat-slide": {
		exercise: "cl-2403-straight-leg-calf-press",
		slot: "cl-2403-fore-aft-seat-slide"
	},
	"d-200-front-lat-pulldown--d-200-seat-height": {
		exercise: "d-200-front-lat-pulldown",
		slot: "d-200-seat-height"
	},
	"d-200-front-lat-pulldown--d-200-thigh-pad-position": {
		exercise: "d-200-front-lat-pulldown",
		slot: "d-200-thigh-pad-position"
	},
	"d-200-chest-supported-mid-row--d-200-seat-height": {
		exercise: "d-200-chest-supported-mid-row",
		slot: "d-200-seat-height"
	},
	"d-200-chest-supported-mid-row--d-200-chest-pad-position": {
		exercise: "d-200-chest-supported-mid-row",
		slot: "d-200-chest-pad-position"
	},
	"d-300-horizontal-chest-press--d-300-seat-height": {
		exercise: "d-300-horizontal-chest-press",
		slot: "d-300-seat-height"
	},
	"d-300-horizontal-chest-press--d-300-back-pad-position": {
		exercise: "d-300-horizontal-chest-press",
		slot: "d-300-back-pad-position"
	},
	"d-400-seated-leg-curl--d-400-back-pad-position": {
		exercise: "d-400-seated-leg-curl",
		slot: "d-400-back-pad-position"
	},
	"d-400-seated-leg-curl--d-400-starting-range-cam": {
		exercise: "d-400-seated-leg-curl",
		slot: "d-400-starting-range-cam"
	},
	"d-400-seated-leg-curl--d-400-lower-leg-roller": {
		exercise: "d-400-seated-leg-curl",
		slot: "d-400-lower-leg-roller"
	},
	"d-400-seated-leg-curl--d-400-thigh-stabilization-roller": {
		exercise: "d-400-seated-leg-curl",
		slot: "d-400-thigh-stabilization-roller"
	},
	"d-600-lower-back-extension--d-600-starting-range-cam": {
		exercise: "d-600-lower-back-extension",
		slot: "d-600-starting-range-cam"
	},
	"d-600-lower-back-extension--d-600-footrest-position": {
		exercise: "d-600-lower-back-extension",
		slot: "d-600-footrest-position"
	},
	"d-600-abdominal-flexion--d-600-starting-range-cam": {
		exercise: "d-600-abdominal-flexion",
		slot: "d-600-starting-range-cam"
	},
	"d-600-abdominal-flexion--d-600-footrest-position": {
		exercise: "d-600-abdominal-flexion",
		slot: "d-600-footrest-position"
	}
} satisfies {
	readonly [Id in ExerciseMachineSlotId]: {
		readonly exercise: ExerciseId
		readonly slot: MachineSlotId
	}
}
