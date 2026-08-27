# Architecture

This system separates reusable capability from contingent fitness decisions without pretending a policy-free application is possible. The boundary follows one question: which layer should own this decision?

## Layers

### Mechanism

`src/mechanism/` owns operations that remain useful when the routine, equipment, identity, and file layout change:

- exact civil dates, offset timestamps, wall-clock scheduling, and interval arithmetic;
- PDF discovery and page-aware text extraction with caller-supplied roots;
- WHOOP HTTP pagination and strict neutral response decoding;
- shared failure rendering.

This directory imports neither `src/policy/` nor `src/application/`. A test enforces that direction.

### Policy

`src/policy/` owns choices that could reasonably be replaced without rewriting the mechanisms:

- the eleven exercise identities and their intrinsic load kinds;
- days, times, ordering, sets, repetitions, cadence, effort, rest, progression, sleep, caffeine, and e-bike rules;
- exercise names, equipment descriptions, and execution instructions;
- which WHOOP sport labels map to strength or e-bike activity and which scored fields are accepted.

The location of the gym is not a policy input because the application does not need it. No address or facility identity exists in the public configuration.

### Application

`src/application/` is the intentional policy-bearing composition layer:

- `schema.ts` builds the concrete BumbleDB theory from the exercise policy;
- `database.ts` binds that theory to BumbleDB lifecycle calls;
- `queries.ts` supplies useful typed queries without hiding BumbleDB;
- `whoop.ts` applies the WHOOP trust policy and writes accepted facts;
- `report.ts` renders the prescription and observed status;
- `paths.ts` chooses the local `private/` layout;
- `cli.ts` is the small command-line front end.

`src/ledger.ts` re-exports the theory, relations, lifecycle helpers, and queries as the agent-facing surface.

## BumbleDB is the observation ledger

Real observations exist only as BumbleDB facts. Agents read with BumbleDB queries and write with typed BumbleDB transactions.

The theory contains:

- sealed value domains for load kind, exercise, adjustment kind, activity kind, measurement kind, and sex;
- one private personal profile;
- strength and e-bike activity intervals;
- selector, dumbbell, and timed-static work-set facts;
- effective-dated setup settings;
- sleep, body-weight, and waist observations;
- the narrow accepted WHOOP identity and heart-rate subset.

It contains no equipment catalog, routine, schedule, caffeine rule, e-bike recipe, research provenance, completion flag, missed-workout flag, recovery state, or proprietary score.

### Closed exercise semantics

`Exercise` is a closed relation with one sealed `loadKind` payload per exercise. Containments target payload-selected subsets:

- `SelectorWorkSet.exercise` can resolve only to selector-position exercises;
- `DumbbellWorkSet.exercise` can resolve only to dumbbell-pair exercises;
- `TscWorkSet.exercise` can resolve only to timed-static exercises.

This keeps intrinsic load shape in the theory while leaving order, set counts, progression, and technique in policy. Changing those programming choices does not reinterpret historical facts.

### Intervals and identity

Activities and sleep use exact half-open epoch-millisecond intervals plus the observed UTC offset. Setup settings use effective intervals under a pointwise key of person, exercise, adjustment kind, and validity window, so two values cannot apply to the same coordinate at one instant.

Selector resistance is an ordinal position, not pounds. Dumbbell weight is fixed-point tenths of a pound per hand. Timed-static work stores duration and pain only because the setup does not measure force.

WHOOP UUID relations provide import idempotency. Heart-rate summaries mirror an exact six-slot `[0, 6)` zone partition. Strain, recovery, energy, distance, altitude, sleep scores/stages/need/debt/efficiency, and coaching recommendations never enter the theory.

## Private distribution layer

`private/` is ignored as one portable unit. It contains the personal seed, database, purchased sources, and photographs. The seed calls `Db.create`/`Db.open` and writes `Person` directly; it has no alternate data language.

The public repository remains buildable without this directory. Restoring an authorized private zip completes the local personal system.

## Store lifecycle

BumbleDB fingerprints the complete theory and refuses to reinterpret an incompatible store. A theory change uses an explicit extract-transform-load into a fresh store; an incompatible store is never silently reinterpreted.

`pnpm check` typechecks, runs Biome with the repository GritQL rules, and executes the theory, query, WHOOP, timing, prescription, architecture, and stale-decision tests.
