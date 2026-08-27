import { inspect } from "node:util"
import { Data, Effect, Result } from "effect"

/** One typed boundary for rejected inputs and impossible repository states. */
export class FitnessLedgerFailure extends Data.TaggedError("FitnessLedgerFailure")<{
	readonly message: string
	readonly cause?: unknown
}> {}

export function failFitnessLedger(message: string, cause?: unknown): never {
	throw new FitnessLedgerFailure({ message, cause })
}

/** Evaluate a synchronous parser without using an untyped try/catch escape. */
export function succeeds(operation: () => unknown): boolean {
	const result = Effect.runSync(
		Effect.result(
			Effect.try({
				try: operation,
				catch: (cause) => new FitnessLedgerFailure({ message: "validation rejected the value", cause })
			})
		)
	)
	return Result.isSuccess(result)
}

/** Render only at the command-line boundary; retain the structured cause everywhere else. */
export function renderUnknownFailure(error: unknown): string {
	if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
		return error.message
	}
	return inspect(error, { depth: null, breakLength: 120 })
}
