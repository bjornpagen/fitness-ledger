# Start Here: The Forever Routine

**Time zone:** America/Chicago

**Goal:** one simple, repeatable full-body strength and aerobic routine for the foreseeable future

## Fixed schedule

| Day | Training |
|---|---|
| Monday | Strength starts at 07:00 |
| Tuesday | E-bike starts at 07:00 |
| Wednesday | No training |
| Thursday | Strength starts at 07:00 |
| Friday | E-bike starts at 07:00 |
| Saturday | E-bike starts at 07:00 |
| Sunday | No training |

Every day:

- 06:30: wake and immediately take one 200 mg caffeine pill.
- 14:30: caffeine cutoff.
- 21:15: wind down.
- 22:00: lights out.

In WHOOP, open **Tonight's Sleep**, choose **Improve My Sleep**, set **Wake-Up Time** to **06:30**, turn the alarm on, choose **Exact Time**, and make it recur every day. WHOOP's suggested bedtime and derived sleep/recovery targets do not alter the fixed 21:15 wind-down or 22:00 lights-out times.

There is no training-day substitution, A/B rotation, phase, or program end date. After an absence, resume on the next scheduled day.

07:00 is only a start time. On Monday and Thursday, complete the entire fixed workout and every prescribed rest without rushing, shortening, or skipping work to finish by a particular time. The e-bike session lasts 60 minutes because its three prescribed segments total 60 minutes.

## Strength workout

Begin directly with the prescribed work sets. There is no EFX preparation, general warm-up, or separate ramp-set sequence.

| Mandatory order | Exercise | Work sets |
|---:|---|---:|
| 1 | HOIST CL-2403 leg press | 2 × 5–8 |
| 2 | HOIST D-200 close-underhand front pulldown — long bar, palms toward you, hands just inside shoulder width | 2 × 5–8 |
| 3 | HOIST D-300 horizontal chest press | 2 × 5–8 |
| 4 | HOIST D-200 chest-supported mid-row | 2 × 5–8 |
| 5 | Back-supported neutral-grip dumbbell overhead press | 2 × 5–8 |
| 6 | HOIST D-400 seated leg curl | 2 × 5–8 |
| 7 | HOIST D-600 lower-back extension | 1 × 5–8 |
| 8 | HOIST D-600 abdominal flexion | 1 × 5–8 |
| 9 | HOIST CL-2403 straight-leg calf press | 1 × 5–8 |
| 10 | 45° bench timed static neck extension | 1 × 90 s TSC |
| 11 | 45° bench timed static neck flexion | 1 × 90 s TSC |

Perform slots 1 through 11 exactly as numbered. Finish every work set for the current exercise before moving to the next exercise; do not circuit, superset, or reorder around machine availability. Bring one dedicated yoga block for slots 10 and 11.

For every dynamic work set:

- Target about 2 repetitions in reserve. RIR is an estimate, not an exact measurement.
- Take 5 seconds to perform the positive/lifting phase, reverse direction smoothly without a deliberate pause, and take 5 seconds to perform the negative/lowering phase. The turnaround is continuous but never bounced or jerked.
- Rest 2 minutes before the next set.
- Stop before range, body position, or movement path changes.
- Do not deliberately train to failure or use forced repetitions, negatives, drop sets, or rest-pause.

Track load, clean repetitions, estimated RIR, and pain. Do not use time under tension as the progression variable.

### Timed static contraction standard

Slots 10 and 11 use one continuous 90-second contraction against an immovable padded obstacle:

1. Ramp gradually from zero to a moderate effort and maintain it through 30 seconds.
2. Ramp gradually to a near-maximal effort and maintain it through 60 seconds.
3. Ramp gradually to the hardest effort you believe you can safely maintain and continue through 90 seconds.
4. Ramp gradually back to zero.

The body and obstacle do not move. Breathe continuously. Reduce effort immediately if you approach pain; stop for sharp or escalating pain, numbness, tingling, dizziness, headache, visual disturbance, or loss of position. Rest 120 seconds before the next exercise. The first moderate phase is the preparation; there is no separate TSC warm-up.

### Dynamic progression

Keep setup, range, and cadence fixed. Increase one selector position or the smallest dumbbell increment only after every prescribed set for that exercise reaches 8 clean repetitions while still targeting about 2 RIR on two consecutive exposures. If the increased load prevents 5 clean repetitions, return to the preceding load at the next exposure.

TSC does not use the dynamic promotion rule. Keep the obstacle, body position, bench angle, and yoga-block placement fixed. Record actual duration and pain only. Without force-measuring equipment, do not invent pounds, force, RIR, or a progression claim.

### Initial load calibration

This is performed when establishing an exercise, not before every workout:

1. Establish joint alignment and a pain-free range.
2. At selector position 1, perform 3 clean repetitions using the prescribed 5-second positive and 5-second negative.
3. If the probe is plainly easy and at least 5 additional clean repetitions clearly remain, rest 90 seconds, move one position heavier, and perform another 3-repetition probe.
4. Continue one position at a time only while the test remains easy and technically identical.
5. Stop before grinding, rest 2 minutes, and choose a conservative tested position expected to permit 5–8 clean repetitions near the target effort.

Calibrate the D-200 pulldown and row separately. Record D-series loads as selector positions, never invented pounds. Only the CL-2403 has a verified chart: `actual lb = 47 + 23 × (pin − 1)`.

## E-bike workout

Every Tuesday, Friday, and Saturday at 07:00:

1. Ride 5 minutes easy.
2. Accumulate 50 minutes in WHOOP Zone 2.
3. Ride 5 minutes easy.

The target is heart-rate zone time, not speed, route, distance, calories, strain, or recovery score.

## Coverage and evidence boundary

The routine trains upper and lower body twice weekly: knee/hip extension, knee flexion, plantarflexion at the ankle, trunk flexion/extension, vertical and horizontal pulling, horizontal and vertical pushing, and direct neck extension/flexion. Compound work covers the arms and shoulder girdle without duplicate curls, raises, shrugs, or extra presses.

Two full-body strength sessions meet the evidence-supported minimum frequency. The volume is an effective sustainable dose, not a claim of maximal hypertrophy. Slow controlled repetitions, multiple sets, adequate rest, and stopping near rather than necessarily at failure are compatible with the evidence; the exact 5/5 cadence is a fixed execution preference, not a biologically privileged value or a proven injury-prevention optimum. Three 60-minute rides provide 150 weekly minutes of moderate aerobic work.

The detailed evidence and technique are in the [operating manual](docs/program/Personal_Fitness_Operating_Manual.md), [Baye audit](docs/research/Drew_Baye_Critical_Evidence_Audit.md), and [exercise-selection audit](docs/research/Exercise_Selection_Primary_Source_Audit.md).

## Store only reality

The prescription lives in typed TypeScript, not BumbleDB. BumbleDB stores only the private personal profile and observations that happened: activities, dynamic and TSC work sets, setup marks, sleep, measurements, and the trusted WHOOP subset.

Agents and local integrations import `src/ledger.ts` and use BumbleDB's typed queries and transactions directly. A partial session contains only the facts that occurred; there is no completed/missed status.

Stop an exercise for sharp or escalating pain, numbness, weakness, loss of balance, chest pressure, faintness, or unusual breathlessness. Training guidance is not medical clearance.
