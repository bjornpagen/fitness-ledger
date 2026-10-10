import assert from "node:assert/strict"
import test from "node:test"
import { EXERCISE_IDS } from "#policy/exercises.ts"
import { exercisePrescriptionById, prescription } from "#policy/prescription.ts"
import { foreignLedger, ledger } from "./ops.ts"

const LEG_PRESS = "cl-2403-seated-leg-press"
const PULLDOWN = "d-200-lat-pulldown"
const PRESS = "back-supported-neutral-db-overhead-press"
const LEG_SETUP = { "cl-2403-back-adjuster": 2, "cl-2403-seat-slide-adjuster": 5 }
const BENCH = { name: "Synthetic bench A", backrestAngle: 80, seatAdjustable: true, seatMark: "A" }
const RECOMMENDED = [
	"cl-2403-seated-leg-press",
	"d-200-lat-pulldown",
	"d-300-chest-press",
	"d-200-mid-row",
	"back-supported-neutral-db-overhead-press",
	"d-400-hamstring-curl",
	"d-600-lower-back",
	"d-600-abdominals",
	"cl-2403-calf-press",
	"bench-tsc-neck-extension",
	"bench-tsc-neck-flexion"
] as const

const fields = (step: { ask: { field: string }[] }) => step.ask.map((ask) => ask.field)
const positions = (step: { settings: { position: number | null }[] }) =>
	step.settings.map((setting) => setting.position)

