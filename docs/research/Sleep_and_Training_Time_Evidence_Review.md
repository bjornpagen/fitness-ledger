# Sleep, Caffeine, and Training-Time Evidence Review

## Fixed decision

- Wake: 06:30 every day; immediately take one 200 mg caffeine pill.
- Strength: Monday and Thursday, start at 07:00 and finish after the complete prescription; there is no session-duration limit.
- E-bike: Tuesday, Friday and Saturday, start at 07:00 and follow the prescribed 60-minute structure.
- Caffeine cutoff: 14:30.
- Wind-down: 21:15; lights out: 22:00 every day.

These times define the fixed schedule within evidence-compatible boundaries. They are not presented as universally optimal clock times.

## Morning exercise

The 2019 systematic review/meta-analysis of time-of-day-specific resistance training found that muscle size and strength can improve with morning or evening training. Baseline performance often favors later hours, while testing gains tend to be largest near the habitually trained time [Grgic et al., 2019](https://pubmed.ncbi.nlm.nih.gov/30704301/). A later systematic review/meta-analysis likewise found no clear universal best time for health or performance adaptation [Grgic et al., 2023; DOI `10.1186/s40798-023-00577-5`].

The defensible conclusion is consistency and adherence, not an evening mandate. Using the same 07:00 start for lifting and riding reduces schedule variation and makes repeated strength observations more comparable.

Moving the rides to morning also removes any question about an evening exercise-to-bed interval. The earlier evening-exercise discussion remains scientifically relevant but no longer determines the prescription.

## Caffeine dose and timing

The ISSN position stand reports the most consistent performance benefits around 3–6 mg/kg, with possible effects at lower doses and large individual variation [Guest et al., 2021](https://pubmed.ncbi.nlm.nih.gov/33388079/). The fixed 200 mg pill is a policy choice, not a mandate to escalate.

Taking it at 06:30 gives 30 minutes before the 07:00 session. Many studies administer caffeine about 60 minutes before exercise, but absorption, formulation, habitual use and response vary; the effect can continue rising during the session. The timing places exercise soon after waking rather than claiming an exact performance optimum.

A controlled trial found that 400 mg caffeine taken even six hours before bed significantly disturbed sleep [Drake et al., 2013](https://pubmed.ncbi.nlm.nih.gov/24235903/). The prescribed pill is earlier and smaller, while the 14:30 cutoff leaves seven and a half hours before lights out. That is a conservative guardrail, not a guarantee of zero sleep effect.

## Sleep opportunity and regularity

The American Academy of Sleep Medicine/Sleep Research Society consensus recommends adults obtain at least seven hours of sleep regularly [Watson et al., 2015](https://pubmed.ncbi.nlm.nih.gov/26039963/). The 22:00–06:30 interval supplies an eight-hour-thirty-minute opportunity; it does not claim that all of that interval is asleep.

The National Sleep Foundation consensus concludes that sleep regularity matters for health, performance and safety [Sletten et al., 2023](https://pubmed.ncbi.nlm.nih.gov/37684151/). That supports one wake and lights-out time rather than changing sleep around training days.

On daylight-saving transitions, wall time remains fixed while the actual elapsed interval can be seven or nine hours. The TypeScript prescription holds wall time; BumbleDB stores only actual observed sleep intervals and offsets.

## WHOOP boundary

WHOOP may contribute observed sleep start/end, nap classification, workout average/max HR and zone-duration milliseconds. Its public v2 API does not expose raw HR samples. Sleep need, debt, stages, efficiency, performance, recovery and strain are vendor-derived projections and cannot alter bedtime, wake time, the workout, or the ride.

[WHOOP's October 2025 Sleep Planner documentation](https://support.whoop.com/s/article/Sleep-Coach-with-Wake-Alarm?language=en_US) distinguishes a fixed **Exact Time** alarm from **Sleep Goal** and **In the Green** modes, which can trigger inside a one-hour wake window. The prescribed setting is therefore a recurring 06:30 Exact Time alarm. **Improve My Sleep** is the consistency-oriented planner selection, but its suggested bedtime remains nonbinding.

Persistent insomnia, excessive daytime sleepiness, loud snoring/gasping, palpitations, or another concerning symptom belongs in clinical assessment, not app-score optimization.
