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

export const ADJUSTMENT_KIND_IDS = [
	"Seat",
	"Back",
	"Thigh",
	"Chest",
	"SeatSlide",
	"Footrest",
	"Range",
	"BenchAngle",
	"HeadPad",
	"Other"
] as const

export const DAY_IDS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const

export type LoadKindId = (typeof LOAD_KIND_IDS)[number]
export type ExerciseId = (typeof EXERCISE_IDS)[number]
export type AdjustmentKindId = (typeof ADJUSTMENT_KIND_IDS)[number]
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
