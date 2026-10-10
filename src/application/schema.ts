import {
	alternatives,
	bool,
	capacity,
	closed,
	closedId,
	contained,
	f64,
	i64,
	key,
	on,
	ref,
	relation,
	schema,
	select,
	str,
	u64,
	uuid,
	weigh,
	within
} from "@bjornpagen/bumbledb"
import {
	CONTROL_IDS,
	controlById,
	EXERCISE_IDS,
	exerciseById,
	isSelectorExercise,
	LOAD_KIND_IDS,
	MACHINE_IDS,
	machineById,
	NUMBERING_IDS,
	selectorMachineByExercise
} from "#policy/exercises.ts"

export const LoadKind = closed("LoadKind", LOAD_KIND_IDS)
export const Exercise = closed(
	"Exercise",
	EXERCISE_IDS,
	{ loadKind: closedId(LoadKind), usesBench: bool },
	exerciseById
)
/** Selector positions per stack: the top plate is 1 and every plate below it adds one. */
export const Machine = closed("Machine", MACHINE_IDS, { stackPositions: u64 }, machineById)
/**
 * How a control's stored number is read. BumbleDB refuses str payloads on closed relations (the handle
 * is the label), so the handle names the convention and `numberingRules` in policy states it in full.
 * Each control's convention is part of the fingerprint on purpose: the convention fixes what the
 * control's stored numbers mean.
 */
export const Numbering = closed("Numbering", NUMBERING_IDS)
/** One physical adjustment on one machine, under HOIST's name. */
export const Control = closed(
	"Control",
	CONTROL_IDS,
	{ machine: closedId(Machine), numbering: closedId(Numbering) },
	controlById
)
export const TimePrecision = closed("TimePrecision", ["Minute", "Millisecond"])
export const PAIN_RATING_IDS = [
	"NoPain",
	"VeryMild",
	"Discomforting",
	"Tolerable",
	"Distressing",
	"VeryDistressing",
	"Intense",
	"VeryIntense",
	"UtterlyHorrible",
	"ExcruciatingUnbearable",
	"UnimaginableUnspeakable"
] as const
export type PainRatingId = (typeof PAIN_RATING_IDS)[number]
export const PainRating = closed("PainRating", PAIN_RATING_IDS)

/** One training session. A session without a SessionEnd is open. */
export const Session = relation("Session", { id: uuid })
/**
 * Observed session boundaries. `at` is epoch milliseconds of the actual event (u64: no session predates
 * 1970, and capacity weights must be unsigned); Minute precision means the true instant lies within that
 * minute. Either may be absent; neither is ever invented. A recorded start never follows its end.
 */
export const SessionStart = relation("SessionStart", {
	session: uuid,
	at: u64,
	precision: closedId(TimePrecision),
	timezoneOffsetMinutes: i64
})
export const SessionEnd = relation("SessionEnd", {
	session: uuid,
	at: u64,
	precision: closedId(TimePrecision),
	timezoneOffsetMinutes: i64
})

/** `setNumber` counts sets within one exercise of one session, from 1. */
export const WorkSet = relation("WorkSet", {
	id: uuid,
	session: uuid,
	exercise: closedId(Exercise),
	loadKind: closedId(LoadKind),
	setNumber: u64,
	painRating: closedId(PainRating)
})

/** `resistancePosition` is the plate number counted down from the top plate (1); higher is always heavier. */
export const SelectorWorkSet = relation("SelectorWorkSet", {
	workSet: uuid,
	repetitions: u64,
	resistancePosition: u64
})

export const DumbbellWorkSet = relation("DumbbellWorkSet", {
	workSet: uuid,
	repetitions: u64,
	eachTenthsLb: u64
})

export const TscWorkSet = relation("TscWorkSet", {
	workSet: uuid,
	durationSeconds: u64
})

/**
 * One observed body-fit coordinate on one set. A set may record any control on its exercise's machine,
 * so exercises sharing a machine share exactly the same controls. The setting carries its exercise
 * because BumbleDB containments cannot follow joins: matching the set's (id, exercise) and selecting
 * Control by that exercise's machine is how the theory proves the control belongs to this set's machine.
 */
export const WorkSetSetting = relation("WorkSetSetting", {
	workSet: uuid,
	exercise: closedId(Exercise),
	control: closedId(Control),
	position: u64
})

/** The bench actually used, named inline on each set; no bench model or mark range is assumed. */
export const WorkSetBench = relation("WorkSetBench", { workSet: uuid, exercise: closedId(Exercise), bench: str })
export const BenchBackrestAngle = relation("BenchBackrestAngle", { workSet: uuid, degrees: f64 })
export const BenchBackrestPosition = relation("BenchBackrestPosition", { workSet: uuid, mark: str })
export const BenchSeatAdjustment = relation("BenchSeatAdjustment", { workSet: uuid, adjustable: bool })
export const BenchSeatPosition = relation("BenchSeatPosition", { workSet: uuid, mark: str })

export const SessionById = key(Session, ["id"])
export const SessionStartBySession = key(SessionStart, ["session"])
export const SessionEndBySession = key(SessionEnd, ["session"])
export const WorkSetById = key(WorkSet, ["id"])
export const WorkSetBySessionExerciseSet = key(WorkSet, ["session", "exercise", "setNumber"])
export const SelectorWorkSetByWorkSet = key(SelectorWorkSet, ["workSet"])
export const DumbbellWorkSetByWorkSet = key(DumbbellWorkSet, ["workSet"])
export const TscWorkSetByWorkSet = key(TscWorkSet, ["workSet"])
export const WorkSetSettingByControl = key(WorkSetSetting, ["workSet", "control"])
export const WorkSetBenchByWorkSet = key(WorkSetBench, ["workSet"])
export const BenchBackrestAngleByWorkSet = key(BenchBackrestAngle, ["workSet"])
export const BenchBackrestPositionByWorkSet = key(BenchBackrestPosition, ["workSet"])
export const BenchSeatAdjustmentByWorkSet = key(BenchSeatAdjustment, ["workSet"])
export const BenchSeatPositionByWorkSet = key(BenchSeatPosition, ["workSet"])

