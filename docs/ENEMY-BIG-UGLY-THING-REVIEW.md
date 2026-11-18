# 'The Big Ugly Thing'

`enemy_1512_mcmstr` has two database levels:
- level 0: 40,000 HP, 500 ATK, 1,000 DEF; used by RI-8;
- level 1: 60,000 HP, 700 ATK, 1,200 DEF; used by RI-EX-8 and its Challenge.

He is admitted from his pinned CN prefab and the Global buff templates. His extraction scope is new in `extract-enemy-native-abilities.py`; only his prefab changed.

`shared/arkpedia/enemy-big-ugly-thing-features.js` pins:
- every component reachable from the retained abilities (41, across his two modes);
- four templates (`enemy_mcmstr_t`, `periodic_damage_without_modify_no_fx`, `switch_mode_restart_fsm`, `empty`);
- his projectile;
- the clip clocks from `refs/arts/enm_art_16.ab`.

The runtime is the new `bigUglyThing` kind, attached through `talent:bird_run`, which both levels carry. That feature claims the two skill wrappers (CutTree and `bomb[reborning]`) and the two active abilities (the machine's effect buffs). The shared keys defer to his contract: `ability:First Form` and `talent:reborn` (form bosses), `talent:combat`, and Shredder's `skill:cuttree`.

The rules not fixed by the data come from PRTS (`“巨大的丑东西”`).

## Machine form

- **Ranged shot (unblocked).** One ground operator within 2.5 (the attack trigger's collider). The speed-8 projectile deals 100% ATK Physical to the target, and its 3×3 box deals the same as splash damage to every operator on the eight surrounding tiles, flying ones included. Attack_2: 1.5 s, strike at 0.70 s; attack interval 4 s.
- **Melee (blocked).** The blocker takes `combat.attack@mcmstr_rage_attack.atk_scale` × ATK Physical: 300%, or 350% on level 1. Attack_1: 1.5 s, strike at 0.57 s.
- **Cut.** Cooldown 30 s, initial 30 s, running from the start of each cast. It needs a Giant Mushroom or Stump within 1.8 (the cut trigger's collider). Mushrooms (`trap_015_tree`) come first, then wooden-wall stumps; the pick within a group is random (`_alwaysRandomInTheEnd`). He stands for the Skill clip (2.33 s); at its strike (1.57 s) the tile's occupant is killed and the tile becomes a broken stump (`trap_017_wooden_broke`), using the Shredder's scenery API. A stun before the strike cancels the cast. Level 1 names the skill `cut_tree` (`max_cut` 1); both bind the prefab's single CutTree ability.

## First knock-out

- A 10 s revive (`reborn.duration`) at full HP. The native `_hpRechargeRatio` is 0.5, but PRTS says 100%, and the owner's in-game check of the same field on Emperor's Blade agreed with PRTS.
- 2.17 s in (`_preDelay`; the Revive clip strikes at 2.1 s) he self-destructs: every ground operator within 3.0 takes 150% ATK Physical and is stunned for 16 s (25 s on level 1).

## High Priest form

- DEF +200 (+500), RES +30 (+40) and movement speed +0.7, all flat (`bird_run` modifiers loaded from the blackboard).
- He cannot attack or be blocked.
- Every second he takes 1,300 sourceless pure damage (`periodic_damage_without_modify_no_fx`), first one second after the revive ends.
- The next knock-out is final.

## Verification

`test/arkpedia-big-ugly-thing.test.js`:
- **Admission.** Both levels are admitted. A changed High Priest DEF, a changed cut cooldown, a wider cut collider and a shorter bomb pre-delay are each refused. Level 1 gives 350% melee, a 25 s stun, +500 DEF and +40 RES.
- **Shot.** Unblocked, he hits the one operator in range and splashes the operator on a diagonal tile beside it, but not one two tiles away.
- **Melee.** Blocked, the blocker takes 300% ATK.
- **Cut.** After the 30 s initial cooldown he fells the mushroom first, at the Skill strike; the cooldown restarts when the cast starts; the stump goes next, and a stump out of reach is spared.
- **Revive.** The bomb lands at 2.17 s on the operator within 3.0 (not the one 4 tiles away) and stuns it. After 10 s he is at full HP with the High Priest stats, cannot be blocked and does not attack. The burn deals 1,300 pure damage with no source, and his next knock-out is final.
- **Compiled stages.** On RI-8 (level 0), RI-EX-8 and RI-EX-8 Challenge (level 1), he fells a mushroom or stump within 40 s, survives the first knock-out and becomes the High Priest, without battle errors.

The library rebuild published exactly three more stages: RI-8, RI-EX-8 and RI-EX-8 Challenge (1,005 available). `check-stage-library.mjs` smoked every graph with no failures, the browser review passed, and RI-8 opens in the preview.

## Boundaries

- **Bomb targets.** The bomb's native selector has `_maxNum` 1 and no `max_target` in the blackboard, which would hit one operator. PRTS and the handbook ("Stunning units in a large area") say every operator in range, so the bomb hits all ground operators within 3.0. It keeps the selector's ground-only motion.
- **Splash tiles.** The 3×3 box is read as the eight tiles around the target's tile, by tile centre.
- **Presentation.** The effect buffs (`mcmstr_state_1_fx_*`) and the mode's animation swaps are not reproduced.
