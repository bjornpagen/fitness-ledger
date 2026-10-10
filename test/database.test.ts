import assert from "node:assert/strict"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { ChangeSet, key, relation, schema, uuid } from "@bjornpagen/bumbledb"
import { Db } from "@bjornpagen/bumbledb/engine"
import { Effect, Option, Result, Stream } from "effect"
import { createFitnessDatabase, openFitnessDatabase, readRows } from "#application/database.ts"
import * as queries from "#application/queries.ts"
import { FitnessLedger, Session, SessionStart, SessionStartBySession } from "#application/schema.ts"
import { observationId } from "#mechanism/identity.ts"
import { apply, observed, openSession, rows, run, testDatabase } from "./helpers.ts"

const START = observed("2026-10-12T07:02:00-05:00")

test("the theory has its pinned store fingerprint", () =>
	run(
		Effect.gen(function* () {
			const database = yield* testDatabase()
			assert.equal(database.schemaId, "8fa67f3075421df555e5fb630d452a21204e7c8b7bcfbc518518cbff9f488d0f")
		})
	))

test("prepared queries retain their snapshot and close with their scope", () =>
	run(
		Effect.gen(function* () {
			const database = yield* testDatabase()
			const session = yield* openSession(database, START)
			const snapshot = yield* database.snapshot()
			const prepared = yield* snapshot.prepare(queries.sessionStarts)
			const original = { session, ...START }
			assert.deepEqual(yield* (yield* prepared.execute({})).collect(), [original])
			const corrected = { session, ...observed("2026-10-12T07:03:30.500-05:00", "Millisecond") }
			const draft = yield* ChangeSet.builder(FitnessLedger)
			yield* draft.delete(SessionStart, [original])
			yield* draft.insert(SessionStart, [corrected])
			assert.equal((yield* database.apply(yield* draft.finish(), snapshot.witness))._tag, "Committed")
			assert.deepEqual(yield* (yield* prepared.execute({})).collect(), [original])
			const fresh = yield* database.snapshot()
			const current = yield* fresh.prepare(queries.sessionStarts)
			assert.deepEqual(yield* (yield* current.execute({})).collect(), [corrected])
			const closed = yield* Effect.scoped(fresh.prepare(queries.sessionStarts))
			const expired = yield* Effect.result(closed.execute({}))
			assert.ok(Result.isFailure(expired))
			assert.equal(expired.failure.code, "ClosedHandle")
		})
	))

test("completed results deliver at most 256 rows per page and are consumed once", () =>
	run(
		Effect.gen(function* () {
			const database = yield* testDatabase()
			const snapshot = yield* database.snapshot()
			const draft = yield* ChangeSet.builder(FitnessLedger)
			for (let index = 0; index < 257; index++) yield* draft.insert(Session, [{ id: yield* observationId }])
			assert.equal((yield* database.apply(yield* draft.finish(), snapshot.witness))._tag, "Committed")
			const current = yield* database.snapshot()
			const result = yield* current.execute(queries.sessions, {})
			const collected = yield* result.collect()
			assert.equal(collected.length, 257)
			const pages = yield* Stream.runCollect(result.pages())
			assert.ok(pages.length >= 2)
			assert.ok(pages.every((page) => page.length > 0 && page.length <= 256))
			assert.deepEqual(pages.flat(), collected)
			const spent = yield* Effect.result(Stream.runCollect(result.pages()))
			assert.ok(Result.isFailure(spent))
			assert.equal(spent.failure.code, "SpentHandle")
		})
	))

test("create, close, reopen, and rejected fingerprint checks preserve the original store", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "fitness-ledger-lifecycle-"))
	t.after(() => rm(root, { recursive: true, force: true }))
	const path = join(root, "database")
	const session = await run(
		Effect.gen(function* () {
			const missing = yield* Effect.result(Db.open(path, FitnessLedger))
			assert.ok(Result.isFailure(missing))
			assert.equal((yield* Effect.promise(() => readdir(root))).includes("database"), false)
			const database = yield* Db.create(path, FitnessLedger)
			// A new store is empty and needs no initialization.
			assert.deepEqual(yield* rows(database, queries.sessions), [])
			return yield* openSession(database, START)
		})
	)
	await run(
		Effect.gen(function* () {
			const existing = yield* Effect.result(Db.create(path, FitnessLedger))
			assert.ok(Result.isFailure(existing))
			const Different = relation("Different", { id: uuid })
			const incompatible = schema("Incompatible", { Different }, [key(Different, ["id"])])
			const mismatch = yield* Effect.result(Db.open(path, incompatible))
			assert.ok(Result.isFailure(mismatch))
			assert.equal(mismatch.failure.reason._tag, "Engine")
			const database = yield* Db.open(path, FitnessLedger)
			assert.deepEqual(yield* rows(database, queries.sessions), [{ id: session }])
			assert.deepEqual(yield* rows(database, queries.openSessions), [{ id: session }])
		})
	)
})

test("public lifecycle refuses destinations outside private before creating anything", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "fitness-ledger-destination-"))
	t.after(() => rm(root, { recursive: true, force: true }))
	await run(
		Effect.gen(function* () {
			assert.ok(Result.isFailure(yield* Effect.result(createFitnessDatabase(join(root, "database")))))
			assert.ok(Result.isFailure(yield* Effect.result(openFitnessDatabase(join(root, "database")))))
		})
	)
	assert.deepEqual(await readdir(root), [])
})

test("scoped query results and snapshots fail after closure without breaking the database", () =>
	run(
		Effect.gen(function* () {
			const database = yield* testDatabase()
			yield* openSession(database, START)
			const snapshot = yield* Effect.scoped(database.snapshot())
			const expired = yield* Effect.result(readRows(snapshot, queries.sessions, {}))
			assert.ok(Result.isFailure(expired))
			assert.equal(expired.failure.code, "ClosedHandle")
			const active = yield* database.snapshot()
			const result = yield* Effect.scoped(active.execute(queries.sessions, {}))
			const closedResult = yield* Effect.result(result.collect())
			assert.ok(Result.isFailure(closedResult))
			assert.equal(closedResult.failure.code, "ClosedHandle")
			assert.equal((yield* readRows(active, queries.sessions, {})).length, 1)
		})
	))

test("a stale snapshot cannot apply a change set and the earlier read stays coherent", () =>
	run(
		Effect.gen(function* () {
			const database = yield* testDatabase()
			const session = yield* openSession(database, START)
			const stale = yield* database.snapshot()
			const other = yield* observationId
			assert.equal((yield* apply(database, (draft) => draft.insert(Session, [{ id: other }])))._tag, "Committed")
			assert.equal((yield* readRows(stale, queries.sessions, {})).length, 1)
			const draft = yield* ChangeSet.builder(FitnessLedger)
			yield* draft.delete(SessionStart, [{ session, ...START }])
			yield* draft.insert(SessionStart, [{ session, ...observed("2026-10-12T07:10:00-05:00") }])
			assert.equal((yield* database.apply(yield* draft.finish(), stale.witness))._tag, "Moved")
			const current = yield* database.snapshot()
			assert.deepEqual(Option.getOrUndefined(yield* current.get(SessionStartBySession, { session })), {
				session,
				...START
			})
			assert.equal((yield* readRows(current, queries.sessions, {})).length, 2)
		})
	))