test("a live session walks the prescription, carrying setup and load from the last immediate set", async () => {
	const l = await ledger("2026-10-12T07:02:00-05:00")
	const before = await l.op("status")
	assert.deepEqual(before, {
		today: { date: "2026-10-12", weekday: "Monday", time: "2026-10-12T07:02-05:00" },
		strengthToday: true,
		strengthStart: "07:00",
		open: [],
		latest: null,
		blockers: []
	})

	const started = await l.op("session.start")
	assert.equal(started.outcome, "committed")
	assert.equal(started.start, "2026-10-12T07:02-05:00")
	assert.deepEqual(await l.op("session.start"), { ...started, outcome: "no-change" })
	const session = started.session

	// The very first time, nothing is known: the pin and every control are asked.
	const first = await l.op("next")
	assert.equal(first.exercise.id, LEG_PRESS)
	assert.equal(first.set, 1)
	assert.equal(first.load.action, "establish")
	assert.equal(first.load.pin, undefined)
	assert.deepEqual(first.stack, {
		machine: "cl-2403",
		positions: 21,
		plates: "41 lb top plate + 20 × 20 lb plates",
		decals: "plate decals 1–21 from the top"
	})
	assert.deepEqual(fields(first), ["pin", "settings.cl-2403-back-adjuster", "settings.cl-2403-seat-slide-adjuster"])
	assert.ok(first.ask[2].question.includes("is a number printed"), "an Unconfirmed control asks about printed numbers")
	assert.deepEqual(
		first.settings.map((setting: { numbering: string }) => setting.numbering),
		["CountFromMostUpright", "Unconfirmed"]
	)
	const needs = await l.refused("set.record", { reps: 8 })
	assert.equal(needs.code, "NeedsInput")
	for (const field of ["pin:", "settings.cl-2403-back-adjuster:", "settings.cl-2403-seat-slide-adjuster:"])
		assert.ok(needs.message.includes(field), field)

	const one = await l.op("set.record", { reps: 8, pin: 9, settings: LEG_SETUP })
	assert.equal(one.outcome, "committed")
	assert.deepEqual(one.recorded, {
		session,
		exercise: LEG_PRESS,
		set: 1,
		reps: 8,
		pin: 9,
		pain: "NoPain",
		settings: LEG_SETUP
	})
	// The next step stays on the unfinished exercise at the same pin and setup.
	assert.equal(one.next.exercise.id, LEG_PRESS)
	assert.equal(one.next.set, 2)
	assert.deepEqual(one.next.load, {
		pin: 9,
		action: "same",
		reason: "Same load as set 1: the load stays constant across an exercise's sets."
	})
	assert.deepEqual(positions(one.next), [2, 5])
	assert.equal(one.next.settings[0].from, "set 1 this session")
	assert.deepEqual(one.next.ask, [])

	// Only the reps: NoPain, the announced pin and set number, every setting carried.
	const two = await l.op("set.record", { reps: 7 })
	assert.deepEqual(two.recorded, { ...one.recorded, set: 2, reps: 7 })
	assert.equal(two.next.exercise.id, PULLDOWN)

	// Re-running a write with the same facts is no change; other facts under that number refuse.
	assert.deepEqual(await l.op("set.record", { exercise: LEG_PRESS, set: 2, reps: 7 }), { ...two, outcome: "no-change" })
	const again = await l.op("set.record", { exercise: LEG_PRESS, set: 1, reps: 8, pin: 9, settings: LEG_SETUP })
	assert.equal(again.outcome, "no-change")
	assert.equal((await l.refused("set.record", { exercise: LEG_PRESS, set: 2, reps: 6 })).code, "SetExists")
	assert.equal((await l.refused("set.record", { exercise: LEG_PRESS, set: 1, pain: "Tolerable" })).code, "SetExists")

	// An override wins and then carries forward; the rest still carry.
	const pulldown = {
		"d-200-seat-pad-adjuster": 3,
		"d-200-thigh-pad-adjuster": 2,
		"d-200-horizontal-chest-pad-adjuster": 4
	}
	const pd1 = await l.op("set.record", { reps: 8, pin: 5, pain: "VeryMild", settings: pulldown })
	assert.equal(pd1.recorded.pain, "VeryMild")
	assert.deepEqual(positions(pd1.next), [3, 2, 4])
	const pd2 = await l.op("set.record", { reps: 8, settings: { "d-200-seat-pad-adjuster": 4 } })
	assert.deepEqual(pd2.recorded.settings, { ...pulldown, "d-200-seat-pad-adjuster": 4 })
	assert.equal(pd2.recorded.pin, 5)
	assert.equal(pd2.recorded.pain, "NoPain")

	// The mid-row shares the D-200's controls but never borrows the pulldown's positions.
	const row = await l.op("next", { exercise: "d-200-mid-row" })
	assert.deepEqual(positions(row), [null, null, null])
	assert.equal(row.remaining.includes("d-200-mid-row"), false)
	const foreign = await l.refused("set.record", {
		exercise: "d-200-mid-row",
		reps: 8,
		pin: 5,
		settings: { "d-300-seat-pad-adjuster": 3 }
	})
	assert.equal(foreign.code, "InvalidInput")
	assert.ok(foreign.message.includes("d-200-horizontal-chest-pad-adjuster"))
	const beyond = await l.refused("set.record", {
		exercise: "d-300-chest-press",
		reps: 8,
		pin: 17,
		settings: { "d-300-seat-pad-adjuster": 3, "d-300-back-pad-adjuster": 2 }
	})
	assert.equal(beyond.code, "InvalidInput")
	assert.ok(beyond.message.includes("16-position d-300 stack"))

	// Dumbbells: a per-hand pound string, and bench facts carried like machine settings.
	const pressStep = await l.op("next", { exercise: PRESS })
	assert.deepEqual(fields(pressStep), ["weight", "bench.name", "bench.backrestAngle", "bench.seatAdjustable"])
	assert.equal((await l.refused("set.record", { exercise: PRESS, reps: 8, pin: 3 })).code, "InvalidInput")
	const p1 = await l.op("set.record", { exercise: PRESS, reps: 8, weight: "12.5", bench: BENCH })
	assert.equal(p1.recorded.weight, "12.5")
	assert.deepEqual(p1.recorded.bench, BENCH)
	assert.equal(p1.next.exercise.id, PRESS)
	assert.equal(p1.next.load.weight, "12.5")
	assert.deepEqual(p1.next.bench, { ...BENCH, from: "set 1 this session" })
	const p2 = await l.op("set.record", { reps: 7 })
	assert.deepEqual(p2.recorded, { ...p1.recorded, set: 2, reps: 7 })

	// Neck TSC: an unmentioned duration is the prescribed 90 seconds.
	const neck = await l.op("set.record", {
		exercise: "bench-tsc-neck-extension",
		bench: { name: "Synthetic bench A", backrestAngle: 45, seatAdjustable: false }
	})
	assert.equal(neck.recorded.seconds, 90)
	assert.equal(neck.recorded.pain, "NoPain")
	assert.equal((await l.refused("set.record", { exercise: "bench-tsc-neck-flexion", reps: 8 })).code, "InvalidInput")

	// The theory refuses an end before the start; the real end is recorded once.
	assert.equal((await l.refused("session.end", { at: "2026-10-12T06:30-05:00" })).code, "LawRefused")
	const ended = await l.at("2026-10-12T08:31:00-05:00").op("session.end")
	assert.deepEqual(ended, {
		outcome: "committed",
		session,
		start: "2026-10-12T07:02-05:00",
		end: "2026-10-12T08:31-05:00",
		sets: 7
	})
	assert.deepEqual(await l.op("session.end"), { ...ended, outcome: "no-change" })

	// Thursday: the setup comes from the last immediate set, in the earlier session; the pin holds.
	const thursday = await l.at("2026-10-15T07:05:00-05:00").op("session.start")
	const legs = await l.op("next")
	assert.equal(legs.exercise.id, LEG_PRESS)
	assert.equal(legs.load.pin, 9)
	assert.equal(legs.load.action, "hold")
	assert.deepEqual(positions(legs), [2, 5])
	assert.equal(legs.settings[0].from, "set 2 of the session started 2026-10-12T07:02-05:00")
	assert.deepEqual(fields(legs), [])
	const recorded = await l.op("set.record", { reps: 8 })
	assert.deepEqual(recorded.recorded, { ...one.recorded, session: thursday.session })
	const pd = await l.op("next", { exercise: PULLDOWN })
	assert.deepEqual(positions(pd), [4, 2, 4])
	assert.equal(pd.load.pin, 5)
	const pressAgain = await l.op("next", { exercise: PRESS })
	assert.deepEqual(pressAgain.bench, { ...BENCH, from: "set 2 of the session started 2026-10-12T07:02-05:00" })

	const status = await l.op("status")
	assert.equal(status.today.weekday, "Thursday")
	assert.equal(status.strengthToday, true)
	assert.deepEqual(status.open, [{ session: thursday.session, start: "2026-10-15T07:05-05:00", end: null, sets: 1 }])
	assert.deepEqual(status.latest, { session, start: "2026-10-12T07:02-05:00", end: "2026-10-12T08:31-05:00", sets: 7 })
	assert.deepEqual(status.blockers, [])
})