export const FitnessLedger = schema(
	"FitnessLedger",
	{
		LoadKind,
		Exercise,
		Machine,
		Numbering,
		Control,
		TimePrecision,
		PainRating,
		Session,
		SessionStart,
		SessionEnd,
		WorkSet,
		SelectorWorkSet,
		DumbbellWorkSet,
		TscWorkSet,
		WorkSetSetting,
		WorkSetBench,
		BenchBackrestAngle,
		BenchBackrestPosition,
		BenchSeatAdjustment,
		BenchSeatPosition
	},
	[
		contained(on(Exercise, "loadKind"), on(LoadKind, "id")),
		contained(on(Control, "machine"), on(Machine, "id")),
		contained(on(Control, "numbering"), on(Numbering, "id")),

		SessionById,
		SessionStartBySession,
		contained(on(SessionStart, "session"), on(Session, "id")),
		contained(on(SessionStart, "precision"), on(TimePrecision, "id")),
		SessionEndBySession,
		contained(on(SessionEnd, "session"), on(Session, "id")),
		contained(on(SessionEnd, "precision"), on(TimePrecision, "id")),
		// Start never follows end: each SessionEnd bounds the (single, keyed) start of its session. A
		// session with only one boundary has nothing to compare and is admitted.
		capacity(on(SessionEnd, "session"), {
			from: on(SessionStart, "session"),
			weight: weigh("at"),
			within: within(0n, ref("at"))
		}),

		WorkSetById,
		WorkSetBySessionExerciseSet,
		key(WorkSet, ["id", "exercise"]),
		contained(on(WorkSet, "session"), on(Session, "id")),
		contained(on(WorkSet, "exercise"), on(Exercise, "id")),
		contained(on(WorkSet, "painRating"), on(PainRating, "id")),
		...LOAD_KIND_IDS.map((loadKind) =>
			contained(on(select(WorkSet, { loadKind }), "exercise"), on(select(Exercise, { loadKind }), "id"))
		),
		// Positivity: each keyed row is its own capacity group, so its weighed column must lie in [1, ∞).
		capacity(on(WorkSet, ["id"]), { from: on(WorkSet, ["id"]), weight: weigh("setNumber"), within: within(1n, "*") }),
		SelectorWorkSetByWorkSet,
		DumbbellWorkSetByWorkSet,
		TscWorkSetByWorkSet,
		// Exactly one child of the parent's load kind; also emits the WorkSet.loadKind containment.
		...alternatives(WorkSetById, "loadKind", LoadKind, {
			SelectorPosition: SelectorWorkSetByWorkSet,
			DumbbellPair: DumbbellWorkSetByWorkSet,
			TimedStaticContraction: TscWorkSetByWorkSet
		}),
		capacity(on(SelectorWorkSet, ["workSet"]), {
			from: on(SelectorWorkSet, ["workSet"]),
			weight: weigh("resistancePosition"),
			within: within(1n, "*")
		}),
		capacity(on(DumbbellWorkSet, ["workSet"]), {
			from: on(DumbbellWorkSet, ["workSet"]),
			weight: weigh("eachTenthsLb"),
			within: within(1n, "*")
		}),

		WorkSetSettingByControl,
		contained(on(WorkSetSetting, ["workSet", "exercise"]), on(WorkSet, ["id", "exercise"])),
		// Only machine exercises carry settings, and only for controls on that exercise's machine.
		contained(on(WorkSetSetting, "exercise"), on(select(Exercise, { loadKind: "SelectorPosition" }), "id")),
		contained(on(WorkSetSetting, "control"), on(Control, "id")),
		...EXERCISE_IDS.filter(isSelectorExercise).map((exercise) =>
			contained(
				on(select(WorkSetSetting, { exercise }), "control"),
				on(select(Control, { machine: selectorMachineByExercise[exercise] }), "id")
			)
		),
		capacity(on(WorkSetSetting, ["workSet", "control"]), {
			from: on(WorkSetSetting, ["workSet", "control"]),
			weight: weigh("position"),
			within: within(1n, "*")
		}),

		WorkSetBenchByWorkSet,
		contained(on(WorkSetBench, ["workSet", "exercise"]), on(WorkSet, ["id", "exercise"])),
		contained(on(WorkSetBench, "exercise"), on(select(Exercise, { usesBench: true }), "id")),
		BenchBackrestAngleByWorkSet,
		contained(on(BenchBackrestAngle, "workSet"), on(WorkSetBench, "workSet")),
		BenchBackrestPositionByWorkSet,
		contained(on(BenchBackrestPosition, "workSet"), on(WorkSetBench, "workSet")),
		BenchSeatAdjustmentByWorkSet,
		contained(on(BenchSeatAdjustment, "workSet"), on(WorkSetBench, "workSet")),
		BenchSeatPositionByWorkSet,
		contained(on(BenchSeatPosition, "workSet"), on(select(BenchSeatAdjustment, { adjustable: true }), "workSet"))
	]
)
