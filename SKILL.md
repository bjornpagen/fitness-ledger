---
name: fitness-ledger
description: Coach and record the user's fixed strength workout set by set, and answer questions about it, through the fitness ledger's JSON ops.
---

# Fitness Ledger

```sh
node src/application/cli.ts <op> '<json>'
node src/application/cli.ts                  # every op with a one-line summary
```

`pnpm ledger <op> '<json>'` is the same command.

- One JSON object in, one JSON object out. Unknown keys refuse.
- A refusal prints `{code, message}` on stderr and exits 1. `NeedsInput` lists exactly what to ask.
- Every write prints `"outcome": "committed"`, or `"no-change"` when the same facts are already
  there. Running a write twice with the same input is safe.
- Times are ISO strings with their offset: `"2026-10-12T07:02-05:00"` (minute precision), or with
  fractional seconds (`"…07:02:13.250-05:00"`) for a genuinely precise instant. An omitted time is now,
  to the minute, at the America/Chicago offset of that instant. Use the user's stated time when they
  give one; never invent one.
- Pins, reps and seconds are numbers. A dumbbell weight is pounds in each hand, as a string: `"12.5"`.
- The ledger is `private/ledger.bdb`; `FITNESS_LEDGER_STORE` selects another path inside `private/`.

**Never write scripts.** Every read and write goes through these ops. Never ask about pain or a
setting the user did not mention: the defaults below are the user's decision.

**Start with `status`.** It shows today in America/Chicago, whether strength is scheduled, the open
session, the latest closed one, and `blockers`, such as a session left open from an earlier day.

## The workout

1. `session.start '{}'` when the user starts (`{"at": …}` if they started earlier). An open session
   is returned unchanged.
