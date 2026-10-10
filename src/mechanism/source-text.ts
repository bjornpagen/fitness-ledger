import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdir, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises"
import { dirname, extname, relative, resolve, sep } from "node:path"
import { regex } from "arkregex"
import { Effect } from "effect"
import { FitnessLedgerFailure, failFitnessLedger } from "#mechanism/failure.ts"
import { assertContainedDestination, canonicalDestination, isWithin } from "#mechanism/paths.ts"

const PDF_SUFFIX = regex("\\.pdf$", "i")

export interface SourceTextPaths {
	readonly projectRoot: string
	readonly sourcesRoot: string
	readonly outputRoot: string
}

export interface ExtractedSourceText {
	readonly source: string
	readonly output: string | undefined
	readonly pageCount: number
	readonly characterCount: number
	readonly status: "Written" | "NoEmbeddedText"
}

function normalized(path: string): string {
	return path.split(sep).join("/")
}

async function filesUnder(path: string): Promise<readonly string[]> {
	const entries = await readdir(path, { withFileTypes: true })
	const files: string[] = []
	for (const entry of entries) {
		const child = resolve(path, entry.name)
		if (entry.isDirectory()) {
			files.push(...(await filesUnder(child)))
		} else if (entry.isFile() && extname(entry.name).toLowerCase() === ".pdf") {
			files.push(child)
		}
	}
	return files
}

async function resolveInput(paths: SourceTextPaths, path: string): Promise<readonly string[]> {
	const absolute = await realpath(resolve(paths.projectRoot, path))
	const sourcesRoot = await realpath(paths.sourcesRoot)
	if (!isWithin(sourcesRoot, absolute)) {
		return failFitnessLedger(`source input must stay under ${sourcesRoot}: ${absolute}`)
	}
	const metadata = await stat(absolute)
	if (metadata.isDirectory()) {
		return filesUnder(absolute)
	}
	if (!metadata.isFile() || extname(absolute).toLowerCase() !== ".pdf") {
		return failFitnessLedger(`source input must be a PDF or directory: ${absolute}`)
	}
	return [absolute]
}

export async function resolveSourcePdfs(paths: SourceTextPaths, inputs: readonly string[]): Promise<readonly string[]> {
	const requested = inputs.length === 0 ? [paths.sourcesRoot] : inputs
	const nested = await Promise.all(requested.map((path) => resolveInput(paths, path)))
	return [...new Set(nested.flat())].sort()
}

function runPdfToText(source: string): Promise<string> {
	return new Promise((complete, reject) => {
		execFile(
			"pdftotext",
			["-layout", "-enc", "UTF-8", source, "-"],
			{ encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 60_000 },
			(error, stdout, stderr) => {
				if (error !== null) {
					reject(
						new FitnessLedgerFailure({
							code: "ExtractionFailed",
							message: `pdftotext failed for ${source}: ${stderr.trim() || error.message}`,
							cause: error
						})
					)
					return
				}
				complete(stdout)
			}
		)
	})
}

function pagesOf(raw: string): readonly string[] {
	const pages = raw.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\f")
	// A terminal form-feed is a separator, but a genuine blank final page is still a page.
	if (pages.at(-1) === "") pages.pop()
	return pages
}

export function pageDelimitedText(raw: string): string {
	const pages = pagesOf(raw)
	return `${pages.map((page, index) => `===== PAGE ${index + 1} =====\n${page.trimEnd()}`).join("\n\n")}\n`
}

export async function extractSourceText(
	paths: SourceTextPaths,
	source: string,
	extract = runPdfToText
): Promise<ExtractedSourceText> {
	const sourcesRoot = await realpath(paths.sourcesRoot)
	const canonicalSource = await realpath(source)
	if (!isWithin(sourcesRoot, canonicalSource) || extname(canonicalSource).toLowerCase() !== ".pdf") {
		return failFitnessLedger("source must be a PDF inside the authorized source root")
	}
	const outputRoot = await canonicalDestination(paths.outputRoot)
	if (isWithin(sourcesRoot, outputRoot) || isWithin(outputRoot, sourcesRoot)) {
		return failFitnessLedger("generated text and original sources must have separate roots")
	}
	const relativePdf = relative(sourcesRoot, canonicalSource)
	const output = await assertContainedDestination(
		outputRoot,
		resolve(outputRoot, relativePdf.replace(PDF_SUFFIX, ".txt"))
	)
	const raw = await extract(canonicalSource)
	const sourcePath = normalized(relative(paths.projectRoot, canonicalSource))
	const pageCount = pagesOf(raw).length
	const characterCount = raw.replaceAll("\f", "").trim().length
	if (characterCount === 0) {
		// Generated derivatives are disposable; do not leave stale searchable text behind.
		await rm(output, { force: true })
		return { source: sourcePath, output: undefined, pageCount, characterCount, status: "NoEmbeddedText" }
	}

	await mkdir(dirname(output), { recursive: true, mode: 0o700 })
	const temporary = `${output}.pending-${randomUUID()}`
	await Effect.runPromise(
		Effect.tryPromise(async () => {
			await writeFile(temporary, pageDelimitedText(raw), { encoding: "utf8", flag: "wx", mode: 0o600 })
			await rename(temporary, output)
		}).pipe(Effect.ensuring(Effect.promise(() => rm(temporary, { force: true }))))
	)
	return {
		source: sourcePath,
		output: normalized(relative(paths.projectRoot, output)),
		pageCount,
		characterCount,
		status: "Written"
	}
}
