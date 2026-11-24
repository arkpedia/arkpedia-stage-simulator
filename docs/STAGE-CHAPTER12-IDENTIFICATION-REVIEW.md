# Chapter 12: sight and identification (first slice)

Chapter 12 hides hostile Spies among Norport Civilians. Every unit starts unidentified and invincible; identification (鉴定) fills while the unit is blocked or stands in own-side sight. The research and source readings are in `docs/CHAPTER-12-IDENTIFICATION-RESEARCH.md`. This document covers what was built on 2026-11-24.

## What is admitted

- **The environment.** A level is admitted only with both halves: the rune `env_system_new` naming `env_005_mainline12_sightSystem`, and the global buff `mainline12_sightManager`. `tools/arkpedia/stage-environments.mjs` refuses either one alone ("Unpaired chapter-12 sight system").
- **Two identity records:** Pathfinder Spy `enemy_1314_wdnjd` and Norport Civilian `enemy_1313_wdfmr`, level 0 only, each pinned against its native tree, templates and animation clock (`shared/arkpedia/enemy-norport-identity-features.js`).
- **Withdrawn, on purpose:** `enemy_1313_wdfmr_2`, `enemy_1314_wdnjd_2`, `enemy_1315_wdyjd(_2)` and `enemy_1316_wdpjd(_2)`. They had been admitted through shared generic keys (`ability:Spy`, `talent:civilianTalent`), which never ran identification. `isUnreviewedIdentity` now refuses them until each family is read.
- **The DP rule** `cbuff_max_cost` (`max_cost` 20, `max_cost_ceil` 99 in every chapter-12 level): the DP cap starts at `max_cost`, and a confirmed civilian's `ModifyMaxCost` raises it, never past the ceiling.

Ten stages became available: 12-2, 12-2 adverse, 12-6, 12-8, 12-8 adverse, 12-17, 12-17 adverse, TR-22, TR-23 and VEC-SP07 act2break. The library now has 1,099 available stages; the main story has 377 of 572.

## Legacy chapter-12 stage files retired

The 33 hand-made files `data/arkpedia-stage-12-*.json` and `data/arkpedia-stage-h12-2_adverse_environment.json` (reviewed 2026-10-21) were removed with their entries in `data/arkpedia-stages.json` (938 → 905 legacy entries, 597 → 564 public). They had no sight environment and no DP ceiling, and 26 of them listed the withdrawn identity variants. The compiled library is the primary catalogue; its 12-2, 12-6, 12-8 and 12-17 (and adverse) replace the seven that still loaded. The Roadside Emergency Reserves test now reads the compiled 12-8.

## Native evidence

- **Sight** (`shared/arkpedia/stage-sight.js`, `sightNativeReviewed`): the global buff `[g]mainline12_sightManager` triggers every 0.5 s (`waitFirst` 0), and on skill start and finish, each running `TriggerEnvSystem env_005_mainline12_sightSystem` on its owner. The env system's `inSight` mask setting enables tile bits [4, 8]; `outOfSight` clears [8]. Identification reads only `KEEP_REVEALED`, so bit 8 is read as "in sight now". That reading is an inference: the mask enum is not in the dump.
- **Identification** (the `detect_p1`/`detect_p2` templates, and PRTS 特殊机制 鉴定): every 0.1 s, +2 (phase 1) or +3 (phase 2) if blocked or in sight, otherwise −1, capped at 301. At 300, phase 1 moves to phase 2 at 0; phase 2 completes. Phase 2 never drops back to phase 1.
- **Pathfinder Spy:** disguised under `enemy_mainline12[civilianMode]` (INVINCIBLE, never attacks, `_A` clips). On completion, `switchModeTrigger` holds it for the 1 s `Die_A` clip (FORCE_DISARMED, INVINCIBLE, UNMOVABLE). Then mode 1: melee attacks, `_B` clips, move speed +0.05, and the next attack ×2 (`EnhancedAttack.atk_scale`).
- **Norport Civilian:** INVINCIBLE under `unit_mainline12[civilianMode]`, never costs life. On completion, `civilian_mainline12[detectComplete]` makes it BLOCK_FREE; reaching the exit runs `ModifyMaxCost` with `civilianTalent.max_cost` 2.

## Runtime

- `server/sim/content/arkpedia-stage-sight.js` (`installStageSight`): each own-side unit on the field contributes its current attack-range tiles (`rangeKeySet`, which follows skill range changes). A contribution is refreshed when the unit arrives, then on its own 0.5 s clock, and at its skill starts and ends. A unit that leaves or dies stops contributing. `b.stageSight.inSight(row, col)` answers identification.
- `server/sim/content/arkpedia-enemy-norport-identity.js` (`norportIdentity`): the shared two-phase controller, then the spy's switch and reveal, or the civilian's confirmation.
- `BattleCore.leak`: a friendly civilian pays its reward only once confirmed (`civilianDp`), capped by `flags.dpMaxCeil`.

## Placed objects no longer hold waves

12-8's wave 0 waited forever on its five Roadside Emergency Reserves: placed enemy-side unit devices counted as live enemies for kill-all waves and for the end of the battle. They now carry `holdsBattle: false` (`server/sim/arkpedia.js`).

This also changes already published stages that place such objects. A headless comparison over the 70 published stages with placed unit devices (seven-operator probe squad, life 999, 1,500 s, before vs after) gave 0 errors in every run, and:

- many stages that used to stall at 1,500 s now clear: 9-7 to 9-19, AW-7, DC-7, FD-2, H8-1, H9-x, R8-x, S9-x;
- TR-18 now clears at 70 s (it stalled with 3 spawns);
- `ursus_camp_r_03` spawns 310 instead of 307;
- `victoria_camp_r_09` spawns 430 instead of 100: its waves now advance past the five Dublinn pillars (`trap_043_dupilr`). The extra `dufrbl` are summons; the run hits the 1,500 s limit with the weak squad.

## Verification

- `test/arkpedia-norport-identity.test.js`: pins and refusals; the literal timings (phase 2 at 15.0 s in sight, completion 10.0 s later, the 1 s switch); −1 per 0.1 s out of sight down to 0; blocking without sight; the doubled first attack; the civilian's confirmation, its reward capped at the ceiling, and no reward or life loss before confirmation; the sight cadence, skill-start refresh and removal.
- `test/arkpedia-chapter12-stages.test.js`: the `cbuff_max_cost` rule and its refusals; the ten published stages' environment and DP ceiling; placed objects not holding 12-8 or TR-18 (TR-18 clears).
- All ten stages run headless without errors and clear; the two adverse ones take over 900 s with the weak probe squad. TR-22 confirmed civilians raised the DP cap from 20 to 28.

## Boundaries

- **Not checked in game.** The bit-8 reading of `KEEP_REVEALED`, the per-unit 0.5 s sight refresh and the 1 s spy switch come from the prefabs and PRTS.
- **Sight is range tiles only.** Devices and tokens contribute when they are own-side units with a range; a NeverTrigger unit's empty range and an AlwaysTrigger unit's whole-map sight are not special-cased yet.
- **The identity markers** (the phase colours over each unit) are not drawn.
- **Next slices:** Sentry Spy `wdyjd` (becomes Invisible), Armed Spy `wdpjd`, the `_2` tiers and `wdfmr_2` ("Norport Spy"), and the Instigator `wdfmpm`, family by family; then 12-16 and 12-20's own needs.
