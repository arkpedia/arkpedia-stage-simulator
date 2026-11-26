# Duq'arael, 'Regent's Crimson', and the Throne of Blood

Duq'arael, 'Regent's Crimson' (PRTS 杜卡雷，“君主之红”) is the boss of 13-21. He has two forms:
- **First form:** `enemy_1547_blord`, ranged Arts.
- **Second form:** `enemy_1547_blord_2`, melee, Arts damage.

The Throne of Blood `trap_127_bldore` (PRTS 沥血王座) is the enemy-side trap he is bound to.

This batch publishes 13-21 and 13-21 adverse (1,173 available; main story 442 of 564). Both use level 0 of both forms.

**Still blocked**
- **H13-3 adverse and H13-4 adverse:** level-1 parameter and skill overrides of both forms (and, on H13-3, an Altar branch).
- **14-20:** an unsupported environment and an operator override.

## Native evidence

**Reviews**
- `shared/arkpedia/stage-blood-throne.js` (`bloodThroneNativeReviewed`): the Throne's prefab, `sktok_bldore`, the Blood Mist and Blood Surge projectiles, and their templates.
- `shared/arkpedia/enemy-blood-lord-features.js` (`bloodLordNative`, `bloodLordTwoNative`): both prefabs, and both records at levels 0 and 1. Level 1 is read over level 0, as the game does; only `HpAuraCtrl.duration` (10) differs.
- `shared/arkpedia/stage-bomb-loader.js` (`bombLoaderLordTriggerReviewed`): the Loading Point's `Blord2Trigger`.
- `data/arkpedia-blood-lord-animations.json`: the clocks of the skeleton both forms share. `A_*` clips belong to the first form and `B_*` clips to the second.

**Extraction changes**
- The device extractor now keeps the Throne, `sktok_bldore` (with its `KillBmbcar` circle), the two projectiles, and the Loading Point's colliders.
- The enemy extractor now keeps both forms and the three projectiles.

