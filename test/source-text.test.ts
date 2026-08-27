import assert from "node:assert/strict"
import test from "node:test"
import { pageDelimitedText } from "#mechanism/source-text.ts"

test("PDF text is normalized into one page-aware representation", () => {
	assert.equal(
		pageDelimitedText("first page\r\n\fsecond page\r\n\f"),
		"===== PAGE 1 =====\nfirst page\n\n===== PAGE 2 =====\nsecond page\n"
	)
})
