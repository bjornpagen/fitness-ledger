import { lstat, realpath } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { Effect, Result } from "effect"
import { failFitnessLedger } from "#mechanism/failure.ts"

export function isWithin(root: string, candidate: string): boolean {
	const child = relative(root, candidate)
	return child === "" || (!isAbsolute(child) && child !== ".." && !child.startsWith(`..${sep}`))
}

/** Resolve existing symlinks even when the final destination does not exist yet. */
export async function canonicalDestination(path: string): Promise<string> {
	const absolute = resolve(path)
	const metadata = await Effect.runPromise(Effect.result(Effect.tryPromise(() => lstat(absolute))))
	if (Result.isSuccess(metadata)) return realpath(absolute)
	const cause = metadata.failure.cause
	if (typeof cause !== "object" || cause === null || !("code" in cause) || cause.code !== "ENOENT") {
		return failFitnessLedger("cannot inspect destination", cause)
	}
	const parent = dirname(absolute)
	if (parent === absolute) return failFitnessLedger("cannot resolve destination root")
	return resolve(await canonicalDestination(parent), relative(parent, absolute))
}

export async function assertContainedDestination(root: string, path: string): Promise<string> {
	const canonicalRoot = await canonicalDestination(root)
	const canonicalPath = await canonicalDestination(path)
	if (!isWithin(canonicalRoot, canonicalPath) || canonicalRoot === canonicalPath) {
		return failFitnessLedger("destination must remain strictly inside its authorized root", undefined, "InvalidPath")
	}
	return canonicalPath
}
