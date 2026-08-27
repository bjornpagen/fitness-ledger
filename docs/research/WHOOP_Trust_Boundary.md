# WHOOP Trust Boundary

WHOOP is a capture transport, not an authority over the routine.

## Public API limit

The inspected WHOOP v2 OpenAPI description exposes workout summaries and sleep activities, not raw heart-rate samples. The workout score object includes average/max HR and six integer zone-duration fields alongside proprietary strain and energy estimates. Sleep includes exact bounds, offset and nap classification alongside derived scoring objects.

API specification inspected August 26, 2026: [WHOOP OpenAPI JSON](https://api.prod.whoop.com/developer/doc/openapi.json).

## Persisted whitelist

| WHOOP field | Stored representation | Reason |
|---|---|---|
| Workout/sleep `id` | 16-byte UUID | Idempotency only |
| `start`, `end` | Half-open absolute interval | Observed temporal fact |
| `timezone_offset` | Signed offset minutes | Local context at observation |
| `average_heart_rate` | Integer bpm | Direct summary of captured HR |
| `max_heart_rate` | Integer bpm | Direct summary of captured HR |
| `zone_zero_milli` through `zone_five_milli` | Six exact ordered slots with integer milliseconds | Dense retained HR-zone distribution |
| Sleep `nap` | Boolean classification | Distinguishes nap from primary sleep interval |

The six zone facts exactly partition zone indices `[0, 6)`. This guarantees one duration per zone without implying that WHOOP's recorded time equals the activity duration.

## Fields discarded during decode

- strain and recovery;
- kilojoules/calories and percent recorded;
- distance, altitude gain and altitude change;
- sleep need, debt, performance, consistency and efficiency;
- sleep stages and respiratory rate;
- cycle identity, user identity, recommendations and other vendor metadata.

These fields never enter the decoded TypeScript value passed to the database. Tests inject them into realistic API payloads and prove they are absent after decoding.

## Sync behavior

`pnpm whoop:sync -- <start> <end>` fetches only `/v2/activity/workout` and `/v2/activity/sleep`. It does not call cycle or recovery endpoints. Only scored workouts with an explicitly recognized strength/cycling sport name receive HR summaries; unscored or unrelated sports are skipped.

An imported UUID is unique. Re-importing the same record is a no-op. If a BumbleDB activity already has the exact person/time interval and compatible kind, WHOOP attaches the summary instead of duplicating the activity. Conflicting activity truth is rejected rather than guessed together.

Credentials come from `WHOOP_ACCESS_TOKEN` in the invoking process environment. No token, refresh credential, user ID or secret file belongs in the repository.

## Coaching refusal

WHOOP data never changes exercise choice, set count, RIR, resistance progression, ride duration, bedtime or wake time. Zone 2 is the only live feedback target. The ledger can later support honest analyses over the retained values, but it cannot reconstruct raw HR or vendor projections that were intentionally discarded.
