import assert from "node:assert/strict"
import test from "node:test"
import { renderPlan, renderStatus } from "#application/report.ts"
import { exercisePrescriptionById, prescription } from "#policy/prescription.ts"
import { testDatabase } from "./helpers.ts"

test("the plan renders the fixed schedule and complete eleven-exercise order", () => {
	const plan = renderPlan()
	assert.equal(plan.includes("Wake 06:30 and immediately take 200 mg caffeine"), true)
	assert.equal(plan.includes("Strength: Monday and Thursday, 07:00–08:00"), true)
	assert.equal(plan.includes("E-bike: Tuesday, Friday, and Saturday, 07:00–08:00"), true)
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
