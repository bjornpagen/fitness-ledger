import {
	bool,
	bytes,
	closed,
	contained,
	i64,
	interval,
	key,
	mirrors,
	on,
	relation,
	schema,
	str,
	u64
} from "@bjornpagen/bumbledb"
import {
	EXERCISE_IDS,
	EXERCISE_MACHINE_SLOT_IDS,
	exerciseLoadKindById,
	exerciseMachineSlotById,
	LOAD_KIND_IDS,
	MACHINE_IDS,
	MACHINE_SLOT_IDS,
	machineSlotById
} from "#policy/exercises.ts"

export const LoadKind = closed("LoadKind", LOAD_KIND_IDS)
export const Exercise = closed("Exercise", EXERCISE_IDS, { loadKind: LoadKind.id }, exerciseLoadKindById)
export const Machine = closed("Machine", MACHINE_IDS)
export const MachineSlot = closed("MachineSlot", MACHINE_SLOT_IDS, { machine: Machine.id }, machineSlotById)
export const ExerciseMachineSlotId = closed("ExerciseMachineSlotId", EXERCISE_MACHINE_SLOT_IDS)
export const ActivityKind = closed("ActivityKind", ["Strength", "EBike"])
export const CompletedAtPrecision = closed("CompletedAtPrecision", ["Minute", "Millisecond"])
export const MeasurementKind = closed("MeasurementKind", ["BodyWeight", "Waist"])
export const Sex = closed("Sex", ["Female", "Male"])

export const Person = relation("Person", {
	id: u64.fresh,
	name: str,
	heightTenthsIn: u64,
	birthDateEpochDay: i64,
	sex: Sex.id
})

export const ExerciseRosterMember = relation("ExerciseRosterMember", {
	id: Exercise.id,
	exercise: Exercise.id
})
export const MachineSlotRosterMember = relation("MachineSlotRosterMember", {
	id: MachineSlot.id,
	slot: MachineSlot.id
})

export const ExerciseMachineSlot = relation("ExerciseMachineSlot", {
	id: ExerciseMachineSlotId.id,
	exercise: Exercise.id,
	slot: MachineSlot.id
})

export const MachineSlotPosition = relation("MachineSlotPosition", {
	slot: MachineSlot.id,
	position: u64
})

export const Activity = relation("Activity", {
	id: u64.fresh,
	person: u64,
	kind: ActivityKind.id,
	completedAt: i64,
	completedAtPrecision: CompletedAtPrecision.id,
	timezoneOffsetMinutes: i64
})

export const StrengthActivity = relation("StrengthActivity", { activity: u64 })
export const EBikeActivity = relation("EBikeActivity", { activity: u64 })

export const WorkSet = relation("WorkSet", {
	id: u64.fresh,
	activity: u64,
	exercise: Exercise.id,
	loadKind: LoadKind.id,
	order: u64,
	pain: u64
})

export const SelectorWorkSet = relation("SelectorWorkSet", {
	workSet: u64,
	repetitions: u64,
	rir: u64,
	resistancePosition: u64
})

export const DumbbellWorkSet = relation("DumbbellWorkSet", {
	workSet: u64,
	repetitions: u64,
	rir: u64,
	eachTenthsLb: u64
})

export const TscWorkSet = relation("TscWorkSet", {
	workSet: u64,
	durationSeconds: u64
})

export const WorkSetMachineSetting = relation("WorkSetMachineSetting", {
	workSet: u64,
	exercise: Exercise.id,
	slot: MachineSlot.id,
	position: u64
})

export const WhoopWorkout = relation("WhoopWorkout", {
	externalId: bytes(16),
	person: u64,
	kind: ActivityKind.id,
	span: interval(i64),
	timezoneOffsetMinutes: i64
})

export const ActivityWhoopWorkout = relation("ActivityWhoopWorkout", {
	activity: u64,
	externalId: bytes(16)
})

export const HeartRateSummary = relation("HeartRateSummary", {
	externalId: bytes(16),
	averageBpm: u64,
	maxBpm: u64,
	zones: interval(u64)
})

export const HeartRateZoneDuration = relation("HeartRateZoneDuration", {
	externalId: bytes(16),
	zone: interval(u64, 1n),
	milliseconds: u64
})