test("progression announces one pin heavier after two qualifying sessions and stops at the top of the stack", async () => {
	const l = await ledger("2026-10-05T07:00:00-05:00")
	const exercise = "d-600-lower-back"
	const session = async (day: string, payload: object) => {
		await l.at(`${day}T07:00:00-05:00`).op("session.start")
		const step = await l.op("next", { exercise })
		await l.op("set.record", { exercise, ...payload })
		await l.at(`${day}T08:00:00-05:00`).op("session.end")
		return step.load
	}
	const setup = { "d-600-range-of-motion": 3, "d-600-foot-rest": 4 }
	assert.equal((await session("2026-10-05", { reps: 8, pin: 15, settings: setup })).action, "establish")
	assert.deepEqual(
		[await session("2026-10-08", { reps: 9 })].map((load) => [load.pin, load.action]),
		[[15, "hold"]]
	)
	const increase = await session("2026-10-12", { reps: 8 })
	assert.deepEqual([increase.pin, increase.action], [16, "increase"])
	const hold = await session("2026-10-15", { reps: 8 })
	assert.deepEqual([hold.pin, hold.action], [16, "hold"])
	const top = await session("2026-10-19", { reps: 8 })
	assert.deepEqual([top.pin, top.action], [16, "top-of-stack"])
	assert.ok(top.reason.includes("position 16 is the heaviest"))

	const history = await l.op("history", { exercise, limit: 5 })
	assert.deepEqual(
		history.sessions.map((entry: { at: string; sets: { pin: number; settings: object }[] }) => [
			entry.at,
			entry.sets.map((set) => set.pin)
		]),
		[
			["2026-10-19T07:00-05:00", [16]],
			["2026-10-15T07:00-05:00", [16]],
			["2026-10-12T07:00-05:00", [16]],
			["2026-10-08T07:00-05:00", [15]],
			["2026-10-05T07:00-05:00", [15]]
		]
	)
	assert.deepEqual(history.sessions[0].sets[0].settings, setup)
})

