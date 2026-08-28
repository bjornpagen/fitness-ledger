import { Db, InstanceBuilder } from "@bjornpagen/bumbledb"
import {
	ExerciseMachineSlot,
	ExerciseRosterMember,
	FitnessLedger,
	HeartRateZonePartitionMember,
	MachineSlotRosterMember
} from "#application/schema.ts"
import { failFitnessLedger } from "#mechanism/failure.ts"
import {
	EXERCISE_IDS,
	EXERCISE_MACHINE_SLOT_IDS,
	exerciseMachineSlotById,
	MACHINE_SLOT_IDS
} from "#policy/exercises.ts"

function rejected(label: string, violations: readonly { readonly canonical: string }[]): never {
	return failFitnessLedger(`${label}:\n${violations.map((violation) => violation.canonical).join("\n")}`)
}

export async function createFitnessDatabase(storePath: string) {
	const builder = InstanceBuilder.create(FitnessLedger)
	builder.load(
		ExerciseRosterMember,
		EXERCISE_IDS.map((exercise) => ({ id: exercise, exercise }))
	)
	builder.load(
		MachineSlotRosterMember,
		MACHINE_SLOT_IDS.map((slot) => ({ id: slot, slot }))
	)
	builder.load(
		ExerciseMachineSlot,
		EXERCISE_MACHINE_SLOT_IDS.map((id) => ({ id, ...exerciseMachineSlotById[id] }))
	)
	builder.load(HeartRateZonePartitionMember, [{ id: "SixZones", zones: { start: 0n, end: 6n } }])
	const admission = await builder.admit()
	if (admission.tag !== "accepted") {
		return rejected("BumbleDB rejected the fresh fitness store", admission.violations)
	}
	return Db.fromInstance(storePath, admission.value)
}

export const openFitnessDatabase = (storePath: string) => Db.open(storePath, FitnessLedger)

export type FitnessDatabase = Awaited<ReturnType<typeof openFitnessDatabase>>
