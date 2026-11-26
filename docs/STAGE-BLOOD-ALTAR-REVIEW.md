# Bloodcalling Altar

`trap_125_bonore` (PRTS 唤血祭坛, Global "Bloodcalling Altar") is chapter 13's device. Every 20 s it sends out a pulse, and the pulse turns Blood Amber (`enemy_1367_dseed`, left behind by Bloodborn Spawn and Sarkaz Boneguards) into new Bloodborn Spawn (`enemy_1360_dfello`).

This batch publishes 13-12 and 13-12 adverse (1,141 available). Their only blockers were this device and its branches.

The pulse also reacts to other units: Bone Drifters (`enemy_1365_spnwiz`), Blood Collectors (`enemy_1366_dcolle`), the bomb carts (`enemy_1369_bmbcar1`) and Sarkaz pilots (`enemy_1368_spilot`). The bomb (`docs/STAGE-BOMB-REVIEW.md`) and the Blood Collectors (`docs/ENEMY-BLOOD-COLLECTOR-REVIEW.md`: the pulse turns each Amber a Collector holds into a Bloodborn Spawn and leaves it empty) are now built. The Boneguard Fluxcasters (`docs/ENEMY-BONEGUARD-REVIEW.md`) and Commander Ulšulah, the pilot (`docs/ENEMY-PILOT-REVIEW.md`: she upgrades an Altar so it makes Blood Amber, and returns through one when killed), are built too. `BLOOD_ALTAR_UNMODELLED` is empty.

## Native evidence

`shared/arkpedia/stage-blood-altar.js` (`bloodAltarNativeReviewed`) checks three pinned prefabs:
- `trap_125_bonore` (`pkgrps/btl_pfb_tokens_1.ab`);
- `sktok_bonore` (`battle/prefabs/[uc]skills.ab`);
- `projectile_trap_bonore` (`battle/prefabs/[uc]projectiles.ab`).

It also checks two CN buff templates and the CN tables.

**The Altar**
- Side 2 (enemy), category 2 (trap).
- No character selector takes category 2, so nothing can attack it. Its 5,000 HP, 2,000 DEF and 20 RES never come into play.
- HEAL_FREE. Not withdrawable.

**Skill `sktok_bonore`**
- AUTO, 20 SP at 1 SP/s from 0, so a pulse every 20 s.
- Its ability fires `projectile_trap_bonore` with `trap_bonore_s` as its hit buff.
- Blackboard: `talent@branch_id`, which each instance overrides (13-12: `bonore_dfello1`, `bonore_dfello2`); `talent@enemy_key` `enemy_1367_dseed`; `max_target` 10.

**The pulse**
- **Movement:** speed 8, lifetime 10 s.
- **Footprint:** its box is 3 × 1. It is read as a wave front 3 tiles across the travel and 1 along it, so a pulse sweeps the Altar's lane and the lane either side (corrected 2026-11-25; it was first read as 3 along and 1 across). Two sources support it:
  - the Altar's own range validators (`SpnwizInRange`, `SpnwizInRange2`) take the Altar's line and one line either side (`_offset` 1), from the Altar's tile onward (`_includeSameLine` 1);
  - PRTS describes the affected range as what the pulse sweeps and draws it three lanes wide.
- **Hit checks:** every 0.03 s (`_hitPasserby`).
- **Selector:** enemy-side units, ground and air, carrying `enemy_bonore_mark`, up to `max_target`.
- **One hit:** `_maxHitNum` 1, then it stops.

**`trap_bonore_s` on each hit unit** (not a drifting Boneguard Fluxcaster, which it revives instead; `docs/ENEMY-BONEGUARD-REVIEW.md`)
- It counts the unit's `enemy_bonore_mark` stacks into `buff_cnt` and finishes the mark. For Blood Amber, `enemy_dseed_bonore[action]` then kills it.
- It stacks `trap_bonore_branch[dfello]` that many times (up to 10).
- Each stack runs `PickRandomBranchPhase` on the Altar's branch, with `_blockGameFinish` false. 13-12's branches each have one phase, which spawns one Bloodborn Spawn on its route.

Not modelled, because none of these appear in 13-12:
- the upgrade (`trap_bonore_upgraded[summon]`; built since, with the pilot);
- the bomb-cart kill within radius 1;
- the Boneguard Fluxcaster switches (built since; `docs/ENEMY-BONEGUARD-REVIEW.md`);
- the pilot summon (built since; `docs/ENEMY-PILOT-REVIEW.md`);
- `ActiveOutset` (its forced exit when a bomb is detonated on it; built since, see Instance shapes below).

## Runtime

`server/sim/content/arkpedia-stage-blood-altars.js` places each Altar as an enemy-side device that nothing can target or damage. It charges 1 SP/s.

**Firing:** at 20 SP, with no pulse already out, it launches a pulse along its facing. Rows count from the bottom, so DOWN is −row.

