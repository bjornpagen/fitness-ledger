#!/usr/bin/env -S node

import { NodeRuntime } from "@effect/platform-node"
import { Console, Data, Effect } from "effect"
import { DERIVED_TEXT_ROOT, PRIVATE_SOURCE_ROOT, PROJECT_ROOT } from "#application/paths.ts"
import { renderUnknownFailure } from "#mechanism/failure.ts"
import { extractSourceText, resolveSourcePdfs } from "#mechanism/source-text.ts"

class ExtractionFailure extends Data.TaggedError("ExtractionFailure")<{
	readonly message: string
	readonly cause?: unknown
}> {}

const inputs = process.argv.slice(2).filter((argument) => argument !== "--")
const paths = { projectRoot: PROJECT_ROOT, sourcesRoot: PRIVATE_SOURCE_ROOT, outputRoot: DERIVED_TEXT_ROOT }

const main = Effect.gen(function* () {
	const sources = yield* Effect.tryPromise({
		try: () => resolveSourcePdfs(paths, inputs),
		catch: (cause) => new ExtractionFailure({ message: "failed to resolve source PDFs", cause })
	})
	if (sources.length === 0) {
		return yield* Effect.fail(new ExtractionFailure({ message: "no source PDFs found" }))
	}

	let written = 0
	let imageOnly = 0
	for (const source of sources) {
		const result = yield* Effect.tryPromise({
			try: () => extractSourceText(paths, source),
			catch: (cause) => new ExtractionFailure({ message: `failed to extract ${source}`, cause })
		})
		if (result.status === "Written") {
			written += 1
			yield* Console.log(`${result.source} -> ${result.output} (${result.pageCount} pages)`)
		} else {
			imageOnly += 1
			yield* Console.log(`${result.source}: no embedded text; OCR required`)
		}
	}
	yield* Console.log(`extracted ${written}; skipped ${imageOnly} image-only PDF${imageOnly === 1 ? "" : "s"}`)
})

NodeRuntime.runMain(
	Effect.catch(main, (error) =>
		Effect.gen(function* () {
			yield* Console.error(error.message)
			if (error.cause !== undefined) {
				yield* Console.error(renderUnknownFailure(error.cause))
			}
			process.exitCode = 1
		})
	)
)
