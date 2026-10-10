# Gym Machine Guide

Identification, controls, weight stacks and setup for the equipment the routine uses. Machine and control names are HOIST's own. The executable labels, procedures and sources are in `src/policy/equipment.ts`; each control's numbering convention is part of the ledger theory (`src/policy/exercises.ts`). This public guide contains no residence or facility identifier and no value from the user's ledger.

The tables below separate three kinds of statement: what HOIST's manuals, placards and archived product pages document; what is only inferred from a drawing; and what the user confirmed on the installed unit. Nothing here establishes a current setting.

## Identified equipment

| Private photo | Identification | Confidence | Decisive evidence |
|---|---|---:|---|
| `IMG_3865.HEIC` | HOIST CL-2403 Seated Leg Press | Certain | Decal prints `CL 2403 SEATED LEG PRESS`. |
| `IMG_3866.HEIC`, `IMG_3867.HEIC` | HOIST Dual 300 Multi-Chest (D-300) | Certain | Decals print `Dual 300` and `MULTI-CHEST`; archived drawing matches. |
| `IMG_3868.HEIC` | HOIST Dual 200 Lat Pulldown / Mid-Row (D-200) | Certain | Decal prints `Dual 200`, `LAT PULLDOWN`, and `MID-ROW`. |
| `IMG_3869.HEIC` | HOIST Dual 400 Leg Extension / Hamstring Curl (D-400) | Certain | Decals print `Dual 400`, `HAMSTRING CURL`, and `LEG EXTENSION`. |
| `IMG_3871.HEIC` | HOIST Dual 600 Lower Back / Abdominals (D-600) | Certain | Decal prints `Dual 600`, `LOWER BACK`, and `ABDOMINALS`. |
| `IMG_3872.HEIC` | Fixed rubber-hex dumbbells | High for type | Photograph shows fixed rubber-hex pairs; brand is unreadable. The rack's weights and spacing are not established; the available pairs are the weights the user reports. |

The private photographs also show a HOIST PTS-1000 Dual Action Smith, benches, bars and plates, and cardio machines. The routine does not use them.

Vintage: the Dual machines are a mid-1990s product family (the D-200 rev A manual and the D-300 cover are dated July 1996). The CL-2403 manual is dated June 2000. A serial plate is still required to date each installed unit.

## Weight stacks

**Rule:** selector position = plate number counted down from the top plate (1). Lower in the stack lifts more plates, so a higher position is always heavier. The ledger stores this position, never pounds.

| Machine | Positions | Plate makeup | Plate labels | Manufacturer chart or ratio (information only) | Sources |
|---|---:|---|---|---|---|
| CL-2403 | 21 | 41 lb top plate + 20 × 20 lb | decals 1–21 from the top | 115% weight ratio; actual lb = 47 + 23 × (position − 1), from 47 to 507 lb | CL-2403 manual PDF p. 40; ManualsLib copy, chart viewer p. 37 |
| D-200 | 21 | top plate + 20 × 20 lb; one stack shared by the pulldown and the row | decals 1–21 | weight-chart decal 021-0003280: selected lb = 46 + 20 × (position − 1); ratios 50% for the lat pulldown and 60% for the mid-row. The ratio table assumes a 40 lb top plate, which disagrees with the 46 lb first position. | D-200 rev B PDF pp. 21, 25 |
| D-300 | 16 | top plate + 4 × 12.5 lb + 11 × 20 lb | decals 1–16 | selected lb 17, 30, 42, 55, 67, then +20 per position to 287; ratio 70% | D-300 rev B PDF pp. 18, 22 |
| D-400 | 16 | top plate + 15 × 20 lb | not documented | archived product page: 350 lb stack, 68% weight ratio | D-400 manual; archived Dual 400 product page |
| D-600 | 16 | top plate + 15 × 20 lb | not documented | archived product page: 350 lb stack, 40% weight ratio | D-600 manual; archived Dual 600 product page |

