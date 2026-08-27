import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
export const PRIVATE_ROOT = resolve(PROJECT_ROOT, "private")
export const STORE_PATH =
	process.env.FITNESS_LEDGER_STORE === undefined
		? resolve(PRIVATE_ROOT, "database")
		: resolve(process.env.FITNESS_LEDGER_STORE)
export const PRIVATE_SOURCE_ROOT = resolve(PRIVATE_ROOT, "sources")
export const DERIVED_TEXT_ROOT =
	process.env.FITNESS_LEDGER_DERIVED_TEXT === undefined
		? resolve(PRIVATE_ROOT, "generated/text")
		: resolve(process.env.FITNESS_LEDGER_DERIVED_TEXT)
