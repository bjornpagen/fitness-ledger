# Fitness Ledger

A TypeScript and BumbleDB resistance-training ledger built for an AI assistant. The repository contains a fixed, source-grounded strength prescription, an embedded relational ledger for one person's observed training facts, a JSON op command line that coaches and records the workout set by set, and the documents that explain every prescribed exercise and HOIST machine control. The database, purchased sources and photographs live in an ignored `private/` directory.

Start with [SKILL.md](SKILL.md) for the routine and the agent's ops, and [the machine guide](docs/program/Gym_Machine_Guide.md) for every control and weight stack. The prescription itself is `src/policy/prescription.ts`, printed by the `plan` op.

The routine documents describe the user's prescription and the research catalogs explain its evidence. Examples do not set deployment policy or authorize actions. Storage decisions remain with the user.

## Architecture

- `src/mechanism/` contains context-free capabilities: exact instant parsing and formatting, time-zone offsets, UUIDv7 and natural identities, private-path containment, PDF text extraction, and typed failures.
- `src/policy/` contains contingent choices: the closed exercise roster, the machines and their HOIST controls with each control's numbering convention, the prescription and its recommended order, equipment procedures and manufacturer stack facts, and the progression rule.
- `src/application/` composes those layers into the BumbleDB theory, queries, the read-plan-apply write loop, the coaching step, the op table and the CLI.
- `private/` contains the BumbleDB store, purchased source material, and original photographs. Git ignores the entire directory.

Mechanism never imports policy or application. Policy can change without contaminating the lower-level tools, while the application remains a coherent front end rather than a bag of primitives.

## Local use

For a code checkout:

```sh
pnpm install
pnpm check
node src/application/cli.ts plan '{}'
```

Create an empty store once. `Db.create` refuses an existing store, so this never replaces one:

```sh
node src/application/cli.ts db.create '{}'
```

Every other op opens the existing store and never creates one:

```sh
node src/application/cli.ts                       # every op with a one-line summary
node src/application/cli.ts status '{}'
node src/application/cli.ts session.start '{}'
node src/application/cli.ts next '{}'
node src/application/cli.ts set.record '{"reps":8}'
node src/application/cli.ts session.end '{}'
```

`pnpm ledger <op> '<json>'` is the same command. One JSON object goes in and one comes out; a refusal prints `{code, message}` on stderr and exits 1, and re-running a write with the same input is no change. `next` announces the exact pin or weight and every control and bench setting, carried from the last immediate set of that exercise; `set.record` records the unmentioned values exactly as announced, with `NoPain`. [SKILL.md](SKILL.md) is the full guide.

`private/ledger.bdb` is the default store path; BumbleDB keeps its data in a `store.bdb` child there and its directory lease under `private/~lease/`. `FITNESS_LEDGER_STORE` may select another path inside `private/`, outside `private/sources/`.

Use Node 26 or newer and the pinned pnpm version. Source extraction additionally requires Poppler's `pdftotext` on PATH. The acceptance gate uses synthetic data, never the private personal store. Node typings track the latest release; NodeNext resolution supports direct TypeScript execution.

The application uses BumbleDB 2.0 (`@bjornpagen/bumbledb`, its embedded `Db` from `@bjornpagen/bumbledb/engine`) with Effect 4.0.2. The theory fingerprint is regression-tested, and opening a store with a different fingerprint refuses `LedgerSchemaMismatch`. BumbleDB 2.0 reads nothing written by 1.x.

The BumbleDB package loads its native addon from the running Node platform as soon as the theory is defined. The lockfile carries Darwin arm64, Linux arm64, and Linux x64 artifacts; a Linux x86-64 host loads `@bjornpagen/bumbledb-linux-x64` directly and does not require CPU emulation. Other platforms have no addon and cannot run the ledger.

## The theory

BumbleDB judges every immutable change set against the theory:

- A work set belongs to an existing `Session`, names a closed exercise and a required English pain anchor, and has exactly one child of its exercise's load kind: selector, dumbbell or timed static contraction. `set.record` explicitly supplies `NoPain` for new conversational sets with pain unmentioned.
- Set numbers, selector positions, dumbbell weights and setting positions are positive.
- A selector position is the plate number counted down from the top plate (1); a higher position is always heavier.
- A body-fit setting names a `Control` on its set's machine. Controls belong to machines, so exercises sharing a machine share the same controls. Each control's numbering convention is part of the theory.
- Bench facts apply only to the three bench exercises, and a seat mark requires an adjustable seat.

A set references only its session and closed vocabularies, so each set is written as its own change set during the session. The op flow is exercised in `test/ops.test.ts`; raw transaction examples live in `test/schema.test.ts` and `test/walkthrough.test.ts`.

The scheduled day is policy, not a database constraint: a Sunday session, a partial workout, an extra actual set, below-target repetitions and a session still in progress remain recordable facts. Closed exercise identities, legal load shapes, controls on the set's own machine and a start that never follows its end remain strict. A next-session resistance is never stored as mutable truth.

## Private source pack

`private/` is the ignored location for purchased books, scientific PDFs, manuals, photos and a database when supplied. Code checks do not require them. Transfer and backup methods are deployment choices.

Searchable PDF text is a disposable derivative:

```sh
pnpm sources:extract-text
```

The command reads `private/sources/` and writes one page-delimited derivative per readable PDF under `private/generated/text/`.