The chart and ratio column is HOIST's published information. It is not used for recording or progression, and it does not predict a starting position. A weight ratio describes how a machine's lever arms and cable path scale the selected stack, and the ratios differ by machine and exercise, so a position on one machine is not comparable with a position on another. The D-200 lat pulldown and mid-row share one stack but are separate exercises with separate working positions.

The later D-200 and D-300 manual revisions publish pound weight-chart decals. An installed unit may lack them. The D-400 and D-600 manuals do not document plate labels.

## Controls

Every body-fit adjustment is a `Control` in the ledger theory, recorded on a set by its control id. Controls belong to machines: a set may record any control on its exercise's machine. The numbering column is the convention stored in the theory:

- `Printed`: record the number printed or engraved at the engaged position.
- `CountFromMostUpright`: no printed numbers; hole 1 is the most upright position, and the count rises as the pad reclines.
- `Unconfirmed`: HOIST does not document the numbering. Record a printed number if one is visible; otherwise stop, agree a counting rule with the user, and add that convention to the theory before recording.

| HOIST name | Control id | Machine | Numbering | What HOIST documents about the numbering and direction | Sources |
|---|---|---|---|---|---|
| Back Adjuster (back pad angle) | `cl-2403-back-adjuster` | CL-2403 | `CountFromMostUpright` | A curved Range Adjuster Plate (part 19) on the Back Adjuster Seated Assembly, held by a long pull pin. The drawing suggests about four usable holes, and the decal list has no back-angle number decal. HOIST documents neither numbering nor direction. The installed unit has no printed numbers: hole 1 is the most upright position, and higher numbers recline further. | CL-2403 manual PDF pp. 33–37 |
| Seat Slide Adjuster | `cl-2403-seat-slide-adjuster` | CL-2403 | `Unconfirmed` | The Seat Slide Adjuster (part 4) is a perforated tube beside the seat rails with 16 holes drawn. A second 1–21 number strip (decal 021-0003089) is listed without a drawn location, so printed numbers at the seat are not established. | CL-2403 manual PDF pp. 33–37; placard PDF p. 35 |
| Seat Pad Adjuster | `d-200-seat-pad-adjuster` | D-200 | `Printed` | Adjuster tube drawn with numerals 1–7, 1 at the top of the tube, which probably means the lowest seat. That direction is inferred from the drawing, not stated by HOIST. The Dual specification describes the seat and back-support adjusters as chromed telescopic tubes engraved with a number at each position. | D-200 rev B PDF p. 11; Dual specification |
| Thigh Pad Adjuster | `d-200-thigh-pad-adjuster` | D-200 | `Printed` | Numerals 1–4 drawn from top to bottom; direction inferred from the drawing. | D-200 rev B PDF p. 11; Dual specification |
| Horizontal Chest Pad Adjuster | `d-200-horizontal-chest-pad-adjuster` | D-200 | `Printed` | Numerals 1–14 drawn with 1 at the pad end; direction inferred from the drawing. | D-200 rev B PDF p. 11; Dual specification |
| Seat Pad Adjuster | `d-300-seat-pad-adjuster` | D-300 | `Printed` | Numerals 1–7 drawn with 1 at the top of the tube, probably the lowest seat; direction inferred from the drawing. | D-300 rev B PDF p. 9; Dual specification |
| Back Pad Adjuster | `d-300-back-pad-adjuster` | D-300 | `Printed` | Numerals 1–7 drawn with 1 at the pad end, probably the farthest-back position; direction inferred. The parts list names this sliding weldment the Chest Pad Adjuster. | D-300 rev B PDF p. 9; Dual specification |
| Back Adjuster | `d-400-back-adjuster` | D-400 | `Printed` | A telescoping Back Pad Adjust tube with a gas spring and a remote pull-pin handle; the archived product page lists a gas-spring back adjuster. The Dual specification describes engraved numbers on these adjuster tubes. Hole count is unsettled: the drawing shows about four holes, while a reseller lists five. Direction is not documented. | D-400 manual PDF pp. 2–6, 9–10; archived Dual 400 product page; Dual specification |
| Range of Motion Adjustment | `d-400-range-of-motion` | D-400 | `Printed` | A Cam Adjust Plate at the moving arm's pivot. The archived product page lists range-of-motion adjustments for both exercises, and the Dual specification says every range-of-motion position is numbered. Direction is not documented. | D-400 manual PDF pp. 2–6, 9–10; archived Dual 400 product page; Dual specification |
| Leg Length Adjustment | `d-400-leg-length` | D-400 | `Unconfirmed` | An Adjustable Roller Assembly on a Range Adjust Plate on the moving arm, about seven holes drawn. The archived product page lists leg-length adjustment; no numbering is documented. | D-400 manual PDF pp. 2–6, 9–10; archived Dual 400 product page |
| Thigh Brace Adjustment | `d-400-thigh-brace` | D-400 | `Unconfirmed` | An Adjustable Roller Assembly on a Range Adjust Plate at the front of the seat, about seven holes drawn. The archived product page lists thigh-brace adjustment; no numbering is documented. | D-400 manual PDF pp. 2–6, 9–10; archived Dual 400 product page |
| Range of Motion Adjustment | `d-600-range-of-motion` | D-600 | `Printed` | A Cam Adjust Plate with a long T-handle pull pin. The archived product page lists range-of-motion adjustments for both exercises, and the Dual specification says every range-of-motion position is numbered. Direction is not documented. | D-600 manual PDF pp. 3–8; archived Dual 600 product page; Dual specification |
| Foot Rest | `d-600-foot-rest` | D-600 | `Unconfirmed` | A Footrest Assembly sliding square tube, about eleven holes drawn. The drawing shows a spring T-handle pull pin, but the parts list names that callout a chain-link connector, so the installed retention must be identified on the machine. No numbering is documented. | D-600 manual PDF pp. 3–8; archived Dual 600 product page |