export const SleepInterval = relation("SleepInterval", {
	id: u64.fresh,
	person: u64,
	span: interval(i64),
	timezoneOffsetMinutes: i64,
	nap: bool
})

export const WhoopSleepIdentity = relation("WhoopSleepIdentity", {
	sleep: u64,
	externalId: bytes(16)
})

export const Measurement = relation("Measurement", {
	id: u64.fresh,
	person: u64,
	observedAt: i64,
	kind: MeasurementKind.id
})

export const BodyWeightMeasurement = relation("BodyWeightMeasurement", {
	measurement: u64,
	tenthsLb: u64
})

export const WaistMeasurement = relation("WaistMeasurement", {
	measurement: u64,
	tenthsIn: u64
})

const personNameKey = key(Person, ["name"])

const exerciseMachineSlotLaws = EXERCISE_MACHINE_SLOT_IDS.flatMap((id) => {
	const { exercise, slot } = exerciseMachineSlotById[id]
	const pair = ExerciseMachineSlot.where({ id })
	return [
		contained(on(pair, "exercise"), on(ExerciseRosterMember.where({ id: exercise }), "exercise")),
		contained(on(pair, "slot"), on(MachineSlotRosterMember.where({ id: slot }), "slot"))
	]
})

export const FitnessLedger = schema(
	"FitnessLedger",
	{
		LoadKind,
		Exercise,
		Machine,
		MachineSlot,
		ExerciseMachineSlotId,
		ActivityKind,
		CompletedAtPrecision,
		MeasurementKind,
		Sex,
		Person,
		ExerciseRosterMember,
		MachineSlotRosterMember,
		ExerciseMachineSlot,
		MachineSlotPosition,
		Activity,
		StrengthActivity,
		EBikeActivity,
		WorkSet,
		SelectorWorkSet,
		DumbbellWorkSet,
		TscWorkSet,
		WorkSetMachineSetting,
		WhoopWorkout,
		ActivityWhoopWorkout,
		HeartRateSummary,
		HeartRateZoneDuration,
		SleepInterval,
		WhoopSleepIdentity,
		Measurement,
		BodyWeightMeasurement,
		WaistMeasurement
	},
	[
		contained(on(Exercise, "loadKind"), on(LoadKind, "id")),
		contained(on(MachineSlot, "machine"), on(Machine, "id")),
		personNameKey,
		contained(on(Person, "sex"), on(Sex, "id")),
		contained(on(ExerciseRosterMember, "id"), on(Exercise, "id")),
		contained(on(ExerciseRosterMember, "exercise"), on(Exercise, "id")),
		key(ExerciseRosterMember, ["id"]),
		key(ExerciseRosterMember, ["exercise"]),
		mirrors(on(ExerciseRosterMember, "id"), on(ExerciseRosterMember, "exercise")),
		contained(on(MachineSlotRosterMember, "id"), on(MachineSlot, "id")),
		contained(on(MachineSlotRosterMember, "slot"), on(MachineSlot, "id")),
		key(MachineSlotRosterMember, ["id"]),
		key(MachineSlotRosterMember, ["slot"]),
		mirrors(on(MachineSlotRosterMember, "id"), on(MachineSlotRosterMember, "slot")),
		contained(on(ExerciseMachineSlot, "id"), on(ExerciseMachineSlotId, "id")),
		contained(on(ExerciseMachineSlot, "exercise"), on(Exercise, "id")),
		contained(on(ExerciseMachineSlot, "slot"), on(MachineSlot, "id")),
		key(ExerciseMachineSlot, ["id"]),
		key(ExerciseMachineSlot, ["exercise", "slot"]),
		contained(on(MachineSlotPosition, "slot"), on(MachineSlot, "id")),
		key(MachineSlotPosition, ["slot", "position"]),
		contained(on(Activity, "person"), on(Person, "id")),
		contained(on(Activity, "kind"), on(ActivityKind, "id")),
		contained(on(Activity, "completedAtPrecision"), on(CompletedAtPrecision, "id")),
		key(StrengthActivity, ["activity"]),
		key(EBikeActivity, ["activity"]),
		mirrors(on(Activity.where({ kind: "Strength" }), "id"), on(StrengthActivity, "activity")),
		mirrors(on(Activity.where({ kind: "EBike" }), "id"), on(EBikeActivity, "activity")),
		contained(on(WorkSet, "activity"), on(StrengthActivity, "activity")),
		contained(on(WorkSet, "exercise"), on(Exercise, "id")),
		contained(on(WorkSet, "loadKind"), on(LoadKind, "id")),
		contained(
			on(WorkSet.where({ loadKind: "SelectorPosition" }), "exercise"),
			on(Exercise.where({ loadKind: "SelectorPosition" }), "id")
		),
		contained(
			on(WorkSet.where({ loadKind: "DumbbellPair" }), "exercise"),
			on(Exercise.where({ loadKind: "DumbbellPair" }), "id")
		),
		contained(
			on(WorkSet.where({ loadKind: "TimedStaticContraction" }), "exercise"),
			on(Exercise.where({ loadKind: "TimedStaticContraction" }), "id")
		),
		key(WorkSet, ["activity", "exercise", "order"]),
		key(WorkSet, ["id", "exercise"]),
		key(SelectorWorkSet, ["workSet"]),
		key(DumbbellWorkSet, ["workSet"]),
		key(TscWorkSet, ["workSet"]),
		mirrors(on(WorkSet.where({ loadKind: "SelectorPosition" }), "id"), on(SelectorWorkSet, "workSet")),
		mirrors(on(WorkSet.where({ loadKind: "DumbbellPair" }), "id"), on(DumbbellWorkSet, "workSet")),
		mirrors(on(WorkSet.where({ loadKind: "TimedStaticContraction" }), "id"), on(TscWorkSet, "workSet")),
		contained(on(WorkSetMachineSetting, ["workSet", "exercise"]), on(WorkSet, ["id", "exercise"])),
		contained(on(WorkSetMachineSetting, ["exercise", "slot"]), on(ExerciseMachineSlot, ["exercise", "slot"])),
		contained(on(WorkSetMachineSetting, ["slot", "position"]), on(MachineSlotPosition, ["slot", "position"])),
		key(WorkSetMachineSetting, ["workSet", "slot"]),
		contained(on(WhoopWorkout, "person"), on(Person, "id")),
		contained(on(WhoopWorkout, "kind"), on(ActivityKind, "id")),
		key(WhoopWorkout, ["externalId"]),
		contained(on(ActivityWhoopWorkout, "activity"), on(Activity, "id")),
		contained(on(ActivityWhoopWorkout, "externalId"), on(WhoopWorkout, "externalId")),
		key(ActivityWhoopWorkout, ["activity"]),
		key(ActivityWhoopWorkout, ["externalId"]),
		contained(on(HeartRateSummary, "externalId"), on(WhoopWorkout, "externalId")),
		key(HeartRateSummary, ["externalId"]),
		key(HeartRateSummary, ["externalId", "zones"]),
		key(HeartRateZoneDuration, ["externalId", "zone"]),
		mirrors(on(HeartRateSummary, ["externalId", "zones"]), on(HeartRateZoneDuration, ["externalId", "zone"])),
		contained(on(SleepInterval, "person"), on(Person, "id")),
		key(SleepInterval, ["person", "span"]),
		key(WhoopSleepIdentity, ["sleep"]),
		key(WhoopSleepIdentity, ["externalId"]),
		contained(on(WhoopSleepIdentity, "sleep"), on(SleepInterval, "id")),
		contained(on(Measurement, "person"), on(Person, "id")),
		contained(on(Measurement, "kind"), on(MeasurementKind, "id")),
		key(Measurement, ["person", "observedAt", "kind"]),
		key(BodyWeightMeasurement, ["measurement"]),
		key(WaistMeasurement, ["measurement"]),
		mirrors(on(Measurement.where({ kind: "BodyWeight" }), "id"), on(BodyWeightMeasurement, "measurement")),
		mirrors(on(Measurement.where({ kind: "Waist" }), "id"), on(WaistMeasurement, "measurement")),
		...exerciseMachineSlotLaws
	]
)

export const keys = { personNameKey }
