# Chapter 12: sight and identification

Chapter 12 hides hostile Spies among Norport Civilians. Every unit starts unidentified and invincible; identification (鉴定) fills while the unit is blocked or stands in own-side sight. The research and source readings are in `docs/CHAPTER-12-IDENTIFICATION-RESEARCH.md`. This document covers what was built on 2026-11-24.

## What is admitted

- **The environment.** A level is admitted only with both halves: the rune `env_system_new` naming `env_005_mainline12_sightSystem`, and the global buff `mainline12_sightManager`. `tools/arkpedia/stage-environments.mjs` refuses either one alone ("Unpaired chapter-12 sight system").
- **Two identity records:** Pathfinder Spy `enemy_1314_wdnjd` and Norport Civilian `enemy_1313_wdfmr`, level 0 only, each pinned against its native tree, templates and animation clock (`shared/arkpedia/enemy-norport-identity-features.js`).
- **Withdrawn, on purpose:** `enemy_1313_wdfmr_2`, `enemy_1314_wdnjd_2`, `enemy_1315_wdyjd(_2)` and `enemy_1316_wdpjd(_2)`. They had been admitted through shared generic keys (`ability:Spy`, `talent:civilianTalent`), which never ran identification. `isUnreviewedIdentity` now refuses them until each family is read.
- **The DP rule** `cbuff_max_cost` (`max_cost` 20, `max_cost_ceil` 99 in every chapter-12 level): the DP cap starts at `max_cost`, and a confirmed civilian's `ModifyMaxCost` raises it, never past the ceiling.

Ten stages became available: 12-2, 12-2 adverse, 12-6, 12-8, 12-8 adverse, 12-17, 12-17 adverse, TR-22, TR-23 and VEC-SP07 act2break. The library now has 1,099 available stages; the main story has 377 of 572.

## Second slice: the Sentry Spy and the Pathfinder Spy _2 (2026-11-24)

- **Pathfinder Spy `enemy_1314_wdnjd_2`:** its native tree and templates equal the base record's (only the skeleton differs; the animation clock is the same: `Die_A` 1 s, `Attack` 1 s with OnAttack at 0.4 s). Higher stats; the same +0.05 speed and doubled first attack.
- **Sentry Spy `enemy_1315_wdyjd` and `_2`:** the same identification templates as the Pathfinder Spy, without `EnhancedAttack`. On reveal, `moveSpeed` adds 0.2 (`enemy_wdyjd[moveSpeed]`), and `enemyModeTalent` toggles on `enemy_wdyjd[enemyMode]`: abnormal flag 9 (`INVISIBLE` in the pinned enum) with the `common_invisible` effect, `_disableWhenBlocked` 1, `_restoreDelay` 3. The simulator's enemy Invisible already behaves so (`BattleCore._stealthSwitch`: lifted while blocked, back 3 s after release); the buff carries `stealthRestore` 3.

Fifteen stages became available: 12-3, 12-4, 12-10, 12-12, 12-14, 12-18 and their adverse variants, 12-6 adverse, 12-7 and 12-13. The library has 1,114 available; the main story 392 of 572. 12-18 adverse starts its DP cap at 15 (its own `cbuff_max_cost`). The eight first-slice bundles changed only by the spy parameters' new `atkScale`/`invisible` fields. All fifteen run headless with no errors and clear (12-18 adverse reaches the 1,500 s limit with the weak probe squad).

## Third slice: the Armed Spy and the elite civilian (2026-11-24)

- **Armed Spy `enemy_1316_wdpjd` and `_2`** (12,000/15,000 HP, 1,200/1,500 DEF): the same identification templates, with no talent component at all. The database lists `moveSpeed.move_speed` 0, but there is no `moveSpeed` object to apply it. Once revealed it is only a heavy melee attacker, using its own clock (`Attack` 1.5 s, OnAttack at 0.6 s). The two levels differ natively only in the FaceSwitcher's default side.
- **Elite civilian `enemy_1313_wdfmr_2`** ("Norport Spy" in the EN handbook, but a civilian): the Norport Civilian's tree and skeleton plus the marker `civilian_mainline12[civilianElite]`. The only thing that reads it is `detect_p2_progressController`, which picks the `appraisal_l3` instead of the `l2` phase-2 effect art. Its `civilianTalent.max_cost` is 5.

