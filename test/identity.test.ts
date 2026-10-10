import assert from "node:assert/strict"
import test from "node:test"
import { Uuid } from "@bjornpagen/bumbledb"
import { Effect } from "effect"
import { validate, version } from "uuid"
import { naturalId, observationId } from "#mechanism/identity.ts"

test("observation IDs are canonical, unique UUIDv7 values generated on each evaluation", async () => {
	const ids = await Effect.runPromise(Effect.all(Array.from({ length: 2048 }, () => observationId)))
	assert.equal(new Set(ids).size, ids.length)
	for (const id of ids) {
		assert.ok(Uuid.isUuid(id))
		assert.ok(validate(id))
		assert.equal(version(id), 7)
		assert.equal(id, id.toLowerCase())
	}
})

test("natural IDs are deterministic UUIDv8 values of their key parts", () => {
	const id = naturalId("set", "session", "d-200-lat-pulldown", "1")
	assert.equal(id, naturalId("set", "session", "d-200-lat-pulldown", "1"))
	assert.notEqual(id, naturalId("set", "session", "d-200-lat-pulldown", "2"))
	// Parts are separated, so shifting text between them is another key.
	assert.notEqual(naturalId("ab", "c"), naturalId("a", "bc"))
	assert.ok(Uuid.isUuid(id))
	assert.ok(validate(id))
	assert.equal(version(id), 8)
})
