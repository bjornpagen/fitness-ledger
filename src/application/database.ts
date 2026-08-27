import { Db } from "@bjornpagen/bumbledb"
import {
	ExerciseMachineSlot,
	ExerciseRosterMember,
	FitnessLedger,
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
	const admission = await Db.create(storePath, FitnessLedger)
	if (admission.tag !== "accepted") return rejected("BumbleDB rejected the fresh fitness store", admission.violations)
	const database = admission.value
	const roster = database.write((transaction) => {
		transaction.insert(
			ExerciseRosterMember,
			EXERCISE_IDS.map((exercise) => ({ id: exercise, exercise }))
		)
		transaction.insert(
			MachineSlotRosterMember,
			MACHINE_SLOT_IDS.map((slot) => ({ id: slot, slot }))
		)
		transaction.insert(
			ExerciseMachineSlot,
			EXERCISE_MACHINE_SLOT_IDS.map((id) => ({ id, ...exerciseMachineSlotById[id] }))
		)
	})
	if (roster.tag !== "accepted") return rejected("BumbleDB rejected the machine-slot roster", roster.violations)
	return database
}

export const openFitnessDatabase = (storePath: string) => Db.open(storePath, FitnessLedger)

export type FitnessDatabase = Awaited<ReturnType<typeof openFitnessDatabase>>