The D-600 back pad is self-aligning and has no control. The CL-2403 Back Adjuster's convention is the only one confirmed on the installed equipment; the `Printed` controls rely on HOIST's drawings and specification showing numbered positions, so read the number actually engraved at the engaged position rather than counting holes.

### Controls by exercise

| Exercise | Applicable controls |
|---|---|
| CL-2403 Seated Leg Press | Back Adjuster, Seat Slide Adjuster |
| Calf press on the CL-2403 Seated Leg Press | Back Adjuster, Seat Slide Adjuster |
| Dual 200 Lat Pulldown | Seat Pad Adjuster, Thigh Pad Adjuster, Horizontal Chest Pad Adjuster |
| Dual 200 Mid-Row | Seat Pad Adjuster, Thigh Pad Adjuster, Horizontal Chest Pad Adjuster |
| Dual 300 Multi-Chest chest press | Seat Pad Adjuster, Back Pad Adjuster |
| Dual 400 Hamstring Curl | Back Adjuster, Range of Motion Adjustment, Leg Length Adjustment, Thigh Brace Adjustment |
| Dual 600 Lower Back | Range of Motion Adjustment, Foot Rest |
| Dual 600 Abdominals | Range of Motion Adjustment, Foot Rest |
| Overhead press and both neck exercises | none; bench facts instead |

The list follows from the machine: every exercise on a machine may record all of that machine's controls, so the pulldown and the mid-row share the three D-200 controls, and the leg press and calf press share the two CL-2403 controls. Each set still records its own positions, because two exercises on one machine usually use different settings. HOIST's D-200 placard calls for a snug thigh pad on both D-200 exercises.

## CL-2403 calf-press caveat

HOIST's CL-2403 placard (PDF p. 35) documents only the leg press. Its steps are to adjust the back pad angle if needed, set the seat at a forward starting position with about a 90-degree knee bend, and slide the seat back to exit, and it names only the quadriceps and glutes as the muscles trained. Calf press is not a HOIST-documented CL-2403 function. The routine uses it as Baye's stated substitution when no seated straight-leg calf machine exists. There is no manufacturer guidance for its seat or back settings, footplate placement or range; those rest entirely on the user's observed positions.

