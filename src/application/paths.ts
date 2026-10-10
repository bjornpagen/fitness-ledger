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

export const PRIVATE_SOURCE_ROOT = resolve(PRIVATE_ROOT, "sources")

/**
 * A store may live anywhere except the tracked repository tree (where it could be committed) and the
 * original sources. Inside the repository, that leaves `private/` apart from `private/sources/`.
 */
function storeRefusal(path: string): string | undefined {
	if (isWithin(PRIVATE_SOURCE_ROOT, path)) return "a store cannot live inside private/sources/"
	if (path === PRIVATE_ROOT) return "a store needs its own directory inside private/"
	if (isWithin(PROJECT_ROOT, path) && !isWithin(PRIVATE_ROOT, path))
		return "a store inside the repository must live under private/, which Git ignores"
	return undefined
}

export function storeDestination(configured: string | undefined): string {
	if (configured !== undefined && configured.trim().length === 0)
		return failFitnessLedger("FITNESS_LEDGER_STORE cannot be empty", undefined, "InvalidPath")
	const path = resolve(configured ?? resolve(PRIVATE_ROOT, "ledger.bdb"))
	const refusal = storeRefusal(path)
	return refusal === undefined ? path : failFitnessLedger(refusal, undefined, "InvalidPath")
}

/** The store `FITNESS_LEDGER_STORE` selects (any path outside the tracked tree), default `private/ledger.bdb`. */
export const storePath = () => storeDestination(process.env.FITNESS_LEDGER_STORE)
export const DERIVED_TEXT_ROOT = privateDestination(
	PRIVATE_ROOT,
	process.env.FITNESS_LEDGER_DERIVED_TEXT,
	"generated/text"
)

/** Re-check the store path after resolving symlinks, so a link cannot smuggle it into the tracked tree. */
export async function assertStoreDestination(path: string): Promise<string> {
	const destination = await canonicalDestination(path)
	const refusal = storeRefusal(destination)
	return refusal === undefined ? destination : failFitnessLedger(refusal, undefined, "InvalidPath")
}

export async function assertPrivateDestination(path: string): Promise<string> {
	const destination = await assertContainedDestination(PRIVATE_ROOT, path)
	// A symlink into purchased originals is not a permissible output override.
	const sourceRoot = await canonicalDestination(PRIVATE_SOURCE_ROOT)
	if (isWithin(sourceRoot, destination))
		return failFitnessLedger("refusing to write into original sources", undefined, "InvalidPath")
	return destination
}
