# 'Gravestone' (`enemy_2008_flking`)

An Integrated Strategies boss: 60,000 HP, 2,000 ATK, 330 DEF, 55 RES, speed 0.5, weight 6, applyWay ALL, silence-immune. It alone blocked the ISW-DF stage "Avoid Unsafe Roads" (`isw-df_level_obt_roguelike_ro2_level_rogue2_b-10`).

It is admitted from its pinned CN prefab. `shared/arkpedia/enemy-gravestone-features.js` holds the contract. It pins:
- the record (talent `atkdown`, skill `refreshshield`);
- every component reachable from both modes' `Attack`, `Combat`, `Combat1`, `Combat2` and `Trigger`, plus `RefreshShield`, `AtkDown`, `Ignite` and `PassiveEffect`;
- the templates `enemy_flking_ranged`, `enemy_flking_shiled`, `shield_all`, `switch_mode_restart_fsm` and `empty`;
- `projectile_enemy_flking`;
- the Attack_1, Attack_2, Attack_3 and Skill clips from `refs/arts/enm_art_17.ab`.

The runtime is `server/sim/content/arkpedia-enemy-gravestone.js`, kind `gravestone`. The native claims match the counts (one wrapper, one active ability).

## Abilities

1. **Shell (unblocked).** A trigger of fixed radius 2.25 fires Attack_1: 1.4 s, release 0.633 s. It launches `projectile_enemy_flking`: speed 5, lifetime 10, a 3 × 3 box splash on arrival that reaches ground and air. That is the shape of the Cannoneer's power shell, and it reuses `projectileBoxAttack`. `AtkDown` keeps `enemy_flking_ranged` on Gravestone: AtkScaleUp `atk_scale` 0.4 on RANGED damage, so the shell deals 0.4 × ATK.
2. **Melee (blocked).** Combat picks Combat1 (Attack_3) or Combat2 (Attack_2). Both strike the blocker for ATK Physical, and both clips are 1.1 s with the hit at 0.433 s, so the pick (`_selectMethod` 0, not decoded) only changes the clip shown.
3. **Barrier (`refreshshield`).** Cooldown 30 s, initial 10 s; silence and stun stop it. It plays the Skill clip (0.933 s). At the event (0.3 s), `enemy_flking_shiled` ends the previous `flking_shield[core]` and starts a new one: `shield_all`, `hp_ratio` 0.1 × max HP, absorbing every damage type until spent. Barriers are replaced, not stacked.
4. **Ignite.** At ≤ 90% HP a toggle switches to mode 1. Mode 1's attacks are identical. Its only change is a Move → Move_Ignite replacement, and the skeleton has no Move_Ignite clip, so the contract requires that the clip is absent and the switch is not modelled.
5. **The first handbook line belongs to the stage.** The stage's `char_attribute_mul` rune halves operator ATK and DEF, `char_respawntime_mul` doubles redeployment, and `costIncreaseTime` 2 halves DP regeneration; none of it is in the prefab. The compiled stage carries all three, and the test checks them.

## Verification

`test/arkpedia-gravestone.test.js`:
- **Admission.** Admitted; a ranged scale applied to every attack is refused. The parameters are 0.4, 0.1, 30 and 10.
- **Shell.** Unblocked, it deals 0.4 × ATK Physical to the target and to a unit inside the 3 × 3 box, and nothing to one three tiles away.
- **Melee.** Blocked, it deals full ATK to the blocker every 3.5 s.
- **Barrier.** None before 10.3 s, then 10% of max HP. It absorbs damage and is replaced (one instance) 30 s later.
- **Compiled stage.** Gravestone at its stage stats with no battle errors. The stage carries ATK and DEF × 0.5, redeployment × 2 and one DP per 2 s.

The library rebuild published that stage (1,048 available); no other stage's bundle changed. `check-stage-library.mjs` smoked all 1,048 graphs with no failures. Browser review: Gravestone enters with its original art from asset commit `767ec254`, and DP rises at +0.5 a second.

## Boundaries

- **Effects.** The `flking_effect[a-d]` markers and the barrier effects are not played.
