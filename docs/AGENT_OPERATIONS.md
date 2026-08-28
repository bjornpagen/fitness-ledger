# Agent Operations

This repository plus a restored `private/` directory is the complete local fitness system. BumbleDB is the only store for personal observations; do not create journals, note files, shadow JSON, CSV, SQL, or a recording DSL.

## Start every session

1. Read [START_HERE.md](../START_HERE.md) for the current prescription.
2. Read [Personal_Fitness_Operating_Manual.md](program/Personal_Fitness_Operating_Manual.md) for execution and progression.
3. Read [ARCHITECTURE.md](ARCHITECTURE.md) before changing code or data semantics.
4. Use the audits under `docs/research/` for evidence questions. If a claim needs primary-source verification, inspect the corresponding original under `private/sources/`; generated text is disposable.
5. Run `pnpm db:init`, then open `STORE_PATH` with `openFitnessDatabase` from `src/ledger.ts`.

## Answer questions

Treat three things separately:

- Policy: `prescription` and `exercisePrescriptionById` exported by `src/ledger.ts`.
- Evidence: the public audits, source catalogs, and private original sources.
- Observations: only facts currently present in BumbleDB.

Never present a missing observation as known. Never infer a selector pin, machine adjustment, repetition count, RIR, pain score, body measurement, heart rate, sleep interval, or workout time. Use `pnpm status`, the exported prepared queries, or direct typed BumbleDB reads. State clearly when the ledger has no relevant fact.

## Record observations

Translate the supplied facts directly into one typed BumbleDB transaction. The authoritative relations are exported by `src/ledger.ts`:

| Observation | Parent and subtype facts | Required supplied values |
|---|---|---|
| Strength session | `Activity` + `StrengthActivity` + `WorkSet` parents and load-specific children | actual completion instant, honest precision, UTC offset; each exercise, set order, result, and 0–10 pain rating |
| Selector set | `WorkSet` + `SelectorWorkSet` | exercise, order, repetitions, RIR, anchored pain rating, resistance position |
| Dumbbell set | `WorkSet` + `DumbbellWorkSet` | exercise, order, repetitions, RIR, anchored pain rating, tenths of a pound per hand |
| Neck TSC | `WorkSet` + `TscWorkSet` | exercise, order, actual duration, anchored pain rating |
| E-bike ride | `Activity` + `EBikeActivity` | actual completion instant, honest precision, and UTC offset |
| Sleep | `SleepInterval` | exact start/end with UTC offset and nap classification |
| Body weight | `Measurement` + `BodyWeightMeasurement` | observation instant and tenths of a pound |
| Waist | `Measurement` + `WaistMeasurement` | observation instant and tenths of an inch |
| Machine setting | `MachineSlotPosition` + `WorkSetMachineSetting` | work set, its exercise, applicable machine slot, and observed ordinal position |

An activity's `completedAt` is the actual completion event, never database commit time. A chat timestamp is usable only when the utterance itself means completion, such as “just finished.” Preserve minute precision as `completedAtPrecision: "Minute"`; use `"Millisecond"` only for a genuinely millisecond-precise event. Do not invent a start or duration.

Correct a wrong completion clock without touching its observation tree: read the exact `Activity` fact, then in one typed transaction delete that fact and insert its replacement with the same ID and corrected completion fields. BumbleDB judges the final state atomically, so the existing subtype, work sets, and settings remain attached. Read the corrected activity and its children back before reporting success.

Read the single `Person` fact to obtain the private person ID. A fresh private seed must insert that person and `PrimaryProfile { person, slot: "Primary" }` together; the theory rejects an unlinked person or a second profile. Reserve fresh activity and work-set IDs inside one transaction, then insert every `WorkSet` with exactly the child selected by its `loadKind`. `painRating` belongs to the parent and uses the closed anchors from `START_HERE.md`: `NoPain`, `VeryMild`, `Discomforting`, `Tolerable`, `Distressing`, `VeryDistressing`, `Intense`, `VeryIntense`, `UtterlyHorrible`, `ExcruciatingUnbearable`, and `UnimaginableUnspeakable`, mapped in that order to 0 through 10. Omission never means `NoPain`. If required information is absent, ask only for that information; do not fill it with a default. RIR remains a supplied nonnegative estimate, not a pain surrogate. Report BumbleDB rejections instead of bypassing the theory.

Machine slots belong to machines, and `ExerciseMachineSlot` is only an applicability whitelist. No exercise requires every applicable slot to be recorded. Insert a `MachineSlotPosition` only for a printed or otherwise defined ordinal actually supplied by the user, then attach it to the relevant set with `WorkSetMachineSetting`. A setting stated once may carry forward within the active conversational workout until changed; a change such as “seat 2” creates a new row on the later set. Never copy a historical setting into a new session, invent an irrelevant value, or turn omitted settings into facts. Resistance remains separate in `SelectorWorkSet.resistancePosition`.

Executable direct-transaction examples live in `test/schema.test.ts`; WHOOP import examples live in `test/whoop.test.ts`. These are examples of BumbleDB itself, not an alternate recording layer.

WHOOP ingestion uses `pnpm whoop:sync -- <start> <end>` with `WHOOP_ACCESS_TOKEN` supplied only in the process environment. It writes independent `WhoopWorkout` evidence and its mandatory six-zone heart-rate summary, never an `Activity`. The chatbot must disambiguate the conversational context and explicitly create `ActivityWhoopWorkout { activity, externalId, person, kind }`; one activity may link to several same-person, same-kind WHOOP fragments, while each provider UUID may link to at most one activity. Synchronization never fuzzy-matches intervals. Reimporting an identical trusted payload is a no-op; changed trusted fields under an existing UUID are conflicts, not silent updates. Sleep UUID reimports must also match exactly, and a new UUID may reuse an exact stored sleep span only when both offset and nap classification agree. Accept only the narrow fields defined in [WHOOP_Trust_Boundary.md](research/WHOOP_Trust_Boundary.md). Never let WHOOP-derived scores alter the policy.

After a write, read the inserted facts back and summarize exactly what was accepted. Do not create a commit for personal observations because the database is ignored private state.
