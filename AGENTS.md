# Repository rules

These instructions apply to work in this repository. The fitness prescription records the user's choices; mechanism code and documentation do not choose deployment policy. Host setup and backups follow the user's current instructions. Examples do not authorize operations or create additional approval requirements.

## Repository and code

- `pnpm check` is the acceptance gate.
- Read `SKILL.md` before answering personal questions or writing observations.
- Never track anything under `private/`. It contains observations, database state, purchased sources, and photographs.
- Never put a personal value in the public tree or Git history: no name, height, sex, birth date, residence, facility identity, precise coordinate, purchaser watermark, access token, or real observation value from the user's ledger (for example an actual selector position, control position, repetition count, weight, time or bench label). Tests and examples use synthetic data only.
- TypeScript is the only implementation and scripting language. Do not add CSV databases, SQL, or an alternate entry DSL.
- `src/mechanism/` must not import `src/policy/` or `src/application/`.
- `src/policy/` owns the prescription and its recommended exercise order, the exercise roster, machines, controls and their numbering conventions, execution instructions, the schedule, equipment notes and the progression rule.
- `src/application/schema.ts` is the authoritative BumbleDB theory. Its fingerprint is regression-tested, and opening a store with a different fingerprint fails.
- Use the pinned BumbleDB 2.0 package, `@bjornpagen/bumbledb`, through its embedded engine: `Db.create`/`Db.open` from `@bjornpagen/bumbledb/engine`, exactly one `Bumble.layer`, snapshots, `ChangeSet.builder`, and `judge`/`apply` with the snapshot's witness. The hosted `Database`, migrations and the `bumbledb` CLI are not used.
- BumbleDB is the only store for real personal observations. Write facts with typed transactions; do not add a second observation representation.
- The ledger is `private/ledger.bdb`. `FITNESS_LEDGER_STORE` may select another path inside `private/`, outside `private/sources/`.
- Agents read and write observations only through the domain op CLI, `node src/application/cli.ts <op> '<json>'`, as `SKILL.md` describes. Do not write ad hoc ledger scripts, and do not add a generic database CLI.
- Full source binaries live in `private/sources/`. Public `sources/` contains only catalogs and canonical references. Rebuild searchable derivatives with `pnpm sources:extract-text`.
- Do not add hidden files or hidden directories beyond existing Git/package-manager infrastructure.
- Run on Node 26 or newer with the pinned Effect 4.0.2. Use Effect programs and `NodeRuntime.runMain` at executable boundaries.
- Do not configure or push to a remote without the user's explicit remote and branch authorization.

## Scope and routine

- The ledger records resistance training: sessions, work sets, machine settings and bench facts. The store belongs to one person, so no relation carries a person.
- Keep the fixed America/Chicago routine intact: strength starts at 07:00 on Monday and Thursday, with no session-duration limit.
- Keep the eleven-exercise workout, dynamic sets/repetitions, 5/5 cadence, 120-second rest, 30/30/30 neck TSC protocol at 45 degrees, and derived load-progression rule intact.
- Keep the fixed 11-exercise prescription free of general warm-ups, cardio warm-ups, and ramp-set subsystems.
- The recommended exercise order lives only in `prescription.strength.recommendedOrder`. It is a suggestion, never a constraint. The closed `Exercise` roster order is part of the theory fingerprint and is not a training order. Exercise order, set count and progression stay policy, never database state.

## Recording

- Store reality, not projections: no completed/missed flags, calendar-driven progression, or stored next-session resistance. A next-session resistance is computed from actual sets and policy.
- Record a session's actual date, time, and offset even when it differs from policy. The schedule never constrains admission; the closed exercise roster, controls on the set's own machine and session boundary order do.
- A `Session` has an optional `SessionStart` and an optional `SessionEnd`. In a live session, `session.start` when the user starts, `set.record` each set as its own change set as it happens, and `session.end` when the user says they are done. An omitted time is now, to the minute, at the America/Chicago offset of that instant; a stated time is used as stated. Never invent a start or end time. The database rejects a start that follows its end.
- Session ids are `observationId` values (UUIDv7). Work-set ids are natural ids, `naturalId("set", session, exercise, setNumber)`, so re-recording the same facts is no change and other facts under an existing set number refuse.
- Recorded facts are trusted. Each work set is one self-contained change set that references only an existing session and closed vocabularies; selector positions, control positions, dumbbell weights and bench labels are recorded inline on the set.
- Machine parts use HOIST's names, as listed in `src/policy/equipment.ts` and `docs/program/Gym_Machine_Guide.md`. Controls are properties of machines, not exercises: a set may record any control on its exercise's machine (`controlsFor(exercise)`), so exercises on one machine share the same controls.
- Every control's numbering convention lives in the theory: `Control.numbering` names it, and `numberingRules` in `src/policy/exercises.ts` states it in full. When recording a control, read its convention out to the user.
- An `Unconfirmed` control is never guessed. Record a number only if one is printed at the engaged position; otherwise stop, agree a counting rule with the user, and add that convention to the theory before recording a value for it.
- A selector position (`SelectorWorkSet.resistancePosition`) is the plate number counted down from the top plate, which is 1. A higher position is always heavier. Never store selector resistance as pounds.
- Never invent selector positions, control positions, dumbbell weights, bench labels or bench marks. Work-set settings are observed body-fit coordinates.
- New conversational sets with pain unmentioned explicitly store `NoPain`; clarify ambiguous reported pain using English anchors. Never default missing historical pain.
- Resolve every control on the exercise's machine during live recording. An unmentioned setting or bench fact is the one on the last immediate set of the same exercise, even when that set is from an earlier session; it is written explicitly on each set. A value never recorded is asked, never guessed. An explicit change wins and carries forward from then on. The bench label and bench settings are supplied private facts.
- An unmentioned load is the one the progression rule derives for an exercise's first set (otherwise the last immediate set's), and the same load for its later sets in that session. An unmentioned neck TSC duration is 90 seconds.
- A session recorded after the fact is `session.add` with only its stated start, end or both; nothing defaults to now. `set.record` naming an ended session is exact mode: nothing is defaulted, carried forward or derived from progression; exercise, set number, load, repetitions (for dynamic exercises) and pain are required, and only the settings and bench facts given are written. The live defaults above apply only to live recording.
