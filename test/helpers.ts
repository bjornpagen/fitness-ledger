import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createFitnessDatabase, type FitnessDatabase } from "#application/database.ts"
import { Person } from "#application/schema.ts"
import { calendarDateToEpochDay } from "#mechanism/dates.ts"
import { failFitnessLedger } from "#mechanism/failure.ts"

export function reserved(value: bigint | undefined): bigint {
	if (value === undefined) return failFitnessLedger("fresh id reservation was empty")
	return value
}

export async function testDatabase(prefix: string): Promise<FitnessDatabase> {
	const root = await mkdtemp(join(tmpdir(), prefix))
	const database = await createFitnessDatabase(join(root, "database"))
	const outcome = database.write((transaction) => {
		const person = reserved(transaction.reserve(Person, "id", 1n).at(0n))
		transaction.insert(Person, [
			{
				id: person,
				name: "Example Person",
				heightTenthsIn: 720n,
				birthDateEpochDay: calendarDateToEpochDay("1990-04-12"),
				sex: "Female"
			}
		])
		return person
	})
	if (outcome.tag !== "accepted") return failFitnessLedger("test profile was rejected")
	return database
}
