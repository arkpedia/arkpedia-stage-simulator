# Bloodcalling Altar

`trap_125_bonore` (PRTS 唤血祭坛, Global "Bloodcalling Altar") is chapter 13's device. Every 20 s it sends out a pulse, and the pulse turns Blood Amber (`enemy_1367_dseed`, left behind by Bloodborn Spawn and Sarkaz Boneguards) into new Bloodborn Spawn (`enemy_1360_dfello`).

This batch publishes 13-12 and 13-12 adverse (1,141 available). Their only blockers were this device and its branches.

The pulse also reacts to other units: Bone Drifters (`enemy_1365_spnwiz`), Blood Collectors (`enemy_1366_dcolle`), the bomb carts (`enemy_1369_bmbcar1`) and Sarkaz pilots (`enemy_1368_spilot`). The bomb (`docs/STAGE-BOMB-REVIEW.md`) and the Blood Collectors (`docs/ENEMY-BLOOD-COLLECTOR-REVIEW.md`: the pulse turns each Amber a Collector holds into a Bloodborn Spawn and leaves it empty) are now built. The Bone Drifter and pilot reactions are not: the runtime refuses a stage with an Altar and either of those records, so no stage silently runs without them. The other chapter-13 stages also need the Bomb Loading Point and those enemies.

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
- **Movement:** speed 8, lifetime 10 s. It turns to its travel, so its 3 × 1 box is 3 long along the travel and 1 wide.
- **Hit checks:** every 0.03 s (`_hitPasserby`).
- **Selector:** enemy-side units, ground and air, carrying `enemy_bonore_mark`, up to `max_target`.
- **One hit:** `_maxHitNum` 1, then it stops.

**`trap_bonore_s` on each hit unit** (not a drifting Bone Drifter)
- It counts the unit's `enemy_bonore_mark` stacks into `buff_cnt` and finishes the mark. For Blood Amber, `enemy_dseed_bonore[action]` then kills it.
- It stacks `trap_bonore_branch[dfello]` that many times (up to 10).
- Each stack runs `PickRandomBranchPhase` on the Altar's branch, with `_blockGameFinish` false. 13-12's branches each have one phase, which spawns one Bloodborn Spawn on its route.

Not modelled, because none of these appear in 13-12:
- the event upgrade (`trap_bonore_upgraded[summon]`);
- the bomb-cart kill within radius 1;
- the Bone Drifter switches;
- the pilot summon;
- `ActiveOutset` (its forced exit when a bomb is detonated on it).

## Runtime

`server/sim/content/arkpedia-stage-blood-altars.js` places each Altar as an enemy-side device that nothing can target or damage. It charges 1 SP/s.

**Firing:** at 20 SP, with no pulse already out, it launches a pulse along its facing. Rows count from the bottom, so DOWN is −row.

**Contact:** every 0.03 s the pulse checks its box for Blood Amber (centre within ±1.5 along and ±0.5 across). On the first contact:
- it kills up to 10 of them, nearest to the Altar first;
- it runs the Altar's branch once per Amber;
- it ends.

**Expiry:** a pulse that leaves the map or reaches 10 s ends with nothing.

Instances compile through `bloodAltarDefinition`, whose device-runtime family binds each instance's `branchId`. `stage-branches.mjs` now binds each Altar's branch the way it does for the Stagnant Contraption's.

## Checked

`test/arkpedia-blood-altar.test.js`:
- **Pins:** the review passes and refuses each of these: a slower pulse, a wider box, two hits, a branch that holds the end, a faster charge, and an instance without a branch.
- **13-12 setup:** two Altars, at (6,4) facing DOWN and (4,9) facing LEFT, each on its own branch; enemy side, untargetable.
- **First pulse:** before 20 s nothing happens. At about 20.3 s the first pulse hits the two Amber sharing (4,4), and two Bloodborn Spawn appear on the branch. The Amber a tile further on survives, because the pulse has stopped, and the 40 s pulse takes it. An Amber off both lanes is untouched.
- **Cap:** a pile of 12 Amber loses exactly 10.
- **Refusal:** an Altar stage containing a Sarkaz pilot is refused.
- **Headless run:** 13-12 clears with both Altars pulsing every 20 s.

## Not checked

- In game.
- **Inferences**
  - The pulse starts at the Altar's centre. The skill object sits one unit ahead, which may be a mount offset.
  - It travels along the facing. The ability aims at a tile filter (type 12) whose rule is not decoded; PRTS says the model's facing gives the direction.
  - Contact is the unit's centre inside the box, not its collider.
  - With several Amber hit, the nearest to the Altar go first.
- Blood Amber keeps its existing behaviour: it walks its route and costs a life point if it leaks. Its HP decay (`enemy_dseed_hp_loss`) is suppressed by the Altar's `DseedHpCtrl`, so its current no-decay model is right on Altar stages.
