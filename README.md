# Fitness Ledger

A TypeScript and BumbleDB health system built for an AI assistant. The repository contains a fixed, source-grounded fitness policy, an embedded relational ledger for observed personal facts, and the documents needed to explain every prescribed exercise. Private identity, observations, source binaries, and database files live in a portable ignored directory.

Start with [START_HERE.md](START_HERE.md) for the complete routine, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system boundary, and [docs/AGENT_OPERATIONS.md](docs/AGENT_OPERATIONS.md) for direct AI access.

## Architecture

- `src/mechanism/` contains context-free capabilities: civil/instant time handling, PDF text extraction, error rendering, and WHOOP transport/decoding.
- `src/policy/` contains contingent choices: the exercise roster, exact prescription, and accepted WHOOP sport/field rules.
- `src/application/` composes those layers into the BumbleDB theory, reports, imports, paths, and CLI.
- `src/ledger.ts` is the direct programmatic entry point for agents.
- `private/` contains the personal seed, BumbleDB store, purchased source material, and original photographs. Git ignores the entire directory.

Mechanism never imports policy or application. Policy can change without contaminating the lower-level tools, while the application remains a coherent front end rather than a bag of primitives.

## Local use

With the private pack restored:

```sh
pnpm install
pnpm db:init
pnpm plan
pnpm status
pnpm check
```

The BumbleDB package selects its native binary from the running Node platform. The lockfile carries Darwin arm64, Linux arm64, and Linux x64 artifacts; a Linux x86-64 host loads `@bjornpagen/bumbledb-linux-x64` directly and does not require CPU emulation.

`pnpm db:init` runs the ignored, idempotent personal seed. The database is created under `private/database/`. The seed writes the person and primary-profile link atomically; re-running it confirms the existing profile and refuses to overwrite a different one.

WHOOP synchronization requires `WHOOP_ACCESS_TOKEN` in the process environment:

```sh
pnpm whoop:sync -- 2026-08-01T00:00:00-05:00 2026-09-01T00:00:00-05:00
```

Only exact provider spans/offsets, UUID identity, workout average/max heart rate, six integer zone durations, and nap classification cross that boundary. WHOOP workouts remain independent evidence until the chatbot explicitly links one or more same-person, same-kind fragments to a conversational activity. Conflicting trusted payload under an existing UUID is rejected.

## Direct agent access

An agent imports the real schema and uses BumbleDB directly as the sole observation store:

```ts
import { Db } from "@bjornpagen/bumbledb"
import { FitnessLedger, queries } from "./src/ledger.ts"

const database = await Db.open("private/database", FitnessLedger)
const prepared = database.prepare(queries.selectorWorkSets)
const sets = database.read((instance) => instance.execute(prepared, {}))
```

BumbleDB judges every direct transaction against the theory. Closed exercise payloads restrict every work-set parent to its legal selector, dumbbell, or timed-static child; work sets require strength activities and a sealed 0–10 pain rating; per-set machine settings must use applicable slots and cataloged slot-position pairs; the applicability roster cannot shrink; WHOOP workouts require the exact six-slot partition. Complete write examples live in `test/schema.test.ts`.

## Private source pack

`private/` is deliberately self-contained. Zip that directory, transfer it separately, and unzip it at the repository root after cloning. Full purchased books, scientific PDFs, manuals, photos, the personal seed, and the database remain available to a locally authorized assistant without entering public Git history.

Searchable PDF text is a disposable derivative:

```sh
pnpm sources:extract-text
```

The command reads `private/sources/` and writes one page-delimited derivative per readable PDF under `private/generated/text/`.
