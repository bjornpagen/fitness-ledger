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
- `database.ts` binds that theory to BumbleDB lifecycle calls and initializes the fixed machine-slot roster;
- `queries.ts` supplies useful typed queries without hiding BumbleDB;
- `whoop.ts` applies the WHOOP trust policy and writes accepted facts;
- `report.ts` renders the prescription and observed status;
- `paths.ts` chooses the local `private/` layout;
- `cli.ts` is the small command-line front end.

`src/ledger.ts` re-exports the theory, relations, lifecycle helpers, and queries as the agent-facing surface.

## BumbleDB is the observation ledger

Real observations exist only as BumbleDB facts. Agents read with BumbleDB queries and write with typed BumbleDB transactions.

The theory contains:

- sealed value domains for load kind, exercise, machine, machine slot, activity kind, completion-time precision, 0–10 pain rating, measurement kind, and sex;
- a fixed, deletion-proof exercise-to-machine-slot applicability roster;
- exactly one linked primary profile in every initialized personal store;
- strength and e-bike activity completion events;
- common work-set parents with exactly one selector, dumbbell, or timed-static child;
- typed machine-slot positions and optional per-work-set settings;
- sleep, body-weight, and waist observations;
- independent WHOOP workout evidence, explicit activity links, and the narrow accepted heart-rate subset.

It contains no facility inventory, routine, schedule, caffeine rule, e-bike recipe, research provenance, completion flag, missed-workout flag, recovery state, or proprietary score.

### Closed exercise and work-set semantics

`Exercise` is a closed relation with one sealed `loadKind` payload per exercise. Containments target payload-selected subsets:

- a `WorkSet` exercise must agree with its `loadKind`;
- every parent must have exactly one child selected by that load kind;
- a child cannot exist without the matching parent.

The parent owns activity, exercise, within-exercise order, and the closed `Pain0`–`Pain10` rating. Selector repetitions/RIR/resistance, dumbbell repetitions/RIR/weight, and timed-static duration live only on their corresponding children. This keeps intrinsic load shape in the theory while leaving exercise order, prescribed set counts, progression, and technique in policy. Pain is always supplied; absence is not encoded as zero. RIR remains an open nonnegative count.

### Activity time and machine geometry

An `Activity` has one `completedAt` event, its observed UTC offset, and an explicit `Minute` or `Millisecond` precision. It has no inferred start, duration, or policy window. Sleep retains a half-open interval because both bounds can be observations.

`MachineSlot` defines physical geometry on one machine. `ExerciseMachineSlot` is an applicability whitelist, not a completeness rule. `WorkSetMachineSetting` joins one set to an applicable slot and a known slot-position pair, keyed so a set cannot have two values for one slot. Settings may vary between sets and omitted settings remain absent. The adjustable bench is unidentified, and yoga-block placement is exercise technique rather than an invented machine slot.

Selector resistance is a separate ordinal `resistancePosition`, not geometry or pounds. Dumbbell weight is fixed-point tenths of a pound per hand. Timed-static work stores duration and the 0–10 pain rating only because the setup does not measure force.

`WhoopWorkout` retains the provider's UUID, exact interval/offset, classified kind, and person independently of conversational activities. Every accepted workout has exactly one heart-rate summary and six zone-duration facts partitioning `[0, 6)`. Import never creates or fuzzy-matches an `Activity`; `ActivityWhoopWorkout` is an explicit disambiguation carrying person and kind. One activity can collect multiple WHOOP fragments, but one provider UUID cannot support two activities, and both endpoints must agree on person and kind. Exact UUID reimports are no-ops only when every trusted field agrees; drift is an explicit conflict. Strain, recovery, energy, distance, altitude, sleep scores/stages/need/debt/efficiency, and coaching recommendations never enter the theory.

## Private distribution layer

`private/` is ignored as one portable unit. It contains the personal seed, database, purchased sources, and photographs. The seed uses the public database lifecycle and writes `Person` plus its `PrimaryProfile` link in one typed transaction; it has no alternate data language.

The public repository remains buildable without this directory. Restoring an authorized private zip completes the local personal system.

## Store lifecycle

BumbleDB fingerprints the complete theory and refuses to reinterpret an incompatible store. Fresh creation publishes a fully admitted instance containing all sealed roster facts, rather than exposing a temporarily incomplete catalog. This is a hard cutover: old stores are intentionally incompatible, and the application contains no compatibility or migration layer.

`pnpm check` typechecks, runs Biome with the repository GritQL rules, and executes the theory, query, WHOOP, timing, prescription, architecture, and stale-decision tests.
