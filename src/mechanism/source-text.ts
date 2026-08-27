import { execFile } from "node:child_process"
import { mkdir, readdir, realpath, stat, writeFile } from "node:fs/promises"
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path"
import { regex } from "arkregex"
import { FitnessLedgerFailure, failFitnessLedger } from "#mechanism/failure.ts"

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

function isWithin(root: string, candidate: string): boolean {
	const child = relative(root, candidate)
	return child === "" || (!isAbsolute(child) && child !== ".." && !child.startsWith(`..${sep}`))
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
			{ encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
			(error, stdout, stderr) => {
				if (error !== null) {
					reject(
						new FitnessLedgerFailure({
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

export function pageDelimitedText(raw: string): string {
	const pages = raw.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\f")
	while (pages.length > 0 && pages.at(-1)?.trim() === "") {
		pages.pop()
	}
	return `${pages.map((page, index) => `===== PAGE ${index + 1} =====\n${page.trimEnd()}`).join("\n\n")}\n`
}

export async function extractSourceText(paths: SourceTextPaths, source: string): Promise<ExtractedSourceText> {
	const raw = await runPdfToText(source)
	const sourcePath = normalized(relative(paths.projectRoot, source))
	const pageCount = raw.split("\f").filter((page, index, pages) => index < pages.length - 1 || page.length > 0).length
	const characterCount = raw.replaceAll("\f", "").trim().length
	if (characterCount === 0) {
		return { source: sourcePath, output: undefined, pageCount, characterCount, status: "NoEmbeddedText" }
	}

	const relativePdf = relative(paths.sourcesRoot, source)
	const output = resolve(paths.outputRoot, relativePdf.replace(PDF_SUFFIX, ".txt"))
	await mkdir(dirname(output), { recursive: true })
	await writeFile(output, pageDelimitedText(raw), "utf8")
	return {
		source: sourcePath,
		output: normalized(relative(paths.projectRoot, output)),
		pageCount,
		characterCount,
		status: "Written"
	}
}
