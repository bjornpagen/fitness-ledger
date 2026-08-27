import { Db } from "@bjornpagen/bumbledb"
import { FitnessLedger } from "#application/schema.ts"

export const createFitnessDatabase = (storePath: string) => Db.create(storePath, FitnessLedger)
export const openFitnessDatabase = (storePath: string) => Db.open(storePath, FitnessLedger)

export type FitnessDatabase = Awaited<ReturnType<typeof openFitnessDatabase>>
