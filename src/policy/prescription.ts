import type { DayId, EXERCISE_IDS, ExerciseId, exerciseById, LoadKindId } from "#policy/exercises.ts"

interface TrainingStart {
	readonly day: DayId
	readonly startMinute: number
}

interface ExerciseBase {
	readonly name: string
	readonly equipment: string
	readonly technique: string
}

interface DynamicExercisePrescription extends ExerciseBase {
	readonly loadKind: Exclude<LoadKindId, "TimedStaticContraction">
	readonly sets: 1 | 2
}

interface TscExercisePrescription extends ExerciseBase {
	readonly loadKind: "TimedStaticContraction"
	readonly sets: 1
	readonly durationSeconds: 90
}

type ExercisePrescription = DynamicExercisePrescription | TscExercisePrescription
type ExercisePrescriptionById = {
	readonly [Id in ExerciseId]: ExercisePrescription & {
		readonly loadKind: (typeof exerciseById)[Id]["loadKind"]
	}
}

export const exercisePrescriptionById = {
	"cl-2403-seated-leg-press": {
		name: "CL-2403 Seated Leg Press",
		equipment: "HOIST CL-2403 Seated Leg Press",
		loadKind: "SelectorPosition",
		sets: 2,
		technique:
			"Start with about a 90-degree knee bend, keep pelvis and back supported, track knees with toes, avoid rebound, and stop short of hard lockout."
	},
	"d-200-lat-pulldown": {
		name: "Dual 200 Lat Pulldown",
		equipment: "HOIST Dual 200 Lat Pulldown / Mid-Row with the long lat bar",
		loadKind: "SelectorPosition",
		sets: 2,
		technique:
			"Attach the long lat bar—not the rope or triangle handle—and use an underhand, palms-toward-you grip just inside shoulder width; lean back about 30 degrees and pull toward the upper chest without heaving or pulling behind the neck."
	},
	"d-300-chest-press": {
		name: "Dual 300 Multi-Chest chest press",
		equipment: "HOIST Dual 300 Multi-Chest",
		loadKind: "SelectorPosition",
		sets: 2,
		technique:
			"Use the horizontal handle grip, align the handles with mid-sternum, keep shoulders supported, and avoid bouncing out of the stretched position."
	},
	"d-200-mid-row": {
		name: "Dual 200 Mid-Row",
		equipment: "HOIST Dual 200 Lat Pulldown / Mid-Row",
		loadKind: "SelectorPosition",
		sets: 2,
		technique: "Keep the chest on the pad and pull without torso movement, jerking, or a finishing shrug."
	},
	"back-supported-neutral-db-overhead-press": {
		name: "Back-supported neutral-grip dumbbell overhead press",
		equipment: "Fixed rubber-hex dumbbells and adjustable bench",
		loadKind: "DumbbellPair",
		sets: 2,
		technique: "Use the bench back support, neutral wrists, a pain-free bottom position, and no lumbar overextension."
	},
	"d-400-hamstring-curl": {
		name: "Dual 400 Hamstring Curl",
		equipment: "HOIST Dual 400 Leg Extension / Hamstring Curl",
		loadKind: "SelectorPosition",
		sets: 2,
		technique:
			"Align knees with the pivot, secure the thigh brace, keep a slight knee bend at the start, and do not bounce."
	},
	"d-600-lower-back": {
		name: "Dual 600 Lower Back",
		equipment: "HOIST Dual 600 Lower Back / Abdominals",
		loadKind: "SelectorPosition",
		sets: 1,
		technique: "Lock in the foot rest and pads and use a controlled, pain-free trunk arc without hyperextending."
	},
	"d-600-abdominals": {
		name: "Dual 600 Abdominals",
		equipment: "HOIST Dual 600 Lower Back / Abdominals",
		loadKind: "SelectorPosition",
		sets: 1,
		technique:
			"Secure the lower body and flex the trunk through a controlled, pain-free arc without pulling with the arms."
	},
	"cl-2403-calf-press": {
		name: "Calf press on the CL-2403 Seated Leg Press",
		equipment: "HOIST CL-2403 Seated Leg Press",
		loadKind: "SelectorPosition",
		sets: 1,
		technique:
			"Keep knees softly extended and use full comfortable ankle motion with controlled turnarounds and no bounce."
	},
	"bench-tsc-neck-extension": {
		name: "45-degree bench timed static neck extension",
		equipment: "Adjustable bench at 45 degrees and a dedicated yoga block",
		loadKind: "TimedStaticContraction",
		sets: 1,
		durationSeconds: 90,
		technique:
			"Lie face-up with the yoga block centered under the back of the head, hold the neck neutral, and press the head into the block without moving the head or torso."
	},
	"bench-tsc-neck-flexion": {
		name: "45-degree bench timed static neck flexion",
		equipment: "Adjustable bench at 45 degrees and a dedicated yoga block",
		loadKind: "TimedStaticContraction",
		sets: 1,
		durationSeconds: 90,
		technique:
			"Lie face-down, support the body with the arms, center the forehead on the yoga block, hold the neck neutral, and press into the block without moving the head or torso."
	}
} as const satisfies ExercisePrescriptionById

type RosterCoverage<Order extends readonly ExerciseId[]> = [Exclude<ExerciseId, Order[number]>] extends [never]
	? Order["length"] extends (typeof EXERCISE_IDS)["length"]
		? unknown
		: { readonly "the recommended order must list every exercise exactly once": never }
	: { readonly "the recommended order omits": Exclude<ExerciseId, Order[number]> }

/** A permutation of the roster: every exercise once, checked by the compiler. */
function recommended<const Order extends readonly ExerciseId[]>(order: Order & RosterCoverage<Order>): Order {
	return order
}

interface ForeverPrescription {
	readonly timeZone: "America/Chicago"
	readonly strengthStarts: readonly TrainingStart[]
	readonly strength: {
		readonly repetitionMinimum: 5
		readonly repetitionMaximum: 8
		readonly restSeconds: 120
		readonly cadence: {
			readonly positiveSeconds: 5
			readonly negativeSeconds: 5
			readonly turnaround: "smooth-unpaused"
		}
		readonly promotionExposures: 2
		readonly tsc: {
			readonly stageSeconds: 30
			readonly totalSeconds: 90
		}
		/** A suggested way to move through the gym. Any order is acceptable and changes nothing else. */
		readonly recommendedOrder: readonly ExerciseId[]
	}
}

export const prescription = {
	timeZone: "America/Chicago",
	strengthStarts: [
		{ day: "Monday", startMinute: 7 * 60 },
		{ day: "Thursday", startMinute: 7 * 60 }
	],
	strength: {
		repetitionMinimum: 5,
		repetitionMaximum: 8,
		restSeconds: 120,
		cadence: {
			positiveSeconds: 5,
			negativeSeconds: 5,
			turnaround: "smooth-unpaused"
		},
		promotionExposures: 2,
		tsc: { stageSeconds: 30, totalSeconds: 90 },
		recommendedOrder: recommended([
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
		])
	}
} as const satisfies ForeverPrescription
