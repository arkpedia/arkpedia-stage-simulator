# Explosives Loading Point and the Anti-Witchcraft bomb

Chapter 13's second mechanism. The player sends a bomb from a Loading Point. Enemies attack it to slow it, operators attack its carrier to drive it, and when it reaches a Bloodcalling Altar it explodes and destroys the Altar.

This batch publishes 13-7, 13-20, their adverse variants, and TR-24. A follow-up the same day (the Boneguard bomb stop, below) publishes 13-10, its adverse variant, and the event stage VEC-SP08 break (1,149 available; main story 424 of 564).

## Explosives Loading Point

`trap_126_outset` (PRTS 炸弹载荷点). Reviewed in `shared/arkpedia/stage-bomb-loader.js` against the pinned prefab, `sktok_outset` and the CN tables.

**The device**
- Side 1 (ally), category 2 (trap), not withdrawable.
- Skill `sktok_outset`: MANUAL, 40 SP at 1 SP/s from 0, cost 10 DP.

**Casting**
- It can only cast while the Point does not carry `trap_outset_hascar`.
- The cast's `trap_outset_s[summon]` runs `SummonEnemiesFollowBranchRoute`: unharmful, always counted as killed, not managed by the scheduler. The route is the Point's own branch, set per instance by `branch_id`.
- The bomb gets `trap_outset_mark`, whose derived `trap_outset_hascar` sits on the Point while the bomb lives. So it sends one bomb at a time.

**Runtime** (`server/sim/content/arkpedia-stage-bomb-loaders.js`)
- It uses the same `error` / `activate` API as the manual devices, and the device panel routes to it.
- `StageBranchScheduler.summonUnharmful` spawns the bomb uncounted, never holding the battle, and costing nothing at an exit.

## The bomb and its carrier

`enemy_1369_bmbcar1` and `enemy_1370_bmbcar2` (PRTS 反巫术变位炸弹, main body and 副体). Reviewed in `shared/arkpedia/enemy-bomb-features.js`, which pins:
- every component reachable from both prefabs;
- six templates;
- the `Explode` clip from `refs/arts/enm_art_14.ab`: 2 s, with OnAttack at 1.13 s.

**The bomb**
- `_sideTypeIndex` 2, so neutral. Record taunt 1; unblockable, UNBALANCE_IMMUNE; it never attacks.
- Enemies' ordinary selectors take it. Its taunt 1 puts it before taunt-0 operators. This uses the same neutral-target rule as Talulah, the Fighter; see `docs/ENEMY-TALULAH-FIGHTER-REVIEW.md`.
- Operators never select it.

**SP and movement**
- SP starts at 0 out of 10. The cap of 10 comes from PRTS: it is the speed meter's full scale.
- `enemy_bmbcar1_passive`, every 0.1 s: speed = base 0.4 × SP × 0.1 (`FINAL_SCALER`).
- At 0 SP, `MoveBackwards` (SP ratio 0) makes it UNMOVABLE.
- Each damage instance on the bomb costs 1 SP (`sp[self]`).

**The carrier**
- Side 1 (enemy). It follows the bomb, is never counted, and holds nothing.
- Its flags: ALLY_TARGET_FREE, UNDEADABLE, ELEMENT_FREE_ALL, UNBALANCE_IMMUNE; immune to stun, freeze, levitate and sleep.
- Every hit on it is cancelled (`enemy_bmbcar2_sp[add]`) and gives the bomb +1 SP.
- `sp[ctrl]`, every 1 s: after 3 s without a carrier hit the bomb loses 1 SP a second; after 6 s, 2 a second.

**Explosion**
- **Trigger:** the Altar's `KillBmbcar`, a radius-1 trigger circle, now pinned in the Altar review, forces the cast. The circles overlap once the centres are within 1 + 0.1, the bomb's own collider radius. In 13-7 the track ends exactly 1.0 from the Altar, so the overlap is what fires it.
- **The cast:** INVINCIBLE through the 2 s clip. At 1.13 s, every hostile enemy within its 1.7 attack radius takes ATK × 10 True damage (5,000).
- **At the cast end:** `trap_bonore_kill[bmbcar]` runs the Altar's `ActiveOutset`. Its `ActivePredifinedInst` names no alias on any reviewed stage, so it activates nothing; then the Altar dies. The bomb then leaves, and its carrier with it.