**Contact:** every 0.03 s the pulse checks its box for Blood Amber (centre within ±0.5 along and ±1.5 across). On the first contact:
- it kills up to 10 of them, nearest to the Altar first;
- it runs the Altar's branch once per Amber;
- it ends.

**Expiry:** a pulse that leaves the map or reaches 10 s ends with nothing.

Instances compile through `bloodAltarDefinition`, whose device-runtime family binds each instance's `branchId`. `stage-branches.mjs` now binds each Altar's branch the way it does for the Stagnant Contraption's.

## Instance shapes (2026-11-26)

`compileAltarBlackboard` (`tools/arkpedia/stage-device-instances.mjs`) accepts only these keys in an Altar's instance blackboard:
- **`branch_id`:** required, and at most twice.
  - **13-8 names two** (`bonore_dfello1`, then `bonore_dfello2`), both starting in front of the Altar and ending at different exits. Nothing reviewed says how the game resolves a repeated key; the last one is read as winning [inference]. The other branch is still bound and never runs.
- **`SummonSpilot.branch_id` and `talent@branch_id`:** Commander Ulšulah's keys (`docs/ENEMY-PILOT-REVIEW.md`).
- **`ActiveOutset.alias`:** names exactly one hidden Bomb Loading Point on the Altar's own tile (13-11, 13-15 and 13-16).
  - **The native chain (pinned):** the bomb's `trap_bonore_kill[bmbcar]` ends by triggering `ActiveOutset`; its `trap_bonore_active_outset` runs `ActivePredifinedInst` with an empty `_instAlias` (read from that blackboard key), then `InstantKill` on the Altar.
  - **PRTS:** a Loading Point may appear in a set place when the Altar is forced out by a bomb.
  - **Runtime:** `destroy()` kills the Altar, then `StageBombLoaders.reveal(alias)` places that Loading Point at 0 SP. The device runtime binds it as `outsetAlias?`, and Loading Points are built before Altars.

**A branch the level lacks** (13-19's `bonore_dfello1` and `bonore_dfello2`) is accepted with no binding, only where no pulse can need it. Two checks refuse it otherwise:
- **the inventory** refuses it on a stage with any record in `BLOOD_ALTAR_BRANCH_USERS` (Blood Amber, Bloodborn Spawn, Blood Collectors, the pilot);
- **the runtime** refuses it in the same case, and a pulse that would need the missing branch throws.
13-19 has only Fluxcasters, whose pulse reaction runs no branch.

These shapes open 13-8, 13-11, 13-15, 13-16, 13-19, their adverse variants and H13-1 adverse (1,171 available; main story 440 of 564). They are tested in `test/arkpedia-blood-altar-instances.test.js`:
- the pins refuse a fixed alias and an Altar that survives;
- on 13-11 the Loading Point is revealed and sends a bomb;
- on 13-8 the pulse runs the last branch's route;
- on 13-19 the stage is refused once Amber is added;
- six headless clears (the Altars are destroyed at 600 s, standing in for the bombs).

## Checked

`test/arkpedia-blood-altar.test.js`:
- **Pins:** the review passes and refuses each of these: a slower pulse, a wider box, a one-lane range validator, two hits, a branch that holds the end, a faster charge, and an instance without a branch.
- **13-12 setup:** two Altars, at (6,4) facing DOWN and (4,9) facing LEFT, each on its own branch; enemy side, untargetable.
- **First pulse:** before 20 s nothing happens. Just after 20 s the first pulse hits the two Amber sharing (4,4) and the one beside them in a side lane, (4,5), and three Bloodborn Spawn appear on the branch. The Amber two tiles further on survives, because the pulse has stopped, and the 40 s pulse takes it. An Amber off both Altars' three lanes is untouched.
- **Cap:** a pile of 12 Amber loses exactly 10.
- **Refusal:** an Altar stage containing Commander Ulšulah, whose Altars name no pilot branch, is refused.
- **Headless run:** 13-12 clears with both Altars pulsing every 20 s.

## Not checked

- In game.
- **Inferences**
  - The pulse starts at the Altar's centre. The skill object sits one unit ahead, which may be a mount offset.
  - It travels along the facing. The ability aims at a tile filter (type 12) whose rule is not decoded; PRTS says the model's facing gives the direction.
  - The footprint (3 across, 1 along), above. The projectile turns to its target (`_rotateToTarget`) but also sets `_freezeRotationZ`, so which box axis leads is not settled by the prefab alone.
  - Contact is the unit's centre inside the box, not its collider.
  - With several Amber hit, the nearest to the Altar go first.
- Blood Amber keeps its existing behaviour: it walks its route and costs a life point if it leaks. Its HP decay (`enemy_dseed_hp_loss`) is suppressed by the Altar's `DseedHpCtrl`, so its current no-decay model is right on Altar stages.