test("corrections replace or remove one set and one boundary, and re-run as no change", async () => {
	const l = await ledger("2026-10-12T07:02:00-05:00")
	const { session } = await l.op("session.start")
	await l.op("set.record", { reps: 8, pin: 9, settings: LEG_SETUP })

	const fixed = await l.op("set.fix", { exercise: LEG_PRESS, set: 1, reps: 7, pain: "Discomforting" })
	assert.equal(fixed.outcome, "committed")
	assert.deepEqual(fixed.recorded, {
		session,
		exercise: LEG_PRESS,
		set: 1,
		reps: 7,
		pin: 9,
		pain: "Discomforting",
		settings: LEG_SETUP
	})
	assert.equal((await l.op("set.fix", { exercise: LEG_PRESS, set: 1, reps: 7 })).outcome, "no-change")
	const moved = await l.op("set.fix", { exercise: LEG_PRESS, set: 1, settings: { "cl-2403-back-adjuster": 3 } })
	assert.deepEqual(moved.recorded.settings, { ...LEG_SETUP, "cl-2403-back-adjuster": 3 })
	assert.equal((await l.refused("set.fix", { exercise: LEG_PRESS, set: 2, reps: 7 })).code, "SetMissing")

	const removed = await l.op("set.remove", { exercise: LEG_PRESS, set: 1 })
	assert.equal(removed.outcome, "committed")
	assert.equal(removed.removed.reps, 7)
	assert.deepEqual(await l.op("set.remove", { exercise: LEG_PRESS, set: 1 }), {
		outcome: "no-change",
		removed: null,
		next: removed.next
	})
	assert.deepEqual(fields(removed.next), [
		"pin",
		"settings.cl-2403-back-adjuster",
		"settings.cl-2403-seat-slide-adjuster"
	])

	const corrected = await l.op("session.fix", { start: "2026-10-12T06:58-05:00" })
	assert.deepEqual(corrected, { outcome: "committed", session, start: "2026-10-12T06:58-05:00", end: null, sets: 0 })
	assert.equal((await l.op("session.fix", { start: "2026-10-12T06:58-05:00" })).outcome, "no-change")
	assert.equal((await l.refused("session.fix", {})).code, "InvalidInput")
	assert.equal((await l.refused("session.fix", { end: "2026-10-12T06:00-05:00" })).code, "LawRefused")
	const precise = await l.op("session.fix", { session, end: "2026-10-12T08:30:15.250-05:00" })
	assert.equal(precise.end, "2026-10-12T08:30:15.250-05:00")
	assert.deepEqual((await l.op("status")).open, [])
})