With these, every identity record of the regular spies and civilians is reviewed (`IDENTITY_PREFABS`). Eleven stages became available: 12-5, 12-9, 12-15, 12-19 and their adverse variants, 12-7 adverse, 12-13 adverse and H12-2 adverse. That gives 1,125 available and 403 of 572 main-story stages. No published bundle changed. 12-5 adverse starts its DP cap at 15. All eleven run headless without errors; 12-5 adverse, 12-7 adverse and 12-19 adverse reach the 1,500 s limit with the weak probe squad.

## Fourth slice: 12-16, Eblana and the 'Damazti Cluster' (2026-11-25)

- **'Damazti Cluster' `enemy_1541_wdslms`** (100,000 HP, life cost 0; no handbook lines, so `native:damaztiDisguise` routes it by key): the spies' `civilianModeTalent`, `pretending` and the same ten identification templates, byte for byte. Its `SwitchMode` plays `Die` (2 s). Its revealed mode (`Default`) carries `enemy_wdslms[invincibleAndBlockFree]` (INVINCIBLE, BLOCK_FREE) and an empty attack: it never fights and walks out. Clips: `Move`/`Idle`, then `2_Move`/`2_Idle`/`2_Die_2`.
- **Eblana `enemy_1540_wdncr`** (50,000 HP, life cost 0): always `enemy_wdncr[invincibleAndBlockFree]` (INVINCIBLE, BLOCK_FREE). Both her abilities select only units carrying `enemy_mainline12[civilianMode]` (disguised spies and Clusters; never civilians, whose disguise is `unit_mainline12[civilianMode]`, nor operators), and both deliver `enemy_wdncr[triggerSwitchMode]`: unless the unit already has `switchModeExternally`, its identification buffs end and `switchModeTrigger` starts the normal switch.
  - **Attack** (`Attack_b`, 1.5 s, OnAttack 0.5 s): one target in her radius-2 selector. Her database `attackSpeed` is a defined 0. The engine's ASPD floor is 20, so she attacks every 2.5 × 100 / 20 = 12.5 s. The generic enemy loader reads a defined 0 as 100 (also for nine other records: `crzjdg_2`, `ymgpck(_2)`, `achunt(_2)`, `acduml(_2)`, `acdumm`, and the Cluster, which never attacks); Eblana's runtime takes `aspd` from her record instead.
  - **detectAll** (initCooldown 92 s, cooldown 999, not silence-proof): `Skill_b_3` (11.67 s, OnAttack 9.2 s) with the global-range selector (script `6275044311115013764`, as in `enemy-marked-target-contract.js`): every such unit on the map switches at once.
- Both clocks come from `enm_art_17.ab` (`data/arkpedia-norport-boss-animations.json`). In 12-16 she spawns at 3 s and reveals Pathfinder Spies at 3.5, 16.0 and 28.5 s. detectAll then reveals the remaining spies and all three Clusters at 104.2 s. She and the Clusters reach the exit before wave 1 spawns.
- The H12/12-20 boss family `enemy_1542_wdslm` (and `_2` to `_4`) carries `ability:Spy` but runs its own program: see the fifth slice. `PENDING_IDENTITY_PREFABS` still refuses it in the generic spy keys.

12-16 became available: 1,126 stages, 404 of 572 main-story. No published bundle changed. Headless with the probe squad it clears at 1,270 s with no errors.

## Fifth slice: 12-20 and the 'Damazti Cluster' boss (2026-11-25)

Contract: `shared/arkpedia/enemy-damazti-features.js` (every record at both levels, the native closure, every template, four projectiles and the clips of `enm_art_17.ab`/`enm_art_13.ab` pinned). Runtime: `server/sim/content/arkpedia-enemy-damazti.js`. PRTS (“变形者集群”, 同构碎片1–3, 解构畸变体) settled three ambiguous readings; they are marked below.

- **The group** (`standRegisterList`). The fragments `_2` and `_3` register to the live host and take its HP ratio.
  - After any damage to a member, every other member is set to that member's HP ratio (`splitDamage`), so each hit on any body drains one pool.
  - Physical and Arts damage taken is ×(1 − 0.2 × live fragments) (`reduceDamage`, additive).
  - While any member is still disguised, every member is INVINCIBLE (`invincibleStack`).
  - A member reaching 0 HP knocks the others out with it (`syncReborn`). A member that finishes for good, or leaks, finishes the rest without revives (`killAll`, skipReborn).
