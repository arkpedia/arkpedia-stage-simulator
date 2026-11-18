# Talulah

`enemy_1503_talula` has two database levels with the same talents and skills:
- level 0: 50,000 HP, 1,500 ATK, 700 DEF, 50 RES; used by JT8-2 and JT8-2 Challenge;
- level 1: 60,000 HP, 1,800 ATK, 700 DEF, 50 RES; used by H8-2.

She is admitted from her pinned CN prefab and the Global buff templates. Her extraction scope is new, together with `projectile_enemy_talula`; only her prefab changed.

`shared/arkpedia/enemy-talulah-features.js` pins:
- every component reachable from her abilities (58, across her two modes: Default and HalfState);
- two templates and her projectile;
- the clip clocks from `refs/arts/enm_art_16.ab`:
  - Attack_1: 2 s, strike at 1 s;
  - Attack_2: 2.33 s, strike at 1.33 s;
  - Skill_1: 2 s, release at 1 s;
  - Skill_2: 3.67 s, release at 2.57 s.

The runtime is the new `talulah` kind, attached through `talent:halfhp`, which claims her four skill wrappers. No shared key is involved.

"Talulah, the Fighter" (`enemy_3002_ftrtal`) is a different record: a neutral unit that attacks the Ursus enemies. It waits on the parked allied-route-actor concept and is not part of this batch.

The rules not fixed by the data come from PRTS (`塔露拉(敌方)`).

## Kit

- **Attacks.** Range 2.5. While unblocked, a speed-10 projectile deals 40% ATK as Arts damage (Attack, `_atkScale` 0.4). While blocked, the blocker takes 100% ATK as true damage (Combat).
- **Burning Breath (`DragonFire`).** Cooldown 19 s, first at 19 s. The trigger has no collider, so it takes one operator anywhere on the field that does not already carry `dragon_fire` (the selector excludes it); among those, the engine's normal target order decides.
  - The Skill_1 clip releases at 1 s.
  - The burn lasts 30.5 s. Every second it deals true damage that rises linearly from 50 to 230 over 30 s (`dragon_fire[damage]`: `BleedingDamagePerSec`, increasing to its cap).
  - Resistance shortens it: the engine's resist value cuts the duration; the tick interval and the ramp stay fixed.
- **Stellar Corona (`DanceFire`).** Cooldown 40 s, first at 40 s, priority 1, so it goes first when both are ready. It needs an operator within 2.5. At the Skill_2 release (2.57 s) every operator within 2.5 takes 100% ATK as Arts damage.
- **Casts.** She stands through each skill clip and does not attack meanwhile. The cooldowns run from the cast start.
- **Enrage.** Below half HP (`HalfHp`, the record's `halfhp.hp_ratio`), she switches to HalfState: DEF +100% and RES +80% (MULTIPLIER items), and the [Half] skills, each from its own initial cooldown (Burning Breath 7 s, Stellar Corona 15 s).

## Stage overrides

- **JT8-2.** The map keeps only Stellar Corona, at priority 0 instead of 1, first at 160 s instead of 40 s. Stage skill overrides may now change a tie priority when a reviewed feature declares it (`stageSkillPriorityOverrides`). Talulah declares exactly this list, priority and timing.
- **JT8-2 Challenge.** Its `enemy_talent_blackb_mul` doubles `halfhp.hp_ratio` to 1.0, so she is enraged from the start. The enraged mode uses only the [Half] skills, which the stage list removed, so she casts no skill there. This follows the data and is worth an in-game check.

## Verification

`test/arkpedia-talulah.test.js`:
- **Admission.** Both levels are admitted. Each of these is refused: a changed enrage DEF, a changed Burning Breath cooldown, and a melee that is not true damage. The JT8-2 list and its Challenge multiplier are admitted; another priority or another subset is refused.
- **Attacks.** An unblocked Arts shot; a blocked true strike for 100% ATK.
- **Burning Breath.** It first casts at 19 s. The first tick is 56, the burn reaches 230, and the next cast picks the other operator.
- **Corona and enrage.** Corona goes first by priority and hits only the operator within 2.5. Below half HP her DEF doubles, her RES is ×1.8, and the [Half] Burning Breath comes 7 s later.
- **JT8-2.** Corona first at 160 s. On the Challenge she is enraged at full HP and casts nothing.
- **Compiled stages.** With a Myrtle beside her:
  - H8-2 (level 1, 60,000 HP): Burning Breath at 19 s.
  - JT8-2 (50,000 HP): Corona at 160 s.
  - JT8-2 Challenge (55,000 HP): enraged, no casts.
  - No battle errors on any of them.

The library rebuild published exactly three more stages: H8-2, JT8-2 and JT8-2 Challenge (1,016 available). No other stage's bundle changed. `check-stage-library.mjs` smoked every graph with no failures, the browser review passed, and H8-2 runs in the preview with no console errors.

## Boundaries

- **Burn wiring.** The prefab gives `dragon_fire` the `empty` template. The damage comes from the buff-by-id definitions (`dragon_fire[timer]`, `dragon_fire[damage]`), which her prefab does not reference, so they are not pinned. Their numbers come from the skill blackboard, and they agree with PRTS.
- **Burning Breath target.** `_postFilter` 4 is not modelled; the engine's normal target order picks among the operators not already burning.
- **Burn refresh.** The selector never picks a burning operator, so a refresh does not occur in practice.
- **Enrage threshold.** At a ratio of 1.0 the threshold is met at full HP.
- **Presentation.** The skill effects are not reproduced.