test("a forgotten session is added from stated boundaries and its sets are recorded exactly as given", async () => {
	const l = await ledger("2026-10-12T07:02:00-05:00")
	assert.equal((await l.refused("session.add", {})).code, "InvalidInput")
	const added = await l.op("session.add", { end: "2026-10-08T08:40-05:00" })
	const session = added.session
	assert.deepEqual(added, { outcome: "committed", session, start: null, end: "2026-10-08T08:40-05:00", sets: 0 })
	assert.deepEqual(await l.op("session.add", { end: "2026-10-08T08:40-05:00" }), { ...added, outcome: "no-change" })
	const backwards = { start: "2026-10-09T09:00-05:00", end: "2026-10-09T08:00-05:00" }
	assert.equal((await l.refused("session.add", backwards)).code, "LawRefused")
	// An open session does not stop a backfill.
	await l.op("session.start")
	const both = await l.op("session.add", { start: "2026-10-05T07:01-05:00", end: "2026-10-05T08:20-05:00" })
	assert.deepEqual(both, {
		outcome: "committed",
		session: both.session,
		start: "2026-10-05T07:01-05:00",
		end: "2026-10-05T08:20-05:00",
		sets: 0
	})

	// Naming an ended session records exactly what is given: omitted settings stay absent.
	const exact = { session, exercise: LEG_PRESS, set: 1, reps: 8, pin: 9, pain: "VeryMild" }
	const recorded = await l.op("set.record", exact)
	assert.equal(recorded.outcome, "committed")
	assert.deepEqual(recorded.recorded, { ...exact, settings: {} })
	assert.equal((await l.op("set.record", exact)).outcome, "no-change")
	assert.equal((await l.refused("set.record", { ...exact, reps: 7 })).code, "SetExists")
	const second = { session, exercise: LEG_PRESS, set: 2, reps: 8, pin: 9, pain: "NoPain" }
	for (const field of ["pain", "reps", "pin", "set", "exercise"] as const) {
		const { [field]: _omitted, ...rest } = second
		const refusal = await l.refused("set.record", rest)
		assert.equal(refusal.code, "InvalidInput", field)
		assert.ok(refusal.message.includes(field), field)
	}
	const set = await l.op("set.record", { ...second, settings: { "cl-2403-back-adjuster": 1 } })
	assert.deepEqual(set.recorded.settings, { "cl-2403-back-adjuster": 1 })
	const neck = {
		session,
		exercise: "bench-tsc-neck-flexion",
		set: 1,
		seconds: 80,
		pain: "NoPain",
		bench: { name: "Synthetic bench A", backrestAngle: 45, backrestMark: "45" }
	}
	assert.deepEqual((await l.op("set.record", neck)).recorded, { ...neck, settings: {} })
	assert.equal((await l.op("history", { exercise: LEG_PRESS, limit: 5 })).sessions[0].sets.length, 2)

	// The live session is unchanged: it carries the backfilled set and still asks what was never recorded.
	const next = await l.op("next")
	assert.equal(next.exercise.id, LEG_PRESS)
	assert.equal(next.load.pin, 9)
	assert.deepEqual(positions(next), [1, null])
	assert.equal((await l.refused("set.record", { reps: 8 })).code, "NeedsInput")
})

test("refusals carry a code: unknown keys and ops, missing sessions, stale sessions and existing stores", async () => {
	const l = await ledger("2026-10-12T07:02:00-05:00")
	const unknown = await l.refused("set.record", { reps: 8, bogus: 1 })
	assert.equal(unknown.code, "InvalidInput")
	assert.ok(unknown.message.includes("bogus"))
	assert.equal((await l.refused("next", { exercise: "d-200-unknown" })).code, "InvalidInput")
	assert.equal((await l.refused("no.such.op")).code, "UnknownOp")
	assert.equal((await l.refused("next")).code, "NoOpenSession")
	assert.equal((await l.refused("set.record", { reps: 8 })).code, "NoOpenSession")
	assert.equal((await l.refused("session.end")).code, "NoOpenSession")
	assert.equal((await l.refused("db.create")).code, "StoreExists")
	assert.equal((await l.refused("session.start", { at: "2026-10-12T07:00" })).code, "InvalidInput")

	await l.op("session.start")
	const tomorrow = await l.at("2026-10-13T07:00:00-05:00").op("status")
	assert.equal(tomorrow.strengthToday, false)
	assert.equal(tomorrow.blockers.length, 1)
	assert.ok(tomorrow.blockers[0].includes("is still open"))
	assert.equal((await l.refused("session.start")).code, "StaleSession")

	// A store written under another theory is named, not opened.
	const foreign = await foreignLedger()
	assert.equal((await foreign.refused("status")).code, "LedgerSchemaMismatch")

	// "Now" takes the America/Chicago offset at that instant.
	const winter = await ledger("2026-11-02T13:00:00Z")
	assert.equal((await winter.op("session.start")).start, "2026-11-02T07:00-06:00")
	assert.equal((await winter.op("status")).today.weekday, "Monday")
})

