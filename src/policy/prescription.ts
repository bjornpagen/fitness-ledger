import { type DayId, EXERCISE_IDS, type ExerciseId, type LoadKindId } from "#policy/exercises.ts"

interface TrainingWindow {
	readonly day: DayId
	readonly startMinute: number
	readonly endMinute: number
}

interface ExerciseBase {
	readonly order: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11
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
type ExercisePrescriptionById = { readonly [Id in ExerciseId]: ExercisePrescription }

export const exercisePrescriptionById = {
	"cl-2403-leg-press": {
		order: 1,
		name: "HOIST CL-2403 leg press",
		equipment: "HOIST CL-2403 Seated Leg Press",
		loadKind: "SelectorPosition",
		sets: 2,
		technique: "Keep pelvis and back supported, track knees with toes, avoid rebound, and stop short of hard lockout."
	},
	"d-200-front-lat-pulldown": {
		order: 2,
		name: "HOIST D-200 close-underhand front pulldown",
		equipment: "HOIST D-200 with the long lat-pulldown bar attachment",
		loadKind: "SelectorPosition",
		sets: 2,
		technique:
			"Attach the long lat-pulldown bar—not the rope or triangle handle—and use a palms-toward-you underhand grip just inside shoulder width; lean back about 30 degrees and pull toward the upper chest without heaving or pulling behind the neck."
	},
	"d-300-horizontal-chest-press": {
		order: 3,
		name: "HOIST D-300 horizontal chest press",
		equipment: "HOIST D-300 Multi-Chest",
		loadKind: "SelectorPosition",
		sets: 2,
		technique:
			"Align handles with mid-sternum, keep shoulders supported, and avoid bouncing out of the stretched position."
	},
	"d-200-chest-supported-mid-row": {
		order: 4,
		name: "HOIST D-200 chest-supported mid-row",
		equipment: "HOIST D-200 Lat Pulldown / Mid-Row",
		loadKind: "SelectorPosition",
		sets: 2,
		technique: "Keep the chest on the pad and pull without torso movement, jerking, or a finishing shrug."
	},
	"back-supported-neutral-db-overhead-press": {
		order: 5,
		name: "Back-supported neutral-grip dumbbell overhead press",
		equipment: "Fixed rubber-hex dumbbells and adjustable bench",
		loadKind: "DumbbellPair",
		sets: 2,
		technique: "Use the bench back support, neutral wrists, a pain-free bottom position, and no lumbar overextension."
	},
	"d-400-seated-leg-curl": {
		order: 6,
		name: "HOIST D-400 seated leg curl",
		equipment: "HOIST D-400 Leg Combo",
		loadKind: "SelectorPosition",
		sets: 2,
		technique:
			"Align knees with the pivot, secure the thigh pad, keep a slight knee bend at the start, and do not bounce."
	},
	"d-600-lower-back-extension": {
		order: 7,
		name: "HOIST D-600 lower-back extension",
		equipment: "HOIST D-600 Lower Back / Abdominals",
		loadKind: "SelectorPosition",
		sets: 1,
		technique: "Lock in the footrest and pads and use a controlled, pain-free trunk arc without hyperextending."
	},
	"d-600-abdominal-flexion": {
		order: 8,
		name: "HOIST D-600 abdominal flexion",
		equipment: "HOIST D-600 Lower Back / Abdominals",
		loadKind: "SelectorPosition",
		sets: 1,
		technique:
			"Secure the lower body and flex the trunk through a controlled, pain-free arc without pulling with the arms."
	},
	"cl-2403-straight-leg-calf-press": {
		order: 9,
		name: "HOIST CL-2403 straight-leg calf press",
		equipment: "HOIST CL-2403 Seated Leg Press",
		loadKind: "SelectorPosition",
		sets: 1,
		technique:
			"Keep knees softly extended and use full comfortable ankle motion with controlled turnarounds and no bounce."
	},
	"bench-tsc-neck-extension": {
		order: 10,
		name: "45-degree bench timed static neck extension",
		equipment: "Adjustable bench at 45 degrees and a dedicated yoga block",
		loadKind: "TimedStaticContraction",
		sets: 1,
		durationSeconds: 90,
		technique:
			"Lie face-up with the yoga block centered under the back of the head, hold the neck neutral, and press the head into the block without moving the head or torso."
	},
	"bench-tsc-neck-flexion": {
		order: 11,
		name: "45-degree bench timed static neck flexion",
		equipment: "Adjustable bench at 45 degrees and a dedicated yoga block",
		loadKind: "TimedStaticContraction",
		sets: 1,
		durationSeconds: 90,
		technique:
			"Lie face-down, support the body with the arms, center the forehead on the yoga block, hold the neck neutral, and press into the block without moving the head or torso."
	}
} satisfies ExercisePrescriptionById

const exerciseOrder = [...EXERCISE_IDS].sort(
	(left, right) => exercisePrescriptionById[left].order - exercisePrescriptionById[right].order
)

interface ForeverPrescription {
	readonly timeZone: "America/Chicago"
	readonly daily: {
		readonly wakeMinute: number
		readonly caffeineMilligrams: number
		readonly caffeineCutoffMinute: number
		readonly windDownMinute: number
		readonly lightsOutMinute: number
	}
	readonly strengthWindows: readonly TrainingWindow[]
	readonly eBikeWindows: readonly TrainingWindow[]
	readonly strength: {
		readonly repetitionMinimum: 8
		readonly repetitionMaximum: 12
		readonly targetRir: 2
		readonly restSeconds: 120
		readonly cadence: {
			readonly lowerSeconds: 2
			readonly turnSeconds: 1
			readonly liftSeconds: 2
		}
		readonly promotionExposures: 2
		readonly tsc: {
			readonly stageSeconds: 30
			readonly totalSeconds: 90
		}
		readonly exerciseOrder: readonly ExerciseId[]
	}
	readonly eBike: {
		readonly easyOpeningMinutes: 5
		readonly zone2Minutes: 50
		readonly easyClosingMinutes: 5
	}
}

export const prescription = {
	timeZone: "America/Chicago",
	daily: {
		wakeMinute: 6 * 60 + 30,
		caffeineMilligrams: 200,
		caffeineCutoffMinute: 14 * 60 + 30,
		windDownMinute: 21 * 60 + 15,
		lightsOutMinute: 22 * 60
	},
	strengthWindows: [
		{ day: "Monday", startMinute: 7 * 60, endMinute: 8 * 60 },
		{ day: "Thursday", startMinute: 7 * 60, endMinute: 8 * 60 }
	],
	eBikeWindows: [
		{ day: "Tuesday", startMinute: 7 * 60, endMinute: 8 * 60 },
		{ day: "Friday", startMinute: 7 * 60, endMinute: 8 * 60 },
		{ day: "Saturday", startMinute: 7 * 60, endMinute: 8 * 60 }
	],
	strength: {
		repetitionMinimum: 8,
		repetitionMaximum: 12,
		targetRir: 2,
		restSeconds: 120,
		cadence: { lowerSeconds: 2, turnSeconds: 1, liftSeconds: 2 },
		promotionExposures: 2,
		tsc: { stageSeconds: 30, totalSeconds: 90 },
		exerciseOrder
	},
	eBike: { easyOpeningMinutes: 5, zone2Minutes: 50, easyClosingMinutes: 5 }
} satisfies ForeverPrescription
