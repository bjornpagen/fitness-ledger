import assert from "node:assert/strict"
import test from "node:test"
import { renderPlan, renderStatus } from "#application/report.ts"
import { exercisePrescriptionById, prescription } from "#policy/prescription.ts"
import { testDatabase } from "./helpers.ts"

test("the plan renders the fixed schedule and complete eleven-exercise order", () => {
	const plan = renderPlan()
	assert.equal(plan.includes("Wake 06:30 and immediately take 200 mg caffeine"), true)
	assert.equal(
		plan.includes(
			"Strength: Monday and Thursday, start 07:00; finish after the complete prescription with no session-duration limit."
		),
		true
	)
	assert.equal(plan.includes("E-bike: Tuesday, Friday, and Saturday, start 07:00; 60 prescribed minutes."), true)
	assert.equal(
		plan.includes(
			"Each dynamic repetition uses 5 seconds for the positive phase, a smooth continuous turnaround with no deliberate pause, and 5 seconds for the negative phase."
		),
		true
	)
	assert.equal(plan.includes("2 sets × 5–8 reps — target about 2 RIR — 5s positive / 5s negative"), true)
	assert.equal(plan.includes("If the increased resistance prevents 5 clean reps"), true)
	assert.equal(plan.includes("45-degree bench timed static neck flexion — 1 set × 90s TSC"), true)
	assert.equal(plan.includes("hard but safe) — workout ends — Adjustable bench"), true)
	assert.equal(plan.includes("07:00–08:00"), false)
	assert.equal(plan.includes("2-1-2"), false)
	assert.equal(plan.includes("8–12"), false)
	assert.equal(plan.includes("50 minutes in WHOOP Zone 2"), true)
	assert.equal(plan.includes("dorsiflexion"), false)
	for (const exercise of prescription.strength.exerciseOrder) {
		const configured = exercisePrescriptionById[exercise]
		assert.equal(plan.includes(`${configured.order}. ${configured.name}`), true)
	}
})

test("exercise order is explicitly slotted one through eleven", () => {
	assert.deepEqual(
		prescription.strength.exerciseOrder.map((exercise) => [exercisePrescriptionById[exercise].order, exercise]),
		[
			[1, "cl-2403-leg-press"],
			[2, "d-200-front-lat-pulldown"],
			[3, "d-300-horizontal-chest-press"],
			[4, "d-200-chest-supported-mid-row"],
			[5, "back-supported-neutral-db-overhead-press"],
			[6, "d-400-seated-leg-curl"],
			[7, "d-600-lower-back-extension"],
			[8, "d-600-abdominal-flexion"],
			[9, "cl-2403-straight-leg-calf-press"],
			[10, "bench-tsc-neck-extension"],
			[11, "bench-tsc-neck-flexion"]
		]
	)
})

test("strength policy fixes five-second phases without imposing an end time", () => {
	assert.equal(prescription.strength.repetitionMinimum, 5)
	assert.equal(prescription.strength.repetitionMaximum, 8)
	assert.deepEqual(prescription.strength.cadence, {
		positiveSeconds: 5,
		negativeSeconds: 5,
		turnaround: "smooth-unpaused"
	})
	assert.deepEqual(prescription.strengthStarts, [
		{ day: "Monday", startMinute: 420 },
		{ day: "Thursday", startMinute: 420 }
	])
	for (const start of [...prescription.strengthStarts, ...prescription.eBikeStarts]) {
		assert.equal(Object.hasOwn(start, "endMinute"), false)
	}
})

test("status reports only stored facts", async () => {
	const database = await testDatabase("fitness-ledger-report-")
	assert.equal(
		renderStatus(database),
		`Fitness ledger status
Person: Example Person (6 ft 0 in, born 1990-04-12, Female)
Prescription: fixed forever routine (America/Chicago)
Strength activities: 0
E-bike activities: 0
Recorded work sets: 0
Sleep intervals: 0
Latest body weight: none
Latest waist: none
Effective setup settings: 0
WHOOP heart-rate summaries: 0
WHOOP workout identities: 0
WHOOP sleep identities: 0
Latest activity: none`
	)
})