test("plan lists the prescription in recommended order, a suggestion over the whole roster", async () => {
	const l = await ledger()
	const plan = await l.op("plan")
	assert.equal(plan.timeZone, "America/Chicago")
	assert.deepEqual(plan.strengthStarts, [
		{ day: "Monday", start: "07:00" },
		{ day: "Thursday", start: "07:00" }
	])
	assert.equal(plan.restSeconds, 120)
	assert.deepEqual(
		plan.exercises.map((exercise: { id: string }) => exercise.id),
		RECOMMENDED
	)
	assert.deepEqual(plan.exercises[0], {
		id: LEG_PRESS,
		name: "CL-2403 Seated Leg Press",
		equipment: "HOIST CL-2403 Seated Leg Press",
		technique: exercisePrescriptionById[LEG_PRESS].technique,
		sets: 2,
		reps: "5–8",
		tempo: "5 s up, 5 s down, smooth turnaround",
		restSeconds: 120,
		loadKind: "SelectorPosition",
		usesBench: false,
		controls: [
			{ control: "cl-2403-back-adjuster", label: "Back Adjuster (back pad angle)" },
			{ control: "cl-2403-seat-slide-adjuster", label: "Seat Slide Adjuster" }
		]
	})
	assert.equal(plan.exercises[10].protocol, "30 s moderate, 30 s near-maximal, 30 s hard but safe")
	assert.ok(plan.progression.includes("top of the stack"))
	assert.ok(plan.equipment.retention.includes("servicing issue"))

	// The suggestion is its own permutation, not the roster whose order belongs to the fingerprint.
	assert.deepEqual(prescription.strength.recommendedOrder, RECOMMENDED)
	assert.deepEqual(prescription.strength.recommendedOrder.toSorted(), EXERCISE_IDS.toSorted())
	assert.notEqual(prescription.strength.recommendedOrder, EXERCISE_IDS)
	assert.deepEqual(prescription.strengthStarts, [
		{ day: "Monday", startMinute: 420 },
		{ day: "Thursday", startMinute: 420 }
	])
	assert.equal(prescription.strength.repetitionMinimum, 5)
	assert.equal(prescription.strength.repetitionMaximum, 8)
	assert.equal(prescription.strength.promotionExposures, 2)
	assert.deepEqual(prescription.strength.tsc, { stageSeconds: 30, totalSeconds: 90 })
	assert.deepEqual(prescription.strength.cadence, {
		positiveSeconds: 5,
		negativeSeconds: 5,
		turnaround: "smooth-unpaused"
	})
	assert.deepEqual(Object.keys(prescription).toSorted(), ["strength", "strengthStarts", "timeZone"])
	assert.ok(exercisePrescriptionById[PULLDOWN].technique.includes("long lat bar"))
	assert.ok(exercisePrescriptionById[PULLDOWN].technique.includes("palms-toward-you grip just inside"))
	assert.ok(exercisePrescriptionById["d-300-chest-press"].technique.includes("horizontal handle grip"))
	assert.ok(exercisePrescriptionById["d-200-mid-row"].technique.includes("chest on the pad"))
})
