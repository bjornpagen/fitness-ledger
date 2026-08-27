import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import { regex } from "arkregex"
import { PROJECT_ROOT } from "#application/paths.ts"

const ROOT_FILES = ["README.md", "START_HERE.md", "AGENTS.md", "docs/ARCHITECTURE.md"] as const
const ROOT_DIRECTORIES = ["docs/program", "src"] as const
const FORBIDDEN = [
	regex.as<string>("\\b12[- ]week\\b", "i"),
	regex.as<string>("\\bWorkout [AB]\\b"),
	regex.as<string>("\\bwalking\\b", "i"),
	regex.as<string>("dead bug", "i"),
	regex.as<string>("side plank", "i"),
	regex.as<string>("\\bplank\\b", "i"),
	regex.as<string>("Romanian deadlift", "i"),
	regex.as<string>("\\bRDL\\b"),
	regex.as<string>("lateral raise", "i"),
	regex.as<string>("dumbbell curl", "i"),
	regex.as<string>("neutral-grip dumbbell bench", "i"),
	regex.as<string>("08:00–09:00"),
	regex.as<string>("Both training modes use 08:00"),
	regex.as<string>("At 08:00 on"),
	regex.as<string>("startMinute: 8 \\* 60"),
	regex.as<string>('start:\\s*"[^"]*T08:00:00'),
	regex.as<string>("20:00"),
	regex.as<string>("06:35"),
	regex.as<string>("3-1-2"),
	regex.as<string>("2-1-2"),
	regex.as<string>("8[–-]12"),
	regex.as<string>("07:00[–-]08:00"),
	regex.as<string>("strengthWindows"),
	regex.as<string>("eBikeWindows"),
	regex.as<string>("endMinute"),
	regex.as<string>("session budget", "i"),
	regex.as<string>("fixed one-hour", "i"),
	regex.as<string>("180s"),
	regex.as<string>("usual caffeine", "i"),
	regex.as<string>("WarmupPlan"),
	regex.as<string>("RoutineWindow"),
	regex.as<string>("WorkoutExercise"),
	regex.as<string>("CaffeineDoseCue"),
	regex.as<string>("setSlot"),
	regex.as<string>("built-in split lat", "i"),
	regex.as<string>("no detachable attachment", "i"),
	regex.as<string>("palms-forward grip", "i"),
	regex.as<string>("4–6 inches wider", "i"),
	regex.as<string>("\\bnine[- ]exercise\\b", "i"),
	regex.as<string>("slots? 1 through 9", "i"),
	regex.as<string>("omits direct neck", "i"),
	regex.as<string>("21:45"),
	regex.as<string>("22:30"),
	regex.as<string>("dorsiflexion", "i"),
	regex.as<string>("pressure pain over the instep", "i"),
	regex.as<string>("deleted five-step sequence", "i"),
	regex.as<string>("defineEntry")
] as const

const CURRENT_RESEARCH_FILES = [
	"docs/research/Drew_Baye_Critical_Evidence_Audit.md",
	"docs/research/Exercise_Selection_Primary_Source_Audit.md"
] as const

const FORBIDDEN_CURRENT_RESEARCH = [
	regex.as<string>("\\bnine[- ]exercise\\b", "i"),
	regex.as<string>("slots? 1 through 9", "i"),
	regex.as<string>("omits direct neck", "i"),
	regex.as<string>("palms-forward grip", "i"),
	regex.as<string>("4–6 inches wider", "i"),
	regex.as<string>("\\|\\s*8\\s*\\|\\s*D-600 lower-back extension", "i"),
	regex.as<string>("\\|\\s*12\\s*\\|\\s*45° bench TSC neck flexion", "i"),
	regex.as<string>("2-1-2"),
	regex.as<string>("8[–-]12"),
	regex.as<string>("fixed one-hour", "i")
] as const

async function filesBelow(relativeDirectory: string): Promise<readonly string[]> {
	const absolute = join(PROJECT_ROOT, relativeDirectory)
	const entries = await readdir(absolute, { withFileTypes: true })
	const nested = await Promise.all(
		entries.map((entry) => {
			const relative = join(relativeDirectory, entry.name)
			return entry.isDirectory() ? filesBelow(relative) : Promise.resolve([relative])
		})
	)
	return nested.flat()
}

test("operational code and documents contain no superseded routine decisions", async () => {
	const files = [...ROOT_FILES, ...(await Promise.all(ROOT_DIRECTORIES.map(filesBelow))).flat()]
	for (const file of files) {
		const text = await readFile(join(PROJECT_ROOT, file), "utf8")
		for (const pattern of FORBIDDEN) assert.equal(pattern.test(text), false, `${file} contains stale ${pattern}`)
	}
})

test("current research conclusions contain no superseded exercise audit", async () => {
	for (const file of CURRENT_RESEARCH_FILES) {
		const text = await readFile(join(PROJECT_ROOT, file), "utf8")
		for (const pattern of FORBIDDEN_CURRENT_RESEARCH)
			assert.equal(pattern.test(text), false, `${file} contains stale ${pattern}`)
	}
})