**Who reaches the bomb**
- Melee enemies only hit their blocker, and nothing blocks it.
- The Bombardier's delayed blast (`bombard`) now hits opted-in neutral units in its radius.
- The Flayer goes through the ordinary attack.

## Boneguard bomb stop

Sarkaz Boneguards (`enemy_1363_spnshd`, `_2`), `talent:BmbcarBuff`. Reviewed in `boneguardBombStopNative`, against the pinned `BmbcarBuff` components.

**The aura**
- A trigger circle of radius `BmbcarBuff.range_radius` (1).
- Its validator admits only units carrying `enemy_bmbcar1_passive`, which are the bombs.
- It puts `enemy_spnshd_bmbcar_buff` on them: UNMOVABLE (flag 13), with no modifiers, removed when the target leaves or the ability detaches. PRTS: "Prevents <Anti-Witchcraft Repositionable Bombs> from moving when nearby."

**Runtime (`bombStopAura`)**
- Bombs whose collider overlaps the circle (centres within 1 + 0.1) are held in place.
- Leaving the circle releases them, and so does the Boneguard's death.
- The bomb's own SP and decay continue meanwhile.

The aura was previously admitted as inert, because no bomb stage had been built. Its stages are no longer blockers.

## Other changes

- **Altar branches with several phases.** In 13-7 and TR-24 each Altar branch has 3 phases. `PickRandomBranchPhase` with `_notRepeatInOneLoop` picks a random phase, seeded by the battle RNG, without repeating until all have run (`StageBranchScheduler.startRandomPhase`). The branch compiler accepts several phases only for Altar-bound branches.
- **Sub-tile route offsets.** The branch compiler now drops spawn offsets, spawn jitter and reach offsets under half a tile, as `originalRoute` does for every wave route: 13-7 −0.15; 13-20 a 0.2 random range; TR-24's bomb track −0.33. Randomized reach offsets and reach distances are still refused.
- **Altar guard.** The Altar's unmodelled-reaction guard moved into the inventory, as a "Bloodcalling Altar" blocker.

## Checked

`test/arkpedia-bomb.test.js`:
- **Pins:** the reviews pass and refuse each of these: a cheaper or harmful bomb, a faster bomb, a slower decay, and another tree.
- **13-7, before it moves:**
  - the Point is ready at 40 s and costs 10 DP; a second bomb is refused while the first lives;
  - the bomb is neutral, uncounted and taunt 1;
  - at 0 SP it does not move.
- **13-7, SP:** a carrier hit is cancelled and adds 1 SP, capped at 10. Damage on the bomb costs 1. Charged, it moves.
- **Decay** (13-7, kept out of enemy selection): nothing for 3 s, then 1/s, then 2/s from 6 s.
- **Explosion** (driven by a hit every 0.9 s):
  - it fires within 1.1 of the Altar and the bomb is INVINCIBLE;
  - the hits are True, at the 1.13 s release, on enemies;
  - the Altar dies and pulses no more;
  - the bomb and carrier leave, and the Point can send the next one.
- **Targeting:** a Bombardier next to the bomb ranks it first.
- **Victory:** with every counted enemy dead and a bomb parked, the battle clears.
- **Random phases:** three conversions in TR-24 take three different phases.
- **Boneguard stop:** a charged bomb 1.05 from a Boneguard does not move, and moves again once the Boneguard dies.
- **Headless 13-7:** the Point is ready at 40 s, the bomb waits, then after hits it explodes at 72.5 s, 2.9 rows from its start. It deals 5,000 True to three Bombardiers, the Altar falls, and the stage clears.

## Not checked

- In game.
- **Inferences**
  - The maximum SP of 10 comes from PRTS.
  - The bomb's 0.1 collider comes from the prefab's root collider, which the extraction does not retain.
  - At equal taunt, neutral units rank after deployed operators.
  - The explosion's "attack radius" is the record's 1.7, since its selector collider is 1 with `_scaleble`.
- Sub-tile route offsets are dropped.
- Art: the device panel lists the Point; the bomb uses its enemy art.
