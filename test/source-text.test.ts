import assert from "node:assert/strict"
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { privateDestination } from "#application/paths.ts"
import { assertContainedDestination } from "#mechanism/paths.ts"
import { extractSourceText, pageDelimitedText, resolveSourcePdfs } from "#mechanism/source-text.ts"

test("PDF text is normalized into one page-aware representation", () => {
	assert.equal(
		pageDelimitedText("first page\r\n\fsecond page\r\n\f"),
		"===== PAGE 1 =====\nfirst page\n\n===== PAGE 2 =====\nsecond page\n"
	)
})

test("page numbering retains genuine blank pages", () => {
	assert.equal(pageDelimitedText("first\f\f"), "===== PAGE 1 =====\nfirst\n\n===== PAGE 2 =====\n\n")
	assert.equal(pageDelimitedText("first\f \f"), "===== PAGE 1 =====\nfirst\n\n===== PAGE 2 =====\n\n")
})

test("source discovery and extraction stay in authorized roots and clear stale derivatives", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "fitness-ledger-source-test-"))
	t.after(() => rm(root, { recursive: true, force: true }))
	const sourcesRoot = join(root, "sources")
	const outputRoot = join(root, "generated")
	await mkdir(join(sourcesRoot, "books"), { recursive: true })
	const pdf = join(sourcesRoot, "books", "example.PDF")
	await writeFile(pdf, "synthetic fixture; extraction is injected")
	const paths = { projectRoot: root, sourcesRoot, outputRoot }
	assert.deepEqual(await resolveSourcePdfs(paths, [sourcesRoot, pdf]), [await realpath(pdf)])
	const result = await extractSourceText(paths, pdf, async () => "first\f\f")
	assert.equal(result.pageCount, 2)
	assert.equal(result.status, "Written")
	assert.equal(await readFile(join(outputRoot, "books/example.txt"), "utf8"), pageDelimitedText("first\f\f"))
	assert.deepEqual(await readdir(join(outputRoot, "books")), ["example.txt"])
	assert.equal((await extractSourceText(paths, pdf, async () => "\f\f")).status, "NoEmbeddedText")
	assert.deepEqual(await readdir(join(outputRoot, "books")), [])
	await assert.rejects(resolveSourcePdfs(paths, [root]))
	await assert.rejects(extractSourceText({ ...paths, outputRoot: sourcesRoot }, pdf, async () => "no"))
	const outside = join(root, "outside.pdf")
	await writeFile(outside, "synthetic")
	await assert.rejects(extractSourceText(paths, outside, async () => "no"))
})

test("canonical containment refuses output symlinks escaping the private tree", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "fitness-ledger-path-test-"))
	t.after(() => rm(root, { recursive: true, force: true }))
	const privateRoot = join(root, "private")
	const publicRoot = join(root, "public")
	await mkdir(privateRoot)
	await mkdir(publicRoot)
	await symlink(publicRoot, join(privateRoot, "escape"))
	await assert.rejects(assertContainedDestination(privateRoot, join(privateRoot, "escape/file.txt")))
	assert.throws(() => privateDestination(privateRoot, publicRoot, "database"))
	assert.throws(() => privateDestination(privateRoot, "", "database"))
	assert.throws(() => privateDestination(privateRoot, privateRoot, "database"))
	assert.throws(() => privateDestination(privateRoot, join(privateRoot, "sources/books"), "generated"))
	assert.equal(
		await assertContainedDestination(privateRoot, join(privateRoot, "generated/text")),
		join(await realpath(privateRoot), "generated/text")
	)
})

test("symlinked source roots are canonicalized before constructing output paths", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "fitness-ledger-symlink-test-"))
	t.after(() => rm(root, { recursive: true, force: true }))
	await mkdir(join(root, "actual"))
	await writeFile(join(root, "actual/example.pdf"), "synthetic")
	await symlink(join(root, "actual"), join(root, "sources"))
	const paths = { projectRoot: root, sourcesRoot: join(root, "sources"), outputRoot: join(root, "generated") }
	const source = (await resolveSourcePdfs(paths, []))[0]
	assert.ok(source !== undefined)
	await extractSourceText(paths, source, async () => "text\f")
	assert.equal(await readFile(join(root, "generated/example.txt"), "utf8"), pageDelimitedText("text\f"))
})

test("real pdftotext extraction preserves a blank last page and writes a private atomic derivative", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "fitness-ledger-real-pdf-"))
	t.after(() => rm(root, { recursive: true, force: true }))
	const sourcesRoot = join(root, "sources")
	const outputRoot = join(root, "generated")
	await mkdir(sourcesRoot)
	const content = "BT /F1 12 Tf 72 720 Td (Synthetic source extraction fixture) Tj ET"
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
	]
	let pdf = "%PDF-1.4\n"
	const offsets = ["0000000000 65535 f "]
	for (const [index, object] of objects.entries()) {
		offsets.push(`${String(Buffer.byteLength(pdf)).padStart(10, "0")} 00000 n `)
		pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
	}
	const xref = Buffer.byteLength(pdf)
	pdf += `xref\n0 ${offsets.length}\n${offsets.join("\n")}\ntrailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
	const path = join(sourcesRoot, "example.pdf")
	await writeFile(path, pdf)
	const paths = { projectRoot: root, sourcesRoot, outputRoot }
	const extracted = await extractSourceText(paths, path)
	assert.equal(extracted.pageCount, 2)
	assert.equal(extracted.status, "Written")
	const textPath = join(outputRoot, "example.txt")
	const text = await readFile(textPath, "utf8")
	assert.ok(text.includes("Synthetic source extraction fixture"))
	assert.ok(text.includes("===== PAGE 2 ====="))
	assert.equal((await stat(textPath)).mode & 0o777, 0o600)
	assert.deepEqual(await readdir(outputRoot), ["example.txt"])
	const invalid = join(sourcesRoot, "invalid.pdf")
	await writeFile(invalid, "not a PDF")
	await assert.rejects(extractSourceText(paths, invalid))
	assert.deepEqual(await readdir(outputRoot), ["example.txt"])
})
