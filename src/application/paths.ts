import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { failFitnessLedger } from "#mechanism/failure.ts"
import { assertContainedDestination, canonicalDestination, isWithin } from "#mechanism/paths.ts"

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
export const PRIVATE_ROOT = resolve(PROJECT_ROOT, "private")
export function privateDestination(root: string, configured: string | undefined, fallback: string): string {
	if (configured !== undefined && configured.trim().length === 0)
		return failFitnessLedger("private path override cannot be empty", undefined, "InvalidPath")
	const path = resolve(configured ?? resolve(root, fallback))
	if (path === root || !isWithin(root, path) || isWithin(resolve(root, "sources"), path)) {
		return failFitnessLedger(
			"database and generated output must stay inside private/ and outside original sources",
			undefined,
			"InvalidPath"
		)
	}
	return path
}

/** The store `FITNESS_LEDGER_STORE` selects, default `private/ledger.bdb`. Resolved when used, so a bad override is a refusal. */
export const storePath = () => privateDestination(PRIVATE_ROOT, process.env.FITNESS_LEDGER_STORE, "ledger.bdb")
export const PRIVATE_SOURCE_ROOT = resolve(PRIVATE_ROOT, "sources")
export const DERIVED_TEXT_ROOT = privateDestination(
	PRIVATE_ROOT,
	process.env.FITNESS_LEDGER_DERIVED_TEXT,
	"generated/text"
)

export async function assertPrivateDestination(path: string): Promise<string> {
	const destination = await assertContainedDestination(PRIVATE_ROOT, path)
	// A symlink into purchased originals is not a permissible output override.
	const sourceRoot = await canonicalDestination(PRIVATE_SOURCE_ROOT)
	if (isWithin(sourceRoot, destination))
		return failFitnessLedger("refusing to write into original sources", undefined, "InvalidPath")
	return destination
}
