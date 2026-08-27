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
| Strength session | `Activity` + `StrengthActivity` + work-set rows | exact start/end with UTC offset; each exercise, set order, result, and pain |
| Selector set | `SelectorWorkSet` | exercise, order, repetitions, RIR, pain, ordinal position |
| Dumbbell set | `DumbbellWorkSet` | exercise, order, repetitions, RIR, pain, tenths of a pound per hand |
| Neck TSC | `TscWorkSet` | exercise, order, actual duration, pain |
| E-bike ride | `Activity` + `EBikeActivity` | exact start/end with UTC offset |
| Sleep | `SleepInterval` | exact start/end with UTC offset and nap classification |
| Body weight | `Measurement` + `BodyWeightMeasurement` | observation instant and tenths of a pound |
| Waist | `Measurement` + `WaistMeasurement` | observation instant and tenths of an inch |
| Machine setup | `SetupSetting` | exercise, adjustment kind, observed value, non-overlapping validity interval |

Use `parseInstantSpan` and `timezoneOffsetMinutes` for timestamped activities. Read the single `Person` fact to obtain the private person ID. Reserve fresh IDs inside the same transaction and insert the parent, subtype, and child facts atomically. If required information is absent, ask only for that information; do not fill it with a default. Report BumbleDB rejections instead of bypassing the theory.

Executable direct-transaction examples live in `test/schema.test.ts`; WHOOP import examples live in `test/whoop.test.ts`. These are examples of BumbleDB itself, not an alternate recording layer.

WHOOP ingestion uses `pnpm whoop:sync -- <start> <end>` with `WHOOP_ACCESS_TOKEN` supplied only in the process environment. Accept only the narrow fields defined in [WHOOP_Trust_Boundary.md](research/WHOOP_Trust_Boundary.md). Never let WHOOP-derived scores alter the policy.

After a write, read the inserted facts back and summarize exactly what was accepted. Do not create a commit for personal observations because the database is ignored private state.
