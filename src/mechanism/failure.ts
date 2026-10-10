import { inspect } from "node:util"
import { Data, Effect } from "effect"

/**
 * One typed boundary for rejected inputs and impossible repository states. `code` is a stable
 * machine-readable name (for example `InvalidInput` or `NeedsInput`); `message` says what to do.
 */
export class FitnessLedgerFailure extends Data.TaggedError("FitnessLedgerFailure")<{
	readonly code: string
	readonly message: string
	readonly cause?: unknown
}> {}

/** Throw from synchronous helpers; Effect programs capture it with `Effect.try`. */
export function failFitnessLedger(message: string, cause?: unknown, code = "InvalidInput"): never {
	throw new FitnessLedgerFailure({ code, message, cause })
}

/** An expected refusal as a typed Effect failure. */
export const refuse = (code: string, message: string) => Effect.fail(new FitnessLedgerFailure({ code, message }))

/** Render only at the command-line boundary; retain the structured cause everywhere else. */
export function renderUnknownFailure(error: unknown): string {
	if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
		return error.message
	}
	return inspect(error, { depth: null, breakLength: 120 })
}