2. `next '{}'` gives the step: the exercise, its set number, the load to use (`pin`, `weight` or
   `seconds`, with the progression's `action` and `reason`), every control's `position` with its
   numbering `rule`, the bench setup, and `ask`.
3. Say it to the user: the exercise and set, the exact pin or weight, and every setting. Read out
   each control's numbering convention. If `ask` is not empty, ask exactly those questions.
4. When the user reports the set, record it. Usually only the reps:

   ```sh
   node src/application/cli.ts set.record '{"reps":8}'
   ```

   It prints `{outcome, recorded, next}`: say what was recorded, then announce `next` without
   another call.
5. Repeat until `next` says `"done": true`, then `session.end '{}'` when the user says they are done.

`next` walks `recommendedOrder`, staying on an unfinished exercise. Any order is fine: when the user
goes elsewhere, pass `{"exercise": "d-200-mid-row"}` to `next` or `set.record`. Exercise ids are in
`plan`.

## Defaults: what the user does not mention

- **Settings and bench:** the same as on the last immediate set of that exercise, which may be from an
  earlier session. Exercises sharing a machine never share positions. A value never recorded (the
  first time) is in `ask`, and `set.record` refuses `NeedsInput` until it is given.
- **Load:** the first set of an exercise uses the progression: one pin heavier, or the next recorded
  dumbbell pair, after two qualifying sessions; otherwise the last load. Later sets keep that
  session's load.
- **Pain:** `NoPain`. Record reported pain as an English anchor (`VeryMild`, `Discomforting`,
  `Tolerable`, `Distressing`, …); clarify ambiguous pain in words, never with a number.
- **Neck TSC:** 90 seconds.

Anything the user says wins and then carries forward, because it becomes the last immediate set:

```sh
node src/application/cli.ts set.record '{"reps":7,"pin":10}'
node src/application/cli.ts set.record '{"reps":8,"settings":{"d-200-seat-pad-adjuster":4}}'
node src/application/cli.ts set.record '{"reps":6,"pain":"Discomforting"}'
node src/application/cli.ts set.record '{"reps":8,"weight":"15","bench":{"name":"…","backrestAngle":80,"seatAdjustable":true,"seatMark":"2"}}'
node src/application/cli.ts set.record '{"exercise":"bench-tsc-neck-extension","seconds":75}'
```

The first time on a machine, give every control asked: `{"reps":8,"pin":9,"settings":{…}}`. A bench
set needs the bench's name, a backrest angle or mark (`backrestMark`), and whether the seat is fixed
(`"seatAdjustable": false`) or adjustable with its `seatMark`; naming another bench drops the old
bench's marks. An `Unconfirmed` control is recorded only from a number printed at the engaged
position; otherwise stop and agree a counting rule with the user, which changes the theory.

A selector pin is the plate number counted down from the top plate (1); higher is heavier. Never
record pounds for a selector, never invent a pin, position or weight.

**Re-running a set.** A bare `set.record '{"reps":8}'` always records the next set. To retry one
whose result you did not see, name it: `{"exercise": …, "set": 2, "reps": 8}` is no change when that
set is already recorded with those facts, and refuses `SetExists` when it holds others.

## Corrections

```sh
node src/application/cli.ts set.fix '{"exercise":"cl-2403-seated-leg-press","set":2,"reps":7}'
node src/application/cli.ts set.remove '{"exercise":"cl-2403-seated-leg-press","set":2}'
node src/application/cli.ts session.fix '{"start":"2026-10-12T06:58-05:00"}'
node src/application/cli.ts session.end '{"at":"2026-10-12T08:31-05:00"}'
```

`set.fix` replaces only the given fields; the rest keep their recorded values. Both act on the open
session, else the latest; pass `"session"` for another. `session.fix` corrects a start or end
(`"session"` optional likewise). An end before its start refuses `LawRefused`.

## A session recorded after the fact

When the user reports a session that was never recorded, add it with only the times they state, then
record each set exactly as reported:

```sh
node src/application/cli.ts session.add '{"start":"2026-10-08T07:01-05:00","end":"2026-10-08T08:30-05:00"}'
node src/application/cli.ts set.record '{"session":"…","exercise":"d-200-lat-pulldown","set":1,"reps":8,"pin":7,"pain":"NoPain","settings":{"d-200-seat-pad-adjuster":4}}'
```

`session.add` needs a start, an end or both and never defaults to now; an open session does not
matter, and a session with exactly those times is returned unchanged. `set.record` naming a session
that has ended is exact: nothing is defaulted, carried forward or derived. It needs `exercise`, `set`,
the load (`pin`, `weight` or `seconds`), `reps` (except a neck hold) and `pain`; only the settings and
bench facts given are recorded, and the rest stay absent. Ask rather than fill in what the user does
not remember. Re-running the same set is no change.

## Safety

Stop an exercise for sharp or escalating pain, numbness, tingling, weakness, dizziness, headache,
visual disturbance, loss of balance or position, chest pressure, faintness, or unusual
breathlessness. In a neck hold, reduce effort as soon as it approaches pain. Training guidance is not
medical clearance.

## Questions

- `plan`: the prescription, exercises in recommended order, with sets, reps, tempo, rest and controls.
- `history '{"exercise":"d-400-hamstring-curl","limit":3}'`: the last sessions' sets with settings.
- `next '{"exercise": …}'` with a session open: what that exercise would be today.

Policy, evidence and observations are separate: the prescription is `plan`; the evidence is in
`docs/program/Gym_Machine_Guide.md` and `docs/research/`; observations are only what the ledger holds.
Say so when it holds nothing relevant; never present a missing observation as known.

## Refusals

| Code | Meaning |
|---|---|
| `NeedsInput` | A value was never recorded; ask the listed questions and record again with them |
| `SetExists` | That set number holds other facts; use `set.fix` |
| `LawRefused` | The theory refused the facts (for example an end before the start) |
| `NoOpenSession` | `session.start` first |
| `StaleSession` | A session from an earlier day is still open; `session.end '{"at": …}'` it first |
| `InvalidInput` | Wrong field, value, control or exercise; the message says which |
| `NoLedger`, `StoreExists` | `db.create` makes the empty ledger once; it never replaces one |
| `LedgerSchemaMismatch` | The store was written under another theory; stop and tell the user, never recreate it |
| `LedgerBusy` | Another process holds the ledger; run the op again when it finishes |
| `StoreFull`, `QueryTooLarge` | An engine limit was reached; stop and tell the user |
| `DbError` | Any other database failure, with its tag and kind; stop and tell the user |

If the BumbleDB native addon cannot load (an unsupported platform or a missing platform package), the
command dies before any op runs with a Node stack trace naming `NativeLoadError`, not a JSON refusal.
Run `pnpm install` on a supported platform (macOS arm64, Linux arm64 or x64).

## Code work

`pnpm check` is the acceptance gate. Read `README.md` and `src/application/schema.ts` before changing code or data
semantics. Tests use synthetic data only.
