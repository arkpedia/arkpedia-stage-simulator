# Chapter 12: sight and identification (research, 2026-11-24)

36 stages are blocked only by the chapter-12 environment: 12-2 … 12-19 and their adverse variants (12-11, 12-16, 12-20 also need other work), H12-2 adverse, TR-22, TR-23 and VEC-SP07. Each level has two parts:

- the rune `env_system_new` (`key` `env_005_mainline12_sightSystem`);
- the global buff `mainline12_sightManager`.

## Sources

- **`mainline12_sightManager`** (CN `battle/prefabs/[uc]globalbuffs.ab`, pinned md5 `ba8ed26b…`, fetched and verified 2026-11-24):
  - one component on all own-side units (`_options` targetSide 1, motion 3, category 3);
  - buff `[g]mainline12_sightManager`, template of the same name, trigger interval 0.5 s.
  - Its ON_BUFF_TRIGGER, ON_SKILL_START and ON_SKILL_FINISH each run `TriggerEnvSystem env_005_mainline12_sightSystem` on the buff owner.
- **`env_005_mainline12_sightSystem`** (CN `battle/prefabs/[uc]envsystems.ab`): compiled code plus three config components:
  - `_sideType 2`;
  - `_maskSettings`:
    - `inSight` enables `tileInfoMask` [4, 8];
    - `outOfSight` lists [8] (`isEnable` 0);
  - status keys `inSight`, `outOfSight`, `ontViewed` (sic).

  The only mask any template reads is `KEEP_REVEALED` (`CheckTargetRootTileInfoMask`). Since `outOfSight` clears only bit 8, bit 4 is read as "has been seen" and bit 8 as `KEEP_REVEALED` ("in sight now"). This is an inference; the enum is not in our dump.
- **PRTS 视野范围.** A unit's sight is its attack-range tiles ("视野范围"): an explicit display range if one is set, otherwise the attack trigger's range, plus range extension. It changes with skills. A NeverTrigger attack mode has none; an AlwaysTrigger mode has the whole map. Chapter 12's 鉴定 uses the union of all own-side units' sight, devices included.
- **PRTS 特殊机制 鉴定 (Identification).**
  - Phase 1: every 0.1 s, +2 if blocked or in own-side sight, otherwise −1. At ≥300 it moves to phase 2.
  - Phase 2: the marker turns red if hostile, light blue/green otherwise. Every 0.1 s, +3 / −1, never back to phase 1. At ≥300 it completes.
  - The templates (`enemy_mainline12[detect_p1|p2]`, `civilian_mainline12[detect_p1|p2]`, the progress controllers) confirm this: stacks with a 301 cap, `CheckBlocked` first, then the mask; otherwise one stack is removed. A unit that has disappeared loses a stack.

## Families

| Record | Set | Before | On completion |
|---|---|---|---|
| `enemy_1313_wdfmr` Norport Civilian | civilian | `unit_mainline12[civilianMode]` INVINCIBLE; lpr 0 | `civilian_mainline12[detectComplete]` (BLOCK_FREE): on REACH_EXIT, `ModifyMaxCost` (`civilianTalent.max_cost` 2) |
| `enemy_1313_wdfmr_2` "Norport Spy" | civilian | same set | needs its own reading (name says spy) |
| `enemy_1314_wdnjd(_2)` Pathfinder Spy | enemy | `enemy_mainline12[civilianMode]` INVINCIBLE; empty combat (blockable, never attacks); `_A` clips; at the exit `moveSpeedWhenReachExit`, ReachExit → `Die_A` | `switchModeTrigger` (FORCE_DISARMED, INVINCIBLE, UNMOVABLE_PRIVATE) → `SwitchMode` cast (`Die_A`) → mode 1: melee attack, `_B` clips, move +0.05, next attack ×2 (`EnhancedAttack`) |
| `enemy_1315_wdyjd(_2)` Sentry Spy | enemy | same | becomes Invisible |
| `enemy_1316_wdpjd(_2)` Armed Spy | enemy | same | to read |
| `enemy_1319_wdfmpm(_2)` Instigator | | `enemy_wdfmpm[blockFree]` on unidentified units; `unit_mainline12[detecting]`'s end removes it | |

## Existing layer, to fix rather than build on

- `revealIdentity` is spy-only and nothing calls it.
- `friendly` units are untargetable in `targeting.js`, but civilians are enemy-side prefabs (`_sideTypeIndex` 1) that can be blocked.
- `leak()` pays every civilian the max-DP reward, but only confirmed ones should get it.
- The spy's invincibility and passive civilian mode are missing.

## Plan

1. **Pin.**
   - The global buff and the env system go in `extract-stage-environments.py` (and the env bundle).
   - `wdnjd` and `wdfmr` go in the enemy extractor.
2. **Sight service.** Each environment trigger computes the union of own-side units' current range tiles and devices; a NeverTrigger unit contributes nothing. Use the 0.5 s cadence plus skill start and end, or document a per-tick recompute.
3. **Identification controller.** One state machine with the 0.1 s cadence, two phases and the hostile/friendly outcome, shared by the families.
4. **Contracts.**
   - Re-review `wdnjd` and `wdfmr` against their pinned trees.
   - Gate the environment: a stage is admitted only when every identity unit in it has a re-reviewed contract.
   - First slice: TR-22, 12-2 and 12-2 adverse. Then widen family by family.
5. **Tests.** Literal timings:
   - 15.0 s in sight → phase 2;
   - 10.0 s more → complete;
   - −1 per 0.1 s out of sight;
   - blocked counts without sight;
   - the civilian reward and its max-cost ceiling.