- **Disguise.** The host and `_2` use the spies' identification (`civilianModeTalent`, `pretending`), then a 2 s `Die` switch. The identity runtime gained a hand-off variant for this.
- **First form.**
  - Melee `2_Attack`.
  - `syncAttackP1` (icd 10, cd 20; `2_Skill`, OnAttack 1.83 s): ATK ×1 Physical on one ally anywhere, highest taunt then latest deployed. Every fragment is forced to cast its own. PRTS: the fragment's is 100%; its talent `syncAttackP1.atk_scale` 1.5 does not reach the skill.
  - Below 50% HP (once), `branch_2`'s fragment arrives on its preset route at (4,1), and the group gets 2 s of INVINCIBLE.
- **Revive** (host and `_2`, once). 30 s at full HP afterwards. Every second (first at 0.9 s) it deals 100 sourceless Arts (level 1: 150) to each selectable ally within 1.75. When the host's revive ends, the wave is released (PRTS: 重生结束时). Then the second form, with 5 s of INVINCIBLE.
- **Second form.**
  - `syncAttackP2` (icd 10, cd 20).
  - **Lifeline Burst** `syncAttackWithSummon` (icd 0, cd 50; `2_Skill_2`, 9.1 s):
    - At the cast start, the tile of every ally on the field is locked; camouflaged allies are skipped.
    - At OnAttack (7.97 s), each lock deals 375 Arts to every ally on its tile and the 4 adjacent ones (`x-5`), and summons a Deconstructed Distortion there. The Distortion follows the host's route, flying.
    - Fragments only play the clip.
  - **The half-HP mark** `halfHPSummon` (once, below 50%):
    - It marks one operator (no tokens or traps). It prefers an operator with no other operator in its 3×3 square (`standAloneFlag`, `x-4`), then the latest deployed. The group is INVINCIBLE for 20 s.
    - After 15 s (PRTS; the buff's own lifeTime is 5, the skill's `duration` is 15), or as soon as the operator leaves the field: its card can no longer deploy for the battle, the decoy `_4` appears on its tile, and the operator is removed.
    - 2 s later, `branch_1`'s fragment `_3` arrives on its preset route at (3,1).
- **Deconstructed Distortion** `enemy_1323_wdbshd`: loses 250 HP per second (PURE). Its Corrosion, like the family's, comes from the stage rune.
- **The rune** `env_gbuff_new_with_verify apply_elemental_damage` (`ep_damage_ratio` 0.25): the listed enemies add Corrosion of 25% of each damage they deal (`apply_elemental_damage[enemy]`, ON_OUTPUT_DAMAGE). A stage with this family must carry the rune for all of it (inventory guard). The base is the damage as dealt: an inference.
- **Stage branches.** `stage-branches.mjs` binds `branch_2` to the host and `branch_1` to the decoy (`damaztiBranchBindings`). A hard level (`hlevel_mark` ≠ 0) also names `branch_3`, which no runtime drives.
- **Level 1** (H12) lists only what differs (`reborn.dotDamageValue` 150, the Distortion's 300 HP/s). It is read over level 0, as the Steam Knight's is. H12-1 adverse sets `hlevel_mark` 0 and opens. H12-3 and H12-4 adverse set it to 1 (a third summon on `branch_3`) and stay refused.

12-20, 12-20 adverse and H12-1 adverse became available: 1,129 stages. No published bundle changed. `test/arkpedia-damazti.test.js` forces each threshold in turn: reveal, 50%, fragment identified, knock-out, revive, second form, Lifeline Burst, the mark and the last fragment, and the final knock-out. It also tests a leaking fragment.

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
- **Eblana's targeting and timing.** Her selector's `_postFilter` 4 and `_abnormalFlag` 29 are not decoded, so nearest-first is an inference. Her projectile's flight is not modelled: the switch starts at the OnAttack. She only targets units still identifying, never one already switching. The 12.5 s interval rests on the engine's ASPD floor. Each cast holds her in place.
- **The 'Damazti Cluster'.** Lifeline Burst detonates at the clip's OnAttack (7.97 s); PRTS says "about 6 s" (open, worth an in-game check). Projectile flight is not modelled. The Corrosion base, and the Distortion's route (the host's own, flown straight), are inferences. Its "disappear" invincibility (`disappearInvinStack`) is not modelled: 12-20's routes have no DISAPPEAR checkpoint.
- **Left in chapter 12:** H12-3 and H12-4 adverse (the hard-level summon on `branch_3`). The Instigator `wdfmpm(_2)` is admitted through its identity lock; its interplay with identification is not re-reviewed.
