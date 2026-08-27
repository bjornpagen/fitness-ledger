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
import { ADJUSTMENT_KIND_IDS, EXERCISE_IDS, exerciseLoadKindById, LOAD_KIND_IDS } from "#policy/exercises.ts"

export const LoadKind = closed("LoadKind", LOAD_KIND_IDS)
export const Exercise = closed("Exercise", EXERCISE_IDS, { loadKind: LoadKind.id }, exerciseLoadKindById)
export const AdjustmentKind = closed("AdjustmentKind", ADJUSTMENT_KIND_IDS)
export const ActivityKind = closed("ActivityKind", ["Strength", "EBike"])
export const MeasurementKind = closed("MeasurementKind", ["BodyWeight", "Waist"])
export const Sex = closed("Sex", ["Female", "Male"])

export const Person = relation("Person", {
	id: u64.fresh,
	name: str,
	heightTenthsIn: u64,
	birthDateEpochDay: i64,
	sex: Sex.id
})

export const SetupSetting = relation("SetupSetting", {
	id: u64.fresh,
	person: u64,
	exercise: Exercise.id,
	kind: AdjustmentKind.id,
	value: str,
	valid: interval(i64)
})

export const Activity = relation("Activity", {
	id: u64.fresh,
	person: u64,
	kind: ActivityKind.id,
	span: interval(i64),
	timezoneOffsetMinutes: i64
})

export const StrengthActivity = relation("StrengthActivity", { activity: u64 })
export const EBikeActivity = relation("EBikeActivity", { activity: u64 })

export const SelectorWorkSet = relation("SelectorWorkSet", {
	id: u64.fresh,
	activity: u64,
	exercise: Exercise.id,
	order: u64,
	repetitions: u64,
	rir: u64,
	pain: u64,
	position: u64
})

export const DumbbellWorkSet = relation("DumbbellWorkSet", {
	id: u64.fresh,
	activity: u64,
	exercise: Exercise.id,
	order: u64,
	repetitions: u64,
	rir: u64,
	pain: u64,
	eachTenthsLb: u64
})

export const TscWorkSet = relation("TscWorkSet", {
	id: u64.fresh,
	activity: u64,
	exercise: Exercise.id,
	order: u64,
	durationSeconds: u64,
	pain: u64
})

export const HeartRateSummary = relation("HeartRateSummary", {
	activity: u64,
	averageBpm: u64,
	maxBpm: u64,
	zones: interval(u64)
})

export const HeartRateZoneDuration = relation("HeartRateZoneDuration", {
	activity: u64,
	zone: interval(u64, 1n),
	milliseconds: u64
})

export const WhoopWorkoutIdentity = relation("WhoopWorkoutIdentity", {
	activity: u64,
	externalId: bytes(16)
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

export const FitnessLedger = schema(
	"FitnessLedger",
	{
		LoadKind,
		Exercise,
		AdjustmentKind,
		ActivityKind,
		MeasurementKind,
		Sex,
		Person,
		SetupSetting,
		Activity,
		StrengthActivity,
		EBikeActivity,
		SelectorWorkSet,
		DumbbellWorkSet,
		TscWorkSet,
		HeartRateSummary,
		HeartRateZoneDuration,
		WhoopWorkoutIdentity,
		SleepInterval,
		WhoopSleepIdentity,
		Measurement,
		BodyWeightMeasurement,
		WaistMeasurement
	},
	[
		contained(on(Exercise, "loadKind"), on(LoadKind, "id")),
		personNameKey,
		contained(on(Person, "sex"), on(Sex, "id")),
		contained(on(SetupSetting, "person"), on(Person, "id")),
		contained(on(SetupSetting, "exercise"), on(Exercise, "id")),
		contained(on(SetupSetting, "kind"), on(AdjustmentKind, "id")),
		key(SetupSetting, ["person", "exercise", "kind", "valid"]),
		contained(on(Activity, "person"), on(Person, "id")),
		contained(on(Activity, "kind"), on(ActivityKind, "id")),
		key(Activity, ["person", "span"]),
		key(StrengthActivity, ["activity"]),
		key(EBikeActivity, ["activity"]),
		mirrors(on(Activity.where({ kind: "Strength" }), "id"), on(StrengthActivity, "activity")),
		mirrors(on(Activity.where({ kind: "EBike" }), "id"), on(EBikeActivity, "activity")),
		contained(on(SelectorWorkSet, "activity"), on(StrengthActivity, "activity")),
		contained(on(SelectorWorkSet, "exercise"), on(Exercise.where({ loadKind: "SelectorPosition" }), "id")),
		key(SelectorWorkSet, ["activity", "exercise", "order"]),
		contained(on(DumbbellWorkSet, "activity"), on(StrengthActivity, "activity")),
		contained(on(DumbbellWorkSet, "exercise"), on(Exercise.where({ loadKind: "DumbbellPair" }), "id")),
		key(DumbbellWorkSet, ["activity", "exercise", "order"]),
		contained(on(TscWorkSet, "activity"), on(StrengthActivity, "activity")),
		contained(on(TscWorkSet, "exercise"), on(Exercise.where({ loadKind: "TimedStaticContraction" }), "id")),
		key(TscWorkSet, ["activity", "exercise", "order"]),
		key(HeartRateSummary, ["activity"]),
		key(HeartRateSummary, ["activity", "zones"]),
		contained(on(HeartRateSummary, "activity"), on(Activity, "id")),
		key(HeartRateZoneDuration, ["activity", "zone"]),
		mirrors(on(HeartRateSummary, ["activity", "zones"]), on(HeartRateZoneDuration, ["activity", "zone"])),
		key(WhoopWorkoutIdentity, ["activity"]),
		key(WhoopWorkoutIdentity, ["externalId"]),
		contained(on(WhoopWorkoutIdentity, "activity"), on(Activity, "id")),
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
		mirrors(on(Measurement.where({ kind: "Waist" }), "id"), on(WaistMeasurement, "measurement"))
	]
)

export const keys = { personNameKey }