## Setup by exercise

Height cannot determine the correct setting. Inspect the installed geometry and support the body before selecting a position. Limb and torso proportions, mobility, pad thickness, the control's numbering and the exercise path decide the final setting.

### CL-2403 Seated Leg Press and calf press

- Back Adjuster: support the unloaded back pad, withdraw the long pull pin, set the angle for full back and pelvis support, and fully re-engage the pin before loading. Count from hole 1, the most upright.
- Seat Slide Adjuster: with the carriage controlled, set the seat at a forward starting position with about a 90-degree knee bend and the pelvis supported, and re-engage the retention before loading. Identify the installed release first.
- Leg press: feet around shoulder width, knees track toes. If the pelvis curls at the bottom, reduce depth or move the seat back. Do not chase a deeper range by losing support.
- Calf press: secure the forefoot on the footplate, keep knees softly extended and still, and use only comfortable ankle travel.
- The two exercises may use the same seat geometry, but record what is actually observed for each.

### Dual 200 Lat Pulldown

- Seat Pad Adjuster: support the seat, withdraw the pin, set the height (HOIST's placard, D-200 rev B PDF p. 23: lower the seat for taller users), and re-engage it.
- Thigh Pad Adjuster: bring the pad snugly onto the thighs without painful compression; HOIST's placard calls for a snug thigh pad on both exercises.
- Horizontal Chest Pad Adjuster: it is part of the same machine, so its position is recorded on pulldown sets too. Record where it actually sits.
- Clip on the long lat-pulldown bar; do not use the rope or triangle handle. Hold it underhand with palms toward you and hands just inside shoulder width. Lean back about 30 degrees, pull toward the upper chest, and avoid a behind-neck path.
- At full reach, remain in the seat.

### Dual 200 Mid-Row

- Seat Pad Adjuster: set the height so the handles meet the lower-to-mid sternum in the cable line. Confirm it separately from the pulldown.
- Horizontal Chest Pad Adjuster: set reach so the chest stays supported with the handles just out of reach (HOIST's placard, D-200 rev B PDF p. 23), allowing shoulder-blade reach without the torso leaving the pad.
- Thigh Pad Adjuster: HOIST's placard calls for a snug thigh pad on the row too. Record its position like the pulldown's.

### Dual 300 Multi-Chest chest press

- Seat Pad Adjuster: set the height so the horizontal handles travel across the mid-sternum. Keep feet planted.
- Back Pad Adjuster: set the desired pre-stretch with shoulders supported (HOIST's placard, D-300 rev B PDF p. 20).
- Use the horizontal grip; the placard assigns the vertical grip to the pec fly.

### Dual 400 Hamstring Curl

- Back Adjuster: pull the remote handle and let the gas spring move the supported back pad until each knee aligns with the arm pivot; release the handle and confirm the pin engaged.
- Range of Motion Adjustment: keep the stack down and support the moving arm, release the cam, choose a start with a slight knee bend, and fully re-engage it.
- Leg Length Adjustment: place the roller at the bottom of the calves above the heels.
- Thigh Brace Adjustment: bring the brace snugly onto the thighs without painful compression.
- Keep feet neutral.

### Dual 600 Lower Back and Abdominals

- Foot Rest: adjust the unloaded foot rest so the body cannot slide as resistance begins, and verify its actual retention before loading. It is not a resistance selector.
- Range of Motion Adjustment: keep the stack down, support the moving arm, pull the T-handle, choose a conservative pain-free starting arc, and verify full engagement.
- Lower back stops before end-range hyperextension; abdominals use trunk flexion rather than arm pulling.
- Confirm both controls separately for the two exercises.

### Back-supported dumbbell overhead press

- Use a high bench back and a neutral grip.
- Select the bench angle and seat position that keep ribs and pelvis stable and permit a pain-free bottom position.
- Record the bench label, the observed backrest angle or mark, and whether the seat is fixed or adjustable, with its mark when adjustable. No bench model or numbered range is assumed. Dumbbell pounds are per hand.

### Timed static neck extension and flexion

- Bring one dedicated yoga block and use the same adjustable bench for both movements at 45 degrees.
- For extension, lie face-up with the block centered under the back of the head and press backward while the neutral head and torso remain still.
- For flexion, lie face-down, support body weight through the arms, center the forehead on the block, and press into it while the neutral head and torso remain still.
- Record the 45-degree backrest, the bench label and applicable seat facts. Keep yoga-block placement reproducible. Do not infer force or pounds from duration.

## Retention and servicing

Support unloaded moving parts before release, adjust for the alignment described above, and verify full retention before loading. Do not call every control a pin: the D-400 Back Adjuster is gas-spring assisted with a remote handle, and the D-600 Foot Rest's retention must be identified on the machine. A missing, damaged or non-engaging retaining component requires servicing before use. It is never defaulted or bypassed.

The first time, confirm working resistance directly after geometry. No starting selector position, inventory range or probe ladder is assumed. An unmentioned setting is the one on the last immediate set of the same exercise, even from an earlier session, and a reported change carries forward from then on; a setting never recorded is asked. Store mid-exercise changes on their actual sets. Historically missing settings remain absent.

## Photographs that would resolve open questions

1. Each manufacturer/model/serial plate, square-on and readable.
2. Side views of every adjustment showing its marks and number direction, especially the CL-2403 Seat Slide Adjuster, D-400 Leg Length and Thigh Brace Adjustments, and D-600 Foot Rest.
3. Each complete weight stack from top plate to bottom plate, including any weight-chart decal.

Do not photograph bystanders or screens containing another person's data.

## Sources

The private source pack keeps the original photographs and manuals under `private/sources/gym/` when supplied.

- [HOIST Customer Downloads, Archived Owner's Manuals](https://www.hoistfitness.com/pages/customer-downloads)
- [CL-2403 Owner's Manual, June 2000, scanned](https://cdn.shopify.com/s/files/1/0057/5599/4225/files/CL-2403_om.pdf) and the [ManualsLib copy](https://www.manualslib.com/manual/879629/Hoist-Fitness-Cl-2403.html) (chart viewer p. 37)
- [D-200 Owner's Manual, rev A, July 1996](https://cdn.shopify.com/s/files/1/0057/5599/4225/files/D-200_om.pdf) and [rev B, catalog 0600-001, parts distributor mirror](https://www.gympart.com/TSB/Hoist%20Fitness/Dual_Series/D200_Lat_Pulldown,_Mid_Row/S/D200_om.pdf)
- [D-300 Dual 300 Multi-Chest Owner's Manual, rev A](https://cdn.shopify.com/s/files/1/0057/5599/4225/files/D-300_om.pdf) and [rev B, parts distributor mirror](https://www.gympart.com/TSB/Hoist%20Fitness/Dual_Series/D300_Multi,_Chest/S/D300_om.pdf)
- [D-400 Dual 400 Leg Extension / Hamstring Curl Owner's Manual](https://cdn.shopify.com/s/files/1/0057/5599/4225/files/D-400_om.pdf) and the [archived Dual 400 product page, c. 2000](https://web.archive.org/web/20001027121018/http://www.hoistfitness.com:80/Pages/comd400.html)
- [D-600 Dual 600 Lower Back / Abdominals Owner's Manual](https://cdn.shopify.com/s/files/1/0057/5599/4225/files/D-600_om.pdf) and the [archived Dual 600 product page, c. 2000](https://web.archive.org/web/20001202005300/http://www.hoistfitness.com:80/Pages/comd600.html)
- [HOIST Dual Line Product Specification, archived](https://web.archive.org/web/20001027230644/http://www.hoistfitness.com:80/Pages/cdspec.html) and the [archived Duals overview](https://web.archive.org/web/20010302173335/http://www.hoistfitness.com:80/Pages/comdual.html), which describes numerically indexed gas-spring pad adjusters and a mounted instructional placard on each Dual