**The Throne** (HP 10,000, DEF 2,000, RES 20; HEAL_FREE; side 2, category 2: nothing selects it)
- **Blood Amber:** talent `1` with `trap_bonore_upgraded` held by its Passive. Every 10 s it summons one Blood Amber (`talent@enemy_key`) on its own branch (`talent@branch_id` = the instance's `branch_id`, a random phase).
  - The buff's serialized interval is 5 s; the talent blackboard says 10, as for the Altar.
- **`DseedHpCtrl`:** while the Throne stands, Blood Amber does not lose HP.
- **`sktok_bldore`:** AUTO, 20 SP at 1 SP/s from 15. It releases Blood Mist and lasts until the mist ends.
- **`BlordReborn`:** a global aura that gives the first form `trap_bldore_summon[blord1]`.
  - **Killed:** the timer starts on the Throne (`blordreborn.duration` 40). If the Throne then lives, it runs `SummonEnemiesFollowBranchRoute` on `blordreborn.branch_id` (`blord1`).
  - **The buff ends (the Throne died):** InstantKill.
  - **The boss reaches the exit:** `trap_bldore_block_game` finishes. That is the Throne's `AddGameFinishBlockerByKey`.
- **`KillBmbcar`** (radius 1): `trap_bldore_kill[bmbcar]`. At the explosion's end:
  1. If the Throne still holds the battle, PickRandomBranchPhase on `killbmbcar.branch_id` (`blord2`), blocking the finish.
  2. The Throne dies.
  3. Its Passive's `trap_bldore_finish_current_wave` runs FinishCurrentWave, without next-wave tracking.
- **Blood Surge** (`FountainHint` / `FountainAlarm` / `FountainDamage`): see below. 800 Arts damage without a source (`fountaindamage.value`), stun 5 s.

**Blood Mist** (`projectile_enemy_blord_s[fog]`, `enemy_blord_fog_buffs`)
- **Shape:** radius 1 × `projectile_range` (1.7), for `projectile_life_time` (10 s).
- **Hits:** each unit is hit once (`_maxHitNum` 1, `_hitNumType` 2). Its buffs detach only when the mist stops (`_detachBuffsWhenTargetLeave` 0).
- **Blood Amber** (`enemy_bldore_mark`): `enemy_blord_fog_spawn`. A Bloodborn Spawn appears at the Amber's position and on its route 1 s later, and the Amber leaves at once.
- **Operators:**
  - `enemy_blord_fog_damage`: ASPD from `attack_speed` (−40); every 1 s, starting at once, `BleedingDamagePerSec` Arts from `baseDamage` (50) rising to +`addOnDamage` (150) over `addOnDuration` (10 s).
  - `enemy_blord_fog_respawn`: a card buff of ratio `respawn_time` (×2) when the operator leaves the field, until its next deployment.
  - `enemy_blord2_listener`: below.

**Blood Surge** (`projectile_enemy_blord_s[stun]`)
- **Area:** range `x-5`, the target's tile and the four next to it.
- **Target:** the selector takes an operator holding `enemy_blord_fountain[mark]` (`_secondaryFilter` 3). `FountainMark` gives the mark to every operator, and `enemy_blord_fountain[hit_mark]` finishes it on everyone hit.
- **Timing:** `enemy_blord_fountain[trigger]` runs `FountainDamage` every 5 s for `duration`.

**First form** (30,000 HP; level 1 40,000)
- **BloodFog** (【血霭遮月】; cooldown 25, initial 10; `A_Skill_1`, 6 s, OnAttack 1.43 s): a tile selector with `_alwaysRandomInTheEnd` and `_allowOutRangeTile`. One operator anywhere is chosen; the mist lands on its tile.
- **BldoreMark:**
  - `enemy_blord_mark`: once, 0.5 s in; without `trap_bldore_summon[blord1]`, InstantKill.
  - UNDEADABLE (flag 6).
  - `enemy_blord_fountain_trigger`: `ON_BEFORE_TRY_SET_HP_ZERO` → `TriggerEnemySkill BloodFountain`.
- **BloodFountain** (【血涌濯身】; `A_Skill_2`, 4 s):
  - It targets the Throne (`trap_bldore_fountain_mark`).
  - At its OnAttack (2 s) the Throne gets `enemy_blord_fountain[trigger]` (20 s, every 5 s).
  - He is INVINCIBLE through the clip (`enemy_blord_fountain_invincible`, flag 5), whose end kills him.

**Second form** (100,000 HP, ATK 2,000, DEF 1,000; level 1 120,000 / 2,400 / 1,200)
- **Attack:** `enemy_blord2_extra_damage[timer]` (`attack@duration` 10 s, refreshed by each hit). This is Blood Affliction (【坏血】): the Blood Mist damage template (`waitFirstTriggerInterval`: first tick after 1 s) and its redeployment card buff. PRTS: the forced death and the redeployment penalty do not stack with the mist's.
- **HpAura** (【绯红冠冕】), unless `enemy_blord2_hp_aura[ctrl]`:
  - `damage_resistance[inf]` from `HpAura.damage_resistance` (0.9). PRTS: 90% Sanctuary; the handbook: Physical and Arts.
  - `HpRecover`: attribute 13, +`HpAura.hp_recovery_per_sec` (300), to the other enemies within 1.7.
- **HpAuraCtrl:** every 0.5 s, `enemy_bmbcar_explosion_mark` (the bomb's Explosion puts it on what it hits) finishes. Then the aura is off for `HpAuraCtrl.duration` (15 s; level 1 10 s), and Crimson Edict is interrupted and its summon buff finished.
- **BloodFog2** (【殷红敕令】; cooldown 30, initial 10; `_timeMode` 3; `B_Skill_1_*`):
  - `enemy_blord2_fog[summon]` for `duration` (15 s), `waitFirstTriggerInterval` 0, every `.interval` (5 s): `SummonEnemiesFollowMyRoute` of `.enemy_key` (Blood Amber) after `.delay` (1 s), within `.offset_bound` (0.3) of him.
  - Then Blood Mist. Its selector is the same field-less class as the Throne's mist selector (script `257106927554094637`); PRTS: the unit blocking him, otherwise his own tile.
- **KillBmbcar** (radius 0.5, bombs with `enemy_bmbcar1_passive`): `enemy_blord2_kill[bmbcar]`. The bomb explodes. At the end, unless he is casting BloodFountain2, the bomb's host (its Loading Point) gets `enemy_blord2_kill[mark]` and he casts BloodFountain2.
- **BloodFountain2** (【沉沦之殁】): a switch over three abilities (`Skill_2_1`–`_3`, each 8.5 s, OnAttack 7.37 s), chosen by which trigger buff he holds: the bomb (outside or during Crimson Edict) or a Loading Point.
  - Each gives `enemy_blord_fountain[trigger]` (`duration` 10, `interval` 5): two Blood Surges at ATK × `atk_scale` (0.5), stun `stun` (5 s).
  - Each also gives `enemy_blord2_fountain[outset]` from the clip's start to its OnAttack. At its end, `FountainKillSelector` gives `instant_kill` to every Loading Point marked `enemy_blord2_kill[mark]`.
- **The Loading Point's Blord2Trigger** (radius 2, units with `enemy_blord2_mark`): `trap_outset_blord2[trigger]`. Unless he is casting BloodFountain2, it marks the Point and forces BloodFountain2.

## Runtime

**Blood Mist and Blood Surge** (`server/sim/content/arkpedia-blood-mist.js`)
- **Mist:** a circle that marks each unit once.
  - An Amber touching it leaves, and a Spawn follows its route 1 s later (wave-scheduler summon).
  - An operator gets ASPD −40 and the rising damage. The ticks run 1 s apart from the hit; the tick due at the mist's own end is not dealt. The effect is kept after the operator leaves the circle and ends with the mist.
  - The ×2 redeployment buff is persistent while held, so a knock-out or retreat under it doubles that one redeployment. It is one buff shared with Blood Affliction, so they never stack.
  - A unit already under one mist is not hit by another.
- **Surge round:** hits at interval, 2 × interval, … up to the duration. Each takes a random operator the round has not hit (all operators once every one has been hit) and hits the x-5 cross around its tile.

**The Throne** (`arkpedia-stage-blood-throne.js`, family `bloodThrone`)
- **What it does:** it places the trap, summons Amber, releases its mist, holds the battle, and adopts first forms (`adopt` / `holds`).
- **Calls it answers:**
  - `surge()`: from the first form's cast.
  - `lordKilled()`: a return 40 s later, on `blord1`.
  - `lordExited()`: releases the battle.
  - `bombed()`: from the bomb at the explosion's end. The second form if the battle is still held; then `destroy()`.
- **`destroy()`:** kills the first forms (no return) and releases the current wave (`releaseCurrentWave`).
- **Afterwards,** with no Altar standing, every Blood Amber loses 10% of its max HP each second (`enemy_dseed_hp_loss`, the Amber record's `Passive.hp_ratio`).

**The boss** (`arkpedia-enemy-blood-lord.js`; kinds `bloodLord` and `bloodLordTwo`, dispatched from `skill:BloodFog` / `skill:BloodFog2`; the first form is a `FORM_BOSSES` entry)
- **First form:**
  - The cast roots him.
  - On an HP-zero attempt (`hpZeroAttempt`, with UNDEADABLE holding him at 1 HP) he casts BloodFountain.
  - A first form the Throne has not adopted dies 0.5 s in.
- **Second form:**
  - His attacks deal Arts (`ab.atkType`). The `dealt` hook applies Blood Affliction.
  - The aura: Sanctuary `physTakenMul`/`artsTakenMul` 0.1 on himself; `hpRegen` +300 on the others through `OwnedStageAura`.
  - The 0.5 s explosion check reads damage tagged `bombExplosion`.
  - Crimson Edict and Sunken Death are as reviewed.
  - `e.mem.bloodLordTwo` is the handle the bomb and the Loading Points use.

**The bomb** (`arkpedia-enemy-bombs.js`)
- **Contacts:** besides Altars, it now explodes on the Throne's circle (1 + its own collider 0.1) and on the second form's circle (0.5 + 0.1). Its parameters gain `explosion.collider`.
- **At the explosion's end:** it calls the Throne's `bombed()`, or the second form's `bombed(StageBombLoaders.senderOf(bomb))`.

**The Loading Points** (`arkpedia-stage-bomb-loaders.js`)
- `senderOf`.
- `destroyMarked`.
- **Blord2Trigger:** each entry of the second form within 2 + 0.1 calls `reached`.

**Stage compile**
- **`stage-device-instances.mjs`:** a Throne instance takes `branch_id` only.
- **`stage-branches.mjs`:**
  - Binds the Throne's Amber branch (several phases allowed) and its `blord1` / `blord2`.
  - Checks that each of those is one boss × 1 of the right form.

## Checked

`test/arkpedia-blood-lord.test.js`:
- **Pins:** all reviews pass at both levels. Refused:
  - a faster return;
  - a weaker surge;
  - a wider Throne bomb circle;
  - a Throne that does not hold the battle;
  - a wider Loading Point trigger;
  - a faster mist;
  - a weaker Sanctuary;
  - a wider second-form bomb contact.

  Level 1's aura pause is 10 s.
- **The Throne:**
  - Amber at 10, 20, 30 and 40 s.
  - Mist on its own tile at 5 s and 35 s.
  - It holds the battle.
- **Blood Mist:**
  - ASPD −40.
  - Ten ticks of 50, 65 … 185.
  - The effect and the penalty end with the mist.
  - The Amber leaves at once and a Spawn appears at its spot 1 s later.
  - A knock-out under the mist waits ×2.
- **First form:**
  - Undying.
  - The 4 s invincible cast; Blood Surge 7, 12, 17 and 22 s after the hit.
  - Death at 4 s and return 40 s after death.
- **Bomb at the Throne:**
  - The second form appears, holding the battle.
  - The first form dies with no return.
  - A later first form dies 0.5 s in.
  - Amber decays 10%/s.
- **Exit:** the first form reaching the exit releases the battle, and a bomb then calls no second form.
- **Second form's aura:**
  - Arts taken ×0.1; True damage unchanged; +300 HP/s to a neighbour.
  - An explosion during Crimson Edict ends it, and the aura is off for 15 s.
- **Crimson Edict:** Amber at 1, 6, 11 and 16 s; the mist on his tile at 15.43 s.
- **Sunken Death:**
  - A bomb marks its Loading Point, which dies at 7.37 s.
  - Surges at 5 and 10 s.
  - A second call while casting is refused.
  - A Point within 2.1 marks itself and starts the next cast.
- **Blood Affliction:** ticks 1, 2 and 3 s after the hit; the penalty ends with it.
- **Headless clears:** 13-21 and 13-21 adverse. Bombs held at full SP are sent from 30 s, the Throne falls, and one second form appears and is knocked out.

## Not checked

- In game.
- **Inferences**
  - **The Throne's mist target:** its own tile. The selector class is field-less; PRTS describes the same class on Crimson Edict as blocker-else-self, and the Throne blocks nothing.
  - **The Throne's SP:** it charges only between mists ("the skill lasts until the mist ends"). Mists come at 5 s, then every 30 s.
  - **Two mists:** one does not re-hit a unit already under another; the first one's clock and end hold.
  - **Blood Surge target:** a random un-hit operator; once all have been hit, any operator. The selector requires the mark; PRTS says "prioritizing".
  - **Crimson Edict's timeline:** 15 s of summons (0, 5, 10, 15) and then `B_Skill_1_End` with the mist at its OnAttack. The `Skill_1_Begin` clip's own length (3 s) is read as part of the 15 s.
  - **The bomb's explosion end:** read as the moment `enemy_blord2_kill[bmbcar]` and `trap_bldore_kill[bmbcar]` finish with the bomb still alive, as for the Altar.
  - **Amber decay** after the Throne falls is modelled only on Throne stages. On Altar stages Amber still never decays after every Altar is destroyed; that is an earlier gap.
- **Not modelled:** `enemy_blord2_listener` (death below 0% HP) only matters against effects that keep an operator alive below 0 HP.
