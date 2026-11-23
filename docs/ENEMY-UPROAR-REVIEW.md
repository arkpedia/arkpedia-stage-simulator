# Uproar (`enemy_8015_mcnrhd`)

An elite Physical attacker: 30,000 HP, 1,500 ATK, 1,200 DEF, 60 RES, range 1.3, speed 0.6, weight 4, with Rebirth. It was the last enemy blocker of VEC-10 "Welcome Contingent" and VEC-SP16 (the latter also needed the Kazdel fire elemental).

It is admitted from its pinned CN prefab. `shared/arkpedia/enemy-uproar-features.js` holds the contract. It pins:
- the record (talents `special` and `reborn`, skill `multiAttack`);
- every component reachable from `Attack`, `multiAttack`, `special`, `reborn`, `rest` and `rest_end`;
- the template `enemy_mcnrhd_damage`;
- the six parts of `projectile_enemy_mcnrhd_skill`;
- the clips from `refs/arts/enm_art_22.ab`: Attack 2 s (hit at 1.1 s), Skill 3 s (release at 2.233 s), Die_End 0.667 s.

The runtime is `server/sim/content/arkpedia-enemy-uproar.js`, kind `uproarArrowRain`. The Rebirth is the shared `reborn` kind: `talent:reborn` (`enemy-features.js`) now accepts Uproar through this contract, because its `duration_rest` is unique.

## Damage reduction and arrow rain

1. **While unblocked.** A block checker (minimum −1, maximum 0, as on Mateo's Guards) holds `enemy_mcnrhd_damage`, applied through the `sanctuary` status. Physical and Arts damage is cut by `special.damage_resistance` (0.8), to 20%. True damage is unaffected, and blocking removes the buff.
2. **Trigger.** On each Physical or Arts hit taken, the buff runs `TriggerEnemySkill multiAttack` on the damage source, interrupting the current action, if the skill is ready. Its cooldown is 4 s, initial 0. The wrapper's `_ignoreSilence` is 0, so silence prevents it, and a stunned Uproar cannot cast.
3. **Cast.** The Skill clip plays: 3 s, with the release at 2.233 s. The projectile arcs at speed 5 to the source, follows it, then waits 0.3 s after reaching it (`_delayAfterReached`). On stopping, it hits every ground operator (target motion 1) within `projectile_range` 1.5 plus the operator collider. Each takes `atk_scale` 1.2 × ATK Physical and `enemy_mcnrhd_attack_speed` (−50 ASPD for 10 s).
   - The loaded range's collider is 1 and not scalable, as for Mateo's Guards, whose review settled on the blackboard radius.
   - The flight time is read as straight-line distance ÷ 5; the arc's extra length is not modelled.

## Rebirth

`reborn` runs the `rest` loop (`duration_rest` 5 s, Die_Begin/Die_Loop) and then `rest_end` (the Die_End clip, 0.667 s). That makes `reborn.duration` 5.667 s, after which Uproar returns at full HP. The generic rebirth does exactly that.

## Verification

`test/arkpedia-uproar.test.js`:
- **Admission.** Admitted; each of these is refused:
  - a damage template without the trigger;
  - a projectile without its 0.3 s landing delay.
- **Reduction.** Unblocked, Physical and Arts damage is cut to 20%, and True is unchanged. Truly blocked, the reduction is off.
- **Arrow rain.**
  - An operator's hit starts the Skill clip; a second hit inside the cooldown does not.
  - Nothing lands before release + flight + 0.3 s.
  - Then the shooter and an operator next to it take 1.2 × ATK Physical and the ASPD debuff; one three tiles away does not.
  - A hit after 4 s casts again.
- **Rebirth.** The first knock-out holds for 5.667 s, then full HP; the second knock-out kills.
- **Compiled stages.** VEC-10 and VEC-SP16 field Uproar at its stage stats, with no battle errors.

The library rebuild published VEC-10 and VEC-SP16 (1,046 available); no other stage's bundle changed. `check-stage-library.mjs` smoked all 1,046 graphs with no failures. Browser review: the original art loads from asset commit `82681c57` and the stage runs. The arrow rain was not triggered there: the squad's only easy deploy beside Uproar's lane was a melee blocker, which turns the reduction off. It is covered by the tests.

## Boundaries

- **Effects.** `enemy_mcnrhd_skill_*` and `enemy_mcnrhd_revive_*` are not played. The rest clips are not switched in the viewer.
